import { redirect } from 'next/navigation'
import { DashboardView } from './dashboard-view'
import {
  type DashboardActivity,
  type DashboardFile,
  type DashboardData,
  type DashboardMilestone,
  type DashboardProject,
  type DashboardTask,
} from '@/lib/dashboard'
import { userClient } from '@/lib/supabase'
import { emptyAnswers, progress, type IntakeAnswers } from '@/lib/intake'

export const dynamic = 'force-dynamic'

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const supabase = await userClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) redirect('/login')

  const { data: memberships, error: membershipError } = await supabase
    .from('portal_memberships').select('tenant_id, role').eq('user_id', auth.user.id)
  if (membershipError) throw membershipError
  if (!memberships?.length) redirect('/login')

  const tenantIds = memberships.map(item => item.tenant_id)
  const [{ data: tenantRows, error: tenantError }, { data: projectRows, error: projectError }] = await Promise.all([
    supabase.from('portal_tenants').select('id, name').in('id', tenantIds),
    supabase.from('portal_projects').select('id, tenant_id, name, service, site_key, status, summary, next_milestone, target_window, project_timezone, updated_at').in('tenant_id', tenantIds).order('created_at', { ascending: false }),
  ])
  if (tenantError) throw tenantError
  if (projectError) throw projectError

  const projects = (projectRows ?? []) as DashboardProject[]
  const { project: requestedProject } = await searchParams
  const activeProject = projects.find(item => item.id === requestedProject) ?? projects[0] ?? null
  const organization = tenantRows?.find(item => item.id === activeProject?.tenant_id)?.name ?? tenantRows?.[0]?.name ?? 'Your organization'

  const canEdit = memberships.some(item => item.tenant_id === activeProject?.tenant_id && ['agency_owner', 'agency_admin', 'agency_member', 'client_owner', 'client_editor'].includes(item.role))
  const data: DashboardData = { organization, projects, activeProject, tasks: [], milestones: [], activity: [], files: [], fileCount: 0, canEdit }
  if (activeProject) {
    const projectId = activeProject.id
    const [taskResult, milestoneResult, activityResult, fileResult, intakeResult] = await Promise.all([
      supabase.from('portal_tasks').select('id, title, owner_type, status, due_at').eq('project_id', projectId).neq('status', 'archived').order('due_at', { ascending: true, nullsFirst: false }),
      supabase.from('portal_milestones').select('id, title, status, window_label, position').eq('project_id', projectId).order('position'),
      supabase.from('portal_activity').select('id, title, detail, actor_type, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(8),
      supabase.from('portal_file_records').select('id, display_name, category, mime_type, byte_size, uploaded_at', { count: 'exact' }).eq('project_id', projectId).order('uploaded_at', { ascending: false }).limit(4),
      supabase.from('portal_project_intakes').select('status, answers').eq('project_id', projectId).maybeSingle(),
    ])
    for (const result of [taskResult, milestoneResult, activityResult, fileResult, intakeResult]) if (result.error) throw result.error
    data.tasks = (taskResult.data ?? []) as DashboardTask[]
    if (activeProject.service === 'website' && activeProject.site_key !== 'cato') {
      data.tasks = data.tasks.filter(task => !/intake/i.test(task.title))
      const intakeProgress = progress({ ...emptyAnswers(), ...(intakeResult.data?.answers as Partial<IntakeAnswers> ?? {}) })
      data.tasks.unshift({ id: `intake-${projectId}`, title: 'Share project details', owner_type: 'client', status: ['submitted', 'accepted'].includes(intakeResult.data?.status ?? '') ? 'done' : 'waiting_client', due_at: null, href: `/projects/${projectId}/intake`, progressPercent: Math.round(intakeProgress.complete / intakeProgress.total * 100) })
    }
    data.milestones = (milestoneResult.data ?? []) as DashboardMilestone[]
    data.activity = (activityResult.data ?? []) as DashboardActivity[]
    data.files = (fileResult.data ?? []) as DashboardFile[]
    data.fileCount = fileResult.count ?? data.files.length
  }

  return <DashboardView data={data} />
}
