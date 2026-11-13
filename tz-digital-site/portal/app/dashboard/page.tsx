import { redirect } from 'next/navigation'
import { DashboardView } from './dashboard-view'
import {
  type DashboardActivity,
  type DashboardData,
  type DashboardMilestone,
  type DashboardProject,
  type DashboardReview,
  type DashboardTask,
} from '@/lib/dashboard'
import { userClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const supabase = await userClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) redirect('/login')

  const { data: memberships, error: membershipError } = await supabase
    .from('portal_memberships').select('tenant_id').eq('user_id', auth.user.id)
  if (membershipError) throw membershipError
  if (!memberships?.length) redirect('/login')

  const tenantIds = memberships.map(item => item.tenant_id)
  const [{ data: tenantRows, error: tenantError }, { data: projectRows, error: projectError }] = await Promise.all([
    supabase.from('portal_tenants').select('id, name').in('id', tenantIds),
    supabase.from('portal_projects').select('id, tenant_id, name, service, status, summary, next_milestone, target_window, project_timezone, updated_at').in('tenant_id', tenantIds).order('created_at', { ascending: false }),
  ])
  if (tenantError) throw tenantError
  if (projectError) throw projectError

  const projects = (projectRows ?? []) as DashboardProject[]
  const { project: requestedProject } = await searchParams
  const activeProject = projects.find(item => item.id === requestedProject) ?? projects[0] ?? null
  const organization = tenantRows?.find(item => item.id === activeProject?.tenant_id)?.name ?? tenantRows?.[0]?.name ?? 'Your organization'

  const data: DashboardData = { organization, projects, activeProject, tasks: [], milestones: [], activity: [], reviews: [], fileCount: 0 }
  if (activeProject) {
    const projectId = activeProject.id
    const [taskResult, milestoneResult, activityResult, reviewResult, fileResult] = await Promise.all([
      supabase.from('portal_tasks').select('id, title, owner_type, status, due_at').eq('project_id', projectId).order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('portal_milestones').select('id, title, status, window_label, position').eq('project_id', projectId).order('position'),
      supabase.from('portal_activity').select('id, title, detail, actor_type, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(8),
      supabase.from('portal_review_rounds').select('id, title, status, due_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(3),
      supabase.from('portal_file_records').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ])
    for (const result of [taskResult, milestoneResult, activityResult, reviewResult, fileResult]) if (result.error) throw result.error
    data.tasks = (taskResult.data ?? []) as DashboardTask[]
    data.milestones = (milestoneResult.data ?? []) as DashboardMilestone[]
    data.activity = (activityResult.data ?? []) as DashboardActivity[]
    data.reviews = (reviewResult.data ?? []) as DashboardReview[]
    data.fileCount = fileResult.count ?? 0
  }

  return <DashboardView data={data} />
}
