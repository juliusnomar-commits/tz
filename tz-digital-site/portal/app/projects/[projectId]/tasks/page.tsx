import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/app/dashboard/portal-sidebar'
import type { DashboardTask } from '@/lib/dashboard'
import { formatDate, statusLabel } from '@/lib/dashboard'
import { progress, emptyAnswers, requiredFields, type IntakeAnswers } from '@/lib/intake'
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
    access.supabase.from('portal_tasks').select('id, title, owner_type, status, due_at').eq('project_id', projectId).in('owner_type', ['client', 'shared']).neq('status', 'archived').order('due_at', { ascending: true, nullsFirst: false }),
    access.supabase.from('portal_project_intakes').select('status, answers').eq('project_id', projectId).maybeSingle(),
  ])
  if (taskError) throw taskError
  if (intakeError) throw intakeError
  const answers = { ...emptyAnswers(), ...(intake?.answers as Partial<IntakeAnswers> ?? {}) }
  const tasks = (taskRows ?? []) as DashboardTask[]
  if (access.project.service === 'website' && access.project.site_key !== 'cato') {
    const intakeProgress = progress(answers)
    for (let index = tasks.length - 1; index >= 0; index--) if (/intake/i.test(tasks[index].title)) tasks.splice(index, 1)
    tasks.unshift({ id: `intake-${projectId}`, title: 'Share project details', owner_type: 'client', status: ['submitted', 'accepted'].includes(intake?.status ?? '') ? 'done' : 'waiting_client', due_at: null, href: `/projects/${projectId}/intake`, progressPercent: Math.round(intakeProgress.complete / intakeProgress.total * 100) })
  }
  const uniqueTasks = tasks.filter((task, index, all) => all.findIndex(item => item.title.trim().toLowerCase() === task.title.trim().toLowerCase()) === index)
  const openTasks = uniqueTasks.filter(task => task.status !== 'done')
  const doneTasks = uniqueTasks.filter(task => task.status === 'done')
  const timezone = 'Europe/Berlin'

  return <main className="dash-shell">
    <PortalSidebar projectId={projectId} projectName={access.project.name} active="tasks"/>
    <div className="dash-main">
      <header className="dash-page-heading"><h1>To <em>do</em></h1></header>
      <section className="dash-page-card dash-page-task-card" aria-labelledby="your-part-title">
        <div className="dash-card-heading"><div><span className="eyebrow accent">YOUR NEXT STEPS</span><h2 id="your-part-title">Your part</h2></div></div>
        {openTasks.length ? <ul className="dash-page-task-list">{openTasks.map(task => {
          const href = taskHref(task, projectId)
          const isDetails = task.id === `intake-${projectId}`
          const legalFields = requiredFields.filter(field => field.section === 'legal')
          const otherFields = requiredFields.filter(field => field.section !== 'legal')
          const complete = (key: keyof IntakeAnswers) => key === 'publicEmail' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers[key].trim()) : Boolean(answers[key].trim())
          return <li key={task.id} className="dash-page-task"><span className="dash-task-icon" aria-hidden="true"/><div className="dash-task-copy"><strong>{task.title}</strong><span>{statusLabel(task.status)}{task.progressPercent !== undefined ? ` · ${task.progressPercent}% complete` : ''}{task.due_at ? ` · Due ${formatDate(task.due_at, timezone)}` : ''}</span>{task.progressPercent !== undefined && <div className="dash-task-progress" role="progressbar" aria-label="Required details completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progressPercent}><i style={{ width: `${task.progressPercent}%` }}/></div>}{isDetails && <details className="dash-required-details"><summary>What You’ll Need · {requiredFields.length} Required Items</summary><div className="dash-required-groups"><div><b>Legal &amp; Contact</b><ul>{legalFields.map(field => <li key={field.key}><span aria-hidden="true">{complete(field.key) ? '✓' : '○'}</span>{field.label}</li>)}</ul></div><div><b>Business &amp; Website</b><ul>{otherFields.map(field => <li key={field.key}><span aria-hidden="true">{complete(field.key) ? '✓' : '○'}</span>{field.label}</li>)}</ul></div></div><p>Existing company, privacy, or terms documents can be uploaded in Details if you have them.</p></details>}</div>{href && <a className="dash-task-action" href={href}>{isDetails ? 'Add details' : href.endsWith('/content') ? 'Review & comment' : 'Open'}</a>}</li>
        })}</ul> : <div><p className="dash-empty-inline">Nothing to do right now.</p>{access.project.site_key === 'cato' && <a className="dash-task-action" href={`/projects/${projectId}/content`}>Review your website</a>}</div>}
        {doneTasks.length > 0 && <details className="dash-completed-tasks"><summary>{doneTasks.length} completed</summary><ul className="dash-page-task-list">{doneTasks.map(task => <li key={task.id} className="dash-page-task is-complete"><span className="dash-task-icon" aria-hidden="true">✓</span><div className="dash-task-copy"><strong>{task.title}</strong><span>Complete</span></div></li>)}</ul></details>}
      </section>
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team</a></footer>
    </div>
  </main>
}
