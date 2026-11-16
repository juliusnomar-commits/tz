import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/app/dashboard/portal-sidebar'
import type { DashboardTask } from '@/lib/dashboard'
import { formatDate, statusLabel } from '@/lib/dashboard'
import { progress, emptyAnswers, type IntakeAnswers } from '@/lib/intake'
import { projectAccess } from '@/lib/project-access'

export const dynamic = 'force-dynamic'

function taskHref(task: DashboardTask, projectId: string) {
  if (task.href) return task.href
  const title = task.title.toLowerCase()
  if (title.includes('intake')) return `/projects/${projectId}/intake`
  if (title.includes('review') || title.includes('comment') || title.includes('preview') || title.includes('content')) return `/projects/${projectId}/content`
  return null
}

export default async function TasksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) redirect('/login')
  const [{ data: taskRows, error: taskError }, { data: intake, error: intakeError }] = await Promise.all([
    access.supabase.from('portal_tasks').select('id, title, owner_type, status, due_at').eq('project_id', projectId).in('owner_type', ['client', 'shared']).order('due_at', { ascending: true, nullsFirst: false }),
    access.supabase.from('portal_project_intakes').select('status, answers').eq('project_id', projectId).maybeSingle(),
  ])
  if (taskError) throw taskError
  if (intakeError) throw intakeError
  const tasks = (taskRows ?? []) as DashboardTask[]
  if (access.project.service === 'website') {
    const intakeProgress = progress({ ...emptyAnswers(), ...(intake?.answers as Partial<IntakeAnswers> ?? {}) })
    tasks.unshift({ id: `intake-${projectId}`, title: 'Complete your website intake', owner_type: 'client', status: ['submitted', 'accepted'].includes(intake?.status ?? '') ? 'done' : 'waiting_client', due_at: null, href: `/projects/${projectId}/intake`, progressPercent: Math.round(intakeProgress.complete / intakeProgress.total * 100) })
  }
  const uniqueTasks = tasks.filter((task, index, all) => all.findIndex(item => item.title.trim().toLowerCase() === task.title.trim().toLowerCase()) === index)
  const openTasks = uniqueTasks.filter(task => task.status !== 'done')
  const doneTasks = uniqueTasks.filter(task => task.status === 'done')
  const timezone = 'Europe/Berlin'

  return <main className="dash-shell">
    <PortalSidebar projectId={projectId} projectName={access.project.name} active="tasks" openTasks={openTasks.length}/>
    <div className="dash-main">
      <header className="dash-page-heading"><span className="eyebrow accent">PROJECT CHECKLIST</span><h1>To do</h1><p>Here are the next steps for {access.project.name}.</p></header>
      <section className="dash-page-card dash-page-task-card" aria-labelledby="your-part-title">
        <div className="dash-card-heading"><div><span className="eyebrow accent">YOUR NEXT STEPS</span><h2 id="your-part-title">Your part</h2></div><span className="dash-task-count">{openTasks.length} open</span></div>
        {openTasks.length ? <ul className="dash-page-task-list">{openTasks.map(task => {
          const href = taskHref(task, projectId)
          return <li key={task.id} className="dash-page-task"><span className="dash-task-icon" aria-hidden="true"/><div className="dash-task-copy"><strong>{task.title}</strong><span>{statusLabel(task.status)}{task.progressPercent !== undefined ? ` · ${task.progressPercent}% complete` : ''}{task.due_at ? ` · Due ${formatDate(task.due_at, timezone)}` : ''}</span>{task.progressPercent !== undefined && <div className="dash-task-progress" role="progressbar" aria-label="Website intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progressPercent}><i style={{ width: `${task.progressPercent}%` }}/></div>}</div>{href && <a className="dash-task-action" href={href}>{task.title.toLowerCase().includes('intake') ? 'Open intake' : 'Open preview'} <span aria-hidden="true">↗</span></a>}</li>
        })}</ul> : <p className="dash-empty-inline">You’re all caught up. Your team will add the next step here.</p>}
        {doneTasks.length > 0 && <details className="dash-completed-tasks"><summary>{doneTasks.length} completed</summary><ul className="dash-page-task-list">{doneTasks.map(task => <li key={task.id} className="dash-page-task is-complete"><span className="dash-task-icon" aria-hidden="true">✓</span><div className="dash-task-copy"><strong>{task.title}</strong><span>Complete</span></div></li>)}</ul></details>}
      </section>
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team ↗</a></footer>
    </div>
  </main>
}
