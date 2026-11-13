import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { parseAnswers, validateSubmission } from '@/lib/intake'
import { projectAccess } from '@/lib/project-access'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'You do not have editing access' }, { status: 403 })
  try {
    const body = await request.json()
    const answers = parseAnswers(body.answers)
    const submit = body.submit === true
    if (submit) validateSubmission(answers)
    const admin = adminClient()
    const { data: existing, error: lookupError } = await admin.from('portal_project_intakes').select('status').eq('project_id', projectId).maybeSingle()
    if (lookupError) throw lookupError
    if (existing?.status === 'accepted') return NextResponse.json({ error: 'This intake is already accepted' }, { status: 409 })
    const status = submit ? 'submitted' : existing?.status === 'submitted' ? 'submitted' : 'draft'
    const { error } = await admin.from('portal_project_intakes').upsert({ project_id: projectId, tenant_id: access.project.tenant_id, answers, status, updated_at: new Date().toISOString(), ...(submit ? { submitted_at: new Date().toISOString() } : {}) }, { onConflict: 'project_id' })
    if (error) throw error
    if (submit) {
      const { error: activityError } = await admin.from('portal_activity').insert({ tenant_id: access.project.tenant_id, project_id: projectId, title: 'Website intake submitted', detail: 'Business details, legal-page inputs and design brief are ready for TZ Digital to review.', actor_type: 'client' })
      if (activityError) throw activityError
    }
    return NextResponse.json({ status })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save intake' }, { status: 400 })
  }
}
