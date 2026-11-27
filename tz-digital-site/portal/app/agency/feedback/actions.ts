'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { userClient } from '@/lib/supabase'
import { agencyFeedback } from '@/lib/agency-feedback'

const allowed = ['new', 'in_progress', 'completed', 'needs_client'] as const
export async function updateFeedbackTriage(form: FormData) {
  const projectId = String(form.get('projectId') ?? '')
  const feedbackKey = String(form.get('feedbackKey') ?? '')
  const status = String(form.get('status') ?? '')
  const note = String(form.get('note') ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(projectId) || !feedbackKey || feedbackKey.length > 255 ||
      !allowed.includes(status as typeof allowed[number]) || note.length > 4000)
    throw new Error('Invalid feedback update')
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: project, error: projectError } = await supabase.from('portal_projects')
    .select('id,tenant_id').eq('id', projectId).maybeSingle()
  if (projectError || !project) throw new Error('Project not accessible')
  const { data: member, error: memberError } = await supabase.from('portal_memberships')
    .select('role').eq('tenant_id',project.tenant_id).eq('user_id',auth.user.id).maybeSingle()
  if (memberError || !member || !['agency_owner','agency_admin','agency_member'].includes(member.role))
    throw new Error('Agency access required')
  const { error } = await supabase.from('portal_feedback_triage').upsert({
    tenant_id: project.tenant_id, project_id: projectId, feedback_key: feedbackKey,
    status, internal_note: note.trim(), updated_by: auth.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,feedback_key' })
  if (error) throw new Error('Could not save feedback status')
  revalidatePath('/agency/feedback')
  revalidatePath('/agency')
}

export async function markFeedbackDay(form: FormData) {
  const projectId=String(form.get('projectId')??'')
  const day=String(form.get('day')??'')
  const completed=String(form.get('completed')??'')==='true'
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid feedback day')
  const {authorized,projects}=await agencyFeedback()
  if (!authorized) redirect('/login')
  const project=projects.find(p=>p.id===projectId)
  if (!project) throw new Error('Project not accessible')
  const items=project.items.filter(i=>i.kind!=='Saved changes' && new Date(i.createdAt).toISOString().slice(0,10)===day)
  if (!items.length) return
  const db=await userClient()
  const {data:auth}=await db.auth.getUser()
  if (!auth.user) redirect('/login')
  const {data:existing,error:readError}=await db.from('portal_feedback_triage')
    .select('feedback_key,internal_note').eq('project_id',projectId).in('feedback_key',items.map(i=>i.id))
  if (readError) throw readError
  const notes=new Map((existing??[]).map(row=>[row.feedback_key,row.internal_note]))
  const {error}=await db.from('portal_feedback_triage').upsert(items.map(item=>({
    tenant_id:project.tenant_id,project_id:projectId,feedback_key:item.id,
    status:completed?'completed':'new',internal_note:notes.get(item.id)??'',
    updated_by:auth.user!.id,updated_at:new Date().toISOString(),
  })),{onConflict:'project_id,feedback_key'})
  if (error) throw new Error('Could not update day status')
  revalidatePath('/agency/feedback')
  revalidatePath('/agency')
}
