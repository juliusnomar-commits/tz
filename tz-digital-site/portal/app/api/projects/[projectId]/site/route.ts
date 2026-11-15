import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { parseVisualPins } from '@/lib/content'
import { projectAccess } from '@/lib/project-access'
import { siteProfile, sitePage, validateSiteChanges, validateSiteColors, validateSiteImages } from '@/lib/site-profiles'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Sign in to this project first' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'Editing access required' }, { status: 403 })
  const profile = siteProfile(access.project.site_key)
  if (!profile) return NextResponse.json({ error: 'This project has no connected site' }, { status: 404 })
  try {
    const body = await request.json()
    const pageKey = String(body.pageKey ?? '')
    const page = sitePage(profile, pageKey)
    if (!page) throw new Error('Choose a valid page')
    const intent = body.intent
    if (!['save', 'submit', 'approve'].includes(intent)) throw new Error('Unknown action')
    const isAgency = access.role.startsWith('agency_')
    if (intent === 'approve' && !isAgency) return NextResponse.json({ error: 'Only TZ Digital can approve changes' }, { status: 403 })
    const changes = validateSiteChanges(profile, pageKey, body.changes)
    const images = validateSiteImages(profile, body.images, projectId)
    const colors = validateSiteColors(profile, body.colors)
    const pins = parseVisualPins(body.pins)
    const snapshotDevice = intent === 'submit' ? String(body.snapshotDevice ?? '') : null
    const snapshotPath = intent === 'submit' ? String(body.snapshotPath ?? '') : null
    if (intent === 'submit') {
      if (!['desktop', 'mobile'].includes(snapshotDevice!)) throw new Error('Choose a valid capture size')
      const expectedPath = new RegExp(`^${access.project.tenant_id}/${projectId}/site-reviews/${pageKey}/[0-9a-f-]{36}\\.jpg$`, 'i')
      if (!expectedPath.test(snapshotPath!)) throw new Error('Capture this page before submitting')
    }
    if (intent === 'submit' && !Object.keys(changes).length && !Object.keys(images).length && !Object.keys(colors).length && !pins.length) throw new Error('Make a change or add a comment before submitting')
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) throw new Error('Invalid version')
    const db = adminClient()
    for (const value of Object.values(images)) {
      const fileId = value.match(/\/files\/([0-9a-f-]{36})$/i)?.[1]
      if (!fileId) continue
      const { data: file, error: fileError } = await db.from('portal_file_records').select('id, mime_type').eq('id', fileId).eq('project_id', projectId).eq('tenant_id', access.project.tenant_id).eq('category', 'brand').maybeSingle()
      if (fileError || !file?.mime_type?.startsWith('image/')) throw new Error('Choose an image from this project')
    }
    if (snapshotPath) {
      const { data: capture, error: captureError } = await db.storage.from('portal-intake').info(snapshotPath)
      if (captureError || !capture || capture.metadata?.mimetype !== 'image/jpeg' || Number(capture.metadata?.size) > 10 * 1024 * 1024) throw new Error('Page capture upload is missing or invalid')
    }
    const { data: existing, error: lookupError } = await db.from('portal_site_pages').select('version, status, changes, images, colors, pins, submitted_at, snapshot_path, snapshot_device').eq('project_id', projectId).eq('page_key', pageKey).maybeSingle()
    if (lookupError) throw lookupError
    if ((existing?.version ?? 0) !== body.expectedVersion) return NextResponse.json({ error: 'This page changed elsewhere. Reload before saving.' }, { status: 409 })
    if (intent === 'approve' && existing?.status !== 'submitted') return NextResponse.json({ error: 'Submit the page before approval' }, { status: 409 })
    const now = new Date().toISOString()
    const status = intent === 'approve' ? 'approved' : intent === 'submit' ? 'submitted' : 'draft'
    const row = { project_id: projectId, tenant_id: access.project.tenant_id, page_key: pageKey,
      changes: intent === 'approve' ? existing!.changes : changes,
      images: intent === 'approve' ? existing!.images : images,
      colors: intent === 'approve' ? existing!.colors : colors,
      pins: intent === 'approve' ? existing!.pins : pins,
      snapshot_path: intent === 'approve' ? existing!.snapshot_path : snapshotPath,
      snapshot_device: intent === 'approve' ? existing!.snapshot_device : snapshotDevice,
      status, version: body.expectedVersion + 1, updated_at: now,
      submitted_at: intent === 'submit' ? now : intent === 'approve' ? existing?.submitted_at : null }
    const result = existing
      ? await db.from('portal_site_pages').update(row).eq('project_id', projectId).eq('page_key', pageKey).eq('version', body.expectedVersion).select('page_key, changes, images, colors, pins, status, version, updated_at, snapshot_path, snapshot_device').maybeSingle()
      : await db.from('portal_site_pages').insert(row).select('page_key, changes, images, colors, pins, status, version, updated_at, snapshot_path, snapshot_device').maybeSingle()
    if (result.error) throw result.error
    if (!result.data) return NextResponse.json({ error: 'This page changed elsewhere. Reload before saving.' }, { status: 409 })
    if (intent !== 'save') {
      const { error: activityError } = await db.from('portal_activity').insert({ tenant_id: access.project.tenant_id, project_id: projectId,
        title: `${page.title} changes ${status}`, detail: `${pins.length} pinned comment${pins.length === 1 ? '' : 's'} in the Cato site editor.`, actor_type: isAgency ? 'agency' : 'client' })
      if (activityError) throw activityError
    }
    return NextResponse.json({ page: result.data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save changes' }, { status: 400 })
  }
}
