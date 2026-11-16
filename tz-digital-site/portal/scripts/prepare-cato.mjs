import { createClient } from '@supabase/supabase-js'

const projectId = process.argv[2]
if (!/^[0-9a-f-]{36}$/i.test(projectId ?? '')) throw new Error('Usage: npm run prepare-cato -- PROJECT_UUID')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase configuration is missing')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: project, error: projectError } = await db.from('portal_projects').select('id, tenant_id, site_key').eq('id', projectId).single()
if (projectError || project?.site_key !== 'cato') throw projectError ?? new Error('Cato project not found')

const { error: updateError } = await db.from('portal_projects').update({
  status: 'awaiting_client',
  summary: 'Your website is ready for review. You can suggest edits and leave comments whenever you are ready.',
  next_milestone: 'Cato review',
  updated_at: new Date().toISOString(),
}).eq('id', projectId)
if (updateError) throw updateError

const milestones = ['Project planning', 'Website design', 'Website build', 'Portal and editor', 'Cato review'].map((title, position) => ({
  tenant_id: project.tenant_id, project_id: projectId, title, position, status: position < 4 ? 'complete' : 'current',
}))
const { error: milestoneError } = await db.from('portal_milestones').upsert(milestones, { onConflict: 'project_id,position' })
if (milestoneError) throw milestoneError

const { error: taskError } = await db.from('portal_tasks').update({ status: 'archived' }).eq('project_id', projectId).eq('owner_type', 'client').in('title', ['Complete website intake', 'Review and comment on the website']).neq('status', 'done')
if (taskError) throw taskError

const activityTitle = 'Website ready for your review'
const { data: priorActivity, error: activityLookupError } = await db.from('portal_activity').select('id').eq('project_id', projectId).eq('title', activityTitle).limit(1)
if (activityLookupError) throw activityLookupError
if (!priorActivity?.length) {
  const { error: activityError } = await db.from('portal_activity').insert({ tenant_id: project.tenant_id, project_id: projectId, title: activityTitle,
    detail: 'The website build is nearly complete. Review the pages, suggest edits, or leave a comment in the editor.', actor_type: 'agency', visibility: 'client' })
  if (activityError) throw activityError
}
process.stdout.write(`Cato project ${projectId} is ready for client review. Existing site pages were not changed.\n`)
