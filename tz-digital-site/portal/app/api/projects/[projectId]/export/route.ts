import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { contentPages, type ContentPageKey } from '@/lib/content'
import { sectionFields, type IntakeAnswers, type IntakeSection } from '@/lib/intake'
import { projectAccess } from '@/lib/project-access'
import { createZip } from '@/lib/zip'
import { sitePage, siteProfile, type SiteProfile } from '@/lib/site-profiles'

const encoder = new TextEncoder()
const text = (value: string) => encoder.encode(value)
const safeName = (value: string) => value.normalize('NFKC').replace(/[\\/\x00-\x1f\x7f:*?"<>|]/g, '-').replace(/^\.+/, '').slice(0, 90) || 'file'

function answerMarkdown(title: string, answers: Record<string, string>, keys: readonly string[]) {
  return `# ${title}\n\n${keys.map(key => `## ${key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())}\n\n${answers[key] || '_Not provided_'}\n`).join('\n')}`
}

function indented(value: unknown) { return String(value ?? '').split('\n').map(line => `    ${line}`).join('\n') }

function siteReviewMarkdown(profile: SiteProfile, page: { page_key: string; changes: unknown; images: unknown; colors: unknown; pins: unknown; status: string; version: number; snapshot_path: string|null; snapshot_device: string|null }) {
  const info = sitePage(profile, page.page_key)
  const changes = (page.changes ?? {}) as Record<string,string>
  const images = (page.images ?? {}) as Record<string,string>
  const colors = (page.colors ?? {}) as Record<string,string>
  const pins = Array.isArray(page.pins) ? page.pins as { x: number; y: number; target: string; comment: string }[] : []
  const textChanges = Object.entries(changes).map(([key,value]) => `### ${key}\n\nCurrent:\n\n${indented(profile.copy[key])}\n\nRequested:\n\n${indented(value)}\n`).join('\n')
  const imageChanges = Object.entries(images).map(([key,value]) => `- **${key}:** ${profile.images[key]} → ${value}`).join('\n')
  const colorChanges = Object.entries(colors).map(([key,value]) => `- **${key}:** ${profile.colors[key]} → ${value}`).join('\n')
  const comments = pins.map((pin,index) => `${index + 1}. **${pin.target}** at ${pin.x.toFixed(1)}% across, ${pin.y.toFixed(1)}% down: ${pin.comment}`).join('\n')
  return `# ${profile.name}: ${info?.title ?? page.page_key}\n\nStatus: **${page.status}** · Version: ${page.version}\nLive reference: https://${profile.domain}/${info?.path === 'index.html' ? '' : info?.path ?? ''}\n\n## Text edits\n\n${textChanges || '_No text edits._'}\n## Image replacements\n\n${imageChanges || '_No image replacements._'}\n\n## Color edits\n\n${colorChanges || '_No color edits._'}\n\n## Pinned comments\n\n${comments || '_No pinned comments._'}\n\n## Page capture\n\n${page.snapshot_path ? `Captured in ${page.snapshot_device ?? 'desktop'} view with the pins visible.\n\n![Annotated page capture](./${page.page_key}-pins.jpg)` : '_No submitted page capture yet. Save a review from the editor to add one._'}\n`
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  if (!access.role.startsWith('agency_')) return NextResponse.json({ error: 'Only TZ Digital can export the project handoff' }, { status: 403 })
  const admin = adminClient()
  const [intakeResult, pagesResult, siteResult, filesResult] = await Promise.all([
    admin.from('portal_project_intakes').select('answers, status, section_statuses, updated_at').eq('project_id', projectId).maybeSingle(),
    admin.from('portal_content_pages').select('page_key, fields, design, pins, status, version, updated_at').eq('project_id', projectId),
    admin.from('portal_site_pages').select('page_key, changes, images, colors, pins, status, version, updated_at, snapshot_path, snapshot_device').eq('project_id', projectId),
    admin.from('portal_file_records').select('id, display_name, category, storage_path, mime_type, byte_size').eq('project_id', projectId).in('category', ['brand', 'legal']).order('uploaded_at'),
  ])
  for (const result of [intakeResult, pagesResult, siteResult, filesResult]) if (result.error) return NextResponse.json({ error: 'Unable to prepare project handoff' }, { status: 500 })
  const files = filesResult.data ?? []
  if (files.length > 100 || files.reduce((sum, file) => sum + (file.byte_size ?? 0), 0) > 100 * 1024 * 1024) return NextResponse.json({ error: 'Project files exceed the 100 MB handoff limit' }, { status: 413 })
  const intake = intakeResult.data
  const answers = (intake?.answers ?? {}) as Partial<IntakeAnswers>
  const normalized = Object.fromEntries(Object.keys(sectionFields).flatMap(section => sectionFields[section as IntakeSection].map(key => [key, answers[key] ?? '']))) as Record<string, string>
  const folder = `tz-digital-${projectId.slice(0, 8)}`
  const entries: { path: string; data: Uint8Array }[] = []
  const add = (path: string, data: string | Uint8Array) => entries.push({ path: `${folder}/${path}`, data: typeof data === 'string' ? text(data) : data })
  add('README.md', `# TZ Digital project handoff\n\nProject: ${access.project.name}\nExported: ${new Date().toISOString()}\n\nStart with manifest.json and the numbered folders. Answers are customer-provided; legal-page suggestions are planning input and need business-specific review before publishing. CMS pages are drafts until approved and applied to a customer site. Uploaded files are private project assets; check rights and suitability before use.\n`)
  add('manifest.json', JSON.stringify({ project: { id: projectId, name: access.project.name, service: access.project.service, siteKey: access.project.site_key }, exportedAt: new Date().toISOString(), intake: { status: intake?.status ?? 'not_started', sectionStatuses: intake?.section_statuses ?? {}, updatedAt: intake?.updated_at ?? null }, contentPages: (pagesResult.data ?? []).map(page => ({ page: page.page_key, status: page.status, version: page.version, updatedAt: page.updated_at })), sitePages: (siteResult.data ?? []).map(page => ({ page: page.page_key, status: page.status, version: page.version, updatedAt: page.updated_at })), files: files.map(file => ({ name: file.display_name, category: file.category, mimeType: file.mime_type, byteSize: file.byte_size })) }, null, 2))
  add('01-legal-footer/answers.md', answerMarkdown('Legal and footer inputs', normalized, sectionFields.legal))
  add('01-legal-footer/footer-links.md', `# Footer link plan\n\n- ${answers.country === 'Netherlands' ? 'Company details' : 'Impressum / company information'}\n- Privacy policy\n${answers.cookiesAnalytics === 'yes' ? '- Cookie settings / declaration\n' : ''}${answers.termsNeeded === 'yes' ? '- Terms and conditions\n' : ''}\nAdditional links requested: ${answers.footerLinks || 'None provided'}\n\nReview all links and page text for the actual business and website features before launch.\n`)
  add('02-business/answers.md', answerMarkdown('Business basics', normalized, sectionFields.business))
  add('03-story/answers.md', answerMarkdown('Optional Our Story', normalized, sectionFields.story))
  add('04-design/brief.md', answerMarkdown('Design direction', normalized, sectionFields.design))
  add('intake-answers.json', JSON.stringify(answers, null, 2))
  for (const page of pagesResult.data ?? []) {
    const key = page.page_key as ContentPageKey
    if (!Object.hasOwn(contentPages, key)) continue
    const fields = page.fields as Record<string, string>
    const design = page.design ?? {}
    const pins = Array.isArray(page.pins) ? page.pins as { x: number; y: number; target: string; comment: string }[] : []
    add(`05-content/${key}.md`, `# ${contentPages[key].title}\n\nStatus: ${page.status}\nVersion: ${page.version}\n\n${contentPages[key].fields.map(field => `## ${field.label}\n\n${fields[field.key] || '_Not provided_'}\n`).join('\n')}\n## Proposed visual design\n\n${JSON.stringify(design, null, 2)}\n\n## Pinned comments\n\n${pins.length ? pins.map((pin, index) => `${index + 1}. ${pin.comment} (at ${pin.x}%, ${pin.y}%; ${pin.target})`).join('\n') : '_None_'}\n`)
    add(`05-content/${key}.json`, JSON.stringify({ fields, design, pins, status: page.status, version: page.version }, null, 2))
  }
  const profile = siteProfile(access.project.site_key)
  if (profile) {
    const sitePages = siteResult.data ?? []
    const approved = sitePages.filter(page => page.status === 'approved')
    add('05-site-review/README.md', `# ${profile.name} site review\n\nEach page has a Markdown brief, structured JSON, and (after submission) a full page JPEG capture with numbered pins. The Markdown briefs are ready to pass to an AI assistant or to implement manually. Only approved page changes should be applied to the customer website. Nothing in this export publishes automatically.\n`)
    for (const page of sitePages) {
      if (!sitePage(profile, page.page_key)) continue
      add(`05-site-review/${page.page_key}.md`, siteReviewMarkdown(profile, page))
      add(`05-site-review/${page.page_key}.json`, JSON.stringify(page, null, 2))
      if (page.snapshot_path) {
        const expected = new RegExp(`^${access.project.tenant_id}/${projectId}/site-reviews/${page.page_key}/[0-9a-f-]{36}\\.jpg$`, 'i')
        if (!expected.test(page.snapshot_path)) return NextResponse.json({ error: 'A page capture has an invalid path' }, { status: 500 })
        const { data, error } = await admin.storage.from('portal-intake').download(page.snapshot_path)
        if (error || !data) return NextResponse.json({ error: `Unable to retrieve ${page.page_key} page capture` }, { status: 500 })
        const bytes = new Uint8Array(await data.arrayBuffer())
        if (bytes.byteLength > 10 * 1024 * 1024) return NextResponse.json({ error: 'A page capture exceeds the 10 MB limit' }, { status: 413 })
        add(`05-site-review/${page.page_key}-pins.jpg`, bytes)
      }
    }
    add('05-site-review/approved-copy.json', JSON.stringify({ ...profile.copy, ...Object.assign({}, ...approved.map(page => page.changes)) }, null, 2))
    add('05-site-review/approved-images.json', JSON.stringify({ ...profile.images, ...Object.assign({}, ...approved.map(page => page.images)) }, null, 2))
    add('05-site-review/approved-colors.json', JSON.stringify({ ...profile.colors, ...Object.assign({}, ...approved.map(page => page.colors)) }, null, 2))
  }
  let total = 0
  for (const file of files) {
    const { data, error } = await admin.storage.from('portal-intake').download(file.storage_path)
    if (error || !data) return NextResponse.json({ error: `Unable to retrieve ${file.display_name}` }, { status: 500 })
    const bytes = new Uint8Array(await data.arrayBuffer())
    total += bytes.byteLength
    if (total > 100 * 1024 * 1024) return NextResponse.json({ error: 'Project files exceed the 100 MB handoff limit' }, { status: 413 })
    add(`06-assets/${file.category}/${file.id.slice(0, 8)}-${safeName(file.display_name)}`, bytes)
  }
  const zip = createZip(entries)
  return new NextResponse(new Uint8Array(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="tz-digital-${projectId.slice(0, 8)}-handoff.zip"`, 'Cache-Control': 'private, no-store' } })
}
