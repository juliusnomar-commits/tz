import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { contentPages, defaultDesign, parseContent, parseVisualDesign, parseVisualPins, type ContentPageKey } from '@/lib/content'
import { projectAccess } from '@/lib/project-access'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'You do not have editing access' }, { status: 403 })
  if (access.project.service !== 'website') return NextResponse.json({ error: 'Content editor is for website projects' }, { status: 404 })
  try {
    const body = await request.json()
    const pageKey: ContentPageKey = body.pageKey
    if (!Object.hasOwn(contentPages, pageKey)) throw new Error('Choose a valid page')
    const intent = body.intent
    if (!['save', 'submit', 'approve'].includes(intent)) throw new Error('Unknown action')
    const isAgency = access.role.startsWith('agency_')
    if (intent === 'approve' && !isAgency) return NextResponse.json({ error: 'Only the agency can approve copy' }, { status: 403 })
    const fields = parseContent(pageKey, body.fields)
    const design = parseVisualDesign(body.design ?? defaultDesign)
    const pins = parseVisualPins(body.pins ?? [])
    if (intent === 'submit' && !Object.values(fields).some(Boolean) && !pins.length && JSON.stringify(design) === JSON.stringify(defaultDesign)) throw new Error('Edit text, choose an image or color, or add a pinned comment before sending')
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) throw new Error('Invalid content version')
    const admin = adminClient()
    if (design.heroImageFileId) {
      const { data: image, error: imageError } = await admin.from('portal_file_records').select('id, mime_type').eq('id', design.heroImageFileId).eq('project_id', projectId).eq('tenant_id', access.project.tenant_id).eq('category', 'brand').maybeSingle()
      if (imageError || !image || !image.mime_type?.startsWith('image/')) throw new Error('Choose an image from this project')
    }
    const { data: existing, error: lookupError } = await admin.from('portal_content_pages').select('version, status, submitted_at, fields, design, pins').eq('project_id', projectId).eq('page_key', pageKey).maybeSingle()
    if (lookupError) throw lookupError
    if ((existing?.version ?? 0) !== body.expectedVersion) return NextResponse.json({ error: 'This page changed elsewhere. Reload before saving.' }, { status: 409 })
    if (intent === 'approve' && existing?.status !== 'submitted') return NextResponse.json({ error: 'Submit this page before approval' }, { status: 409 })
    const status = intent === 'approve' ? 'approved' : intent === 'submit' ? 'submitted' : 'draft'
    const now = new Date().toISOString()
    const row = { project_id: projectId, tenant_id: access.project.tenant_id, page_key: pageKey, fields: intent === 'approve' ? existing!.fields : fields, design: intent === 'approve' ? existing!.design : design, pins: intent === 'approve' ? existing!.pins : pins, status, version: body.expectedVersion + 1, updated_at: now, submitted_at: intent === 'submit' ? now : intent === 'approve' ? existing?.submitted_at : null }
    const result = existing
      ? await admin.from('portal_content_pages').update(row).eq('project_id', projectId).eq('page_key', pageKey).eq('version', body.expectedVersion).select('page_key, fields, design, pins, status, version, updated_at').maybeSingle()
      : await admin.from('portal_content_pages').insert(row).select('page_key, fields, design, pins, status, version, updated_at').maybeSingle()
    if (result.error) {
      if (result.error.code === '23505') return NextResponse.json({ error: 'This page changed elsewhere. Reload before saving.' }, { status: 409 })
      throw result.error
    }
    if (!result.data) return NextResponse.json({ error: 'This page changed elsewhere. Reload before saving.' }, { status: 409 })
    if (intent !== 'save') {
      const { error: activityError } = await admin.from('portal_activity').insert({ tenant_id: access.project.tenant_id, project_id: projectId, title: `${contentPages[pageKey].title} preview ${status}`, detail: `${pins.length} pinned comment${pins.length === 1 ? '' : 's'} and proposed page changes are ready in the visual editor.`, actor_type: isAgency ? 'agency' : 'client' })
      if (activityError) throw activityError
    }
    return NextResponse.json({ page: result.data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save content' }, { status: 400 })
  }
}
