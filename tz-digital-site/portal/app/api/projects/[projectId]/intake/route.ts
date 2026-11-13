import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { parseAnswers, sectionFields, validateSection, validateSubmission, type IntakeSection, type SectionStatuses } from '@/lib/intake'
import { projectAccess } from '@/lib/project-access'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'You do not have editing access' }, { status: 403 })
  try {
    const body = await request.json()
    const answers = parseAnswers(body.answers)
    const intent = body.intent ?? (body.submit === true ? 'submit_all' : 'save')
    if (!['save', 'submit_section', 'submit_all'].includes(intent)) throw new Error('Unknown action')
    const section: IntakeSection | undefined = body.section
    if (intent === 'submit_section' && (!section || !Object.hasOwn(sectionFields, section))) throw new Error('Choose a section to submit')
    if (intent === 'submit_section') validateSection(answers, section!)
    if (intent === 'submit_all') validateSubmission(answers)
    const admin = adminClient()
    if (!Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) throw new Error('Invalid intake version')
    const { data: existing, error: lookupError } = await admin.from('portal_project_intakes').select('status, answers, section_statuses, submitted_at, version').eq('project_id', projectId).maybeSingle()
    if (lookupError) throw lookupError
    if ((existing?.version ?? 0) !== body.expectedVersion) return NextResponse.json({ error: 'This intake changed elsewhere. Reload before saving.' }, { status: 409 })
    if (existing?.status === 'accepted') return NextResponse.json({ error: 'This intake is already accepted' }, { status: 409 })
    const previous = (existing?.answers ?? {}) as Record<string, string>
    const sectionStatuses: SectionStatuses = { ...(existing?.section_statuses as SectionStatuses ?? {}) }
    let changed = false
    for (const key of Object.keys(sectionFields) as IntakeSection[]) {
      if (sectionFields[key].some(field => (previous[field] ?? '') !== answers[field])) { delete sectionStatuses[key]; changed = true }
    }
    if (intent === 'submit_section') sectionStatuses[section!] = 'submitted'
    if (intent === 'submit_all') for (const key of Object.keys(sectionFields) as IntakeSection[]) sectionStatuses[key] = 'submitted'
    const status = intent === 'submit_all' ? 'submitted' : changed || existing?.status === 'changes_requested' ? 'draft' : existing?.status ?? 'draft'
    const submittedAt = intent === 'submit_all' ? new Date().toISOString() : status === 'submitted' ? existing?.submitted_at : null
    const row = { project_id: projectId, tenant_id: access.project.tenant_id, answers, section_statuses: sectionStatuses, status, version: body.expectedVersion + 1, updated_at: new Date().toISOString(), submitted_at: submittedAt }
    const result = existing
      ? await admin.from('portal_project_intakes').update(row).eq('project_id', projectId).eq('version', body.expectedVersion).select('version').maybeSingle()
      : await admin.from('portal_project_intakes').insert(row).select('version').maybeSingle()
    if (result.error) {
      if (result.error.code === '23505') return NextResponse.json({ error: 'This intake changed elsewhere. Reload before saving.' }, { status: 409 })
      throw result.error
    }
    if (!result.data) return NextResponse.json({ error: 'This intake changed elsewhere. Reload before saving.' }, { status: 409 })
    if (intent !== 'save') {
      const title = intent === 'submit_all' ? 'Website intake submitted' : `${section![0].toUpperCase()}${section!.slice(1)} intake section submitted`
      const { error: activityError } = await admin.from('portal_activity').insert({ tenant_id: access.project.tenant_id, project_id: projectId, title, detail: intent === 'submit_all' ? 'The full website brief is ready for review.' : 'A section of the website brief is ready for review.', actor_type: 'client' })
      if (activityError) throw activityError
    }
    return NextResponse.json({ status, sectionStatuses, version: result.data.version })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save intake' }, { status: 400 })
  }
}
