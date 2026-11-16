import { type DashboardData, formatDate, statusLabel } from '@/lib/dashboard'
import { ProjectFiles } from './project-files'
import { PortalSidebar } from './portal-sidebar'

function TaskItem({ task, timezone, projectId }: { task: DashboardData['tasks'][number], timezone: string, projectId: string }) {
  const complete = task.status === 'done'
  const taskTitle = task.title.toLowerCase()
  const href = task.href ?? (taskTitle.includes('intake') || taskTitle.includes('details') ? `/projects/${projectId}/intake` : taskTitle.includes('review') || taskTitle.includes('comment') || taskTitle.includes('preview') || taskTitle.includes('content') ? `/projects/${projectId}/content` : null)
  return <li className={`dash-task ${complete ? 'is-complete' : ''}`}>
    <span className="dash-task-icon" aria-hidden="true">{complete ? '✓' : ''}</span>
    <div className="dash-task-copy">
      <strong>{task.title}</strong>
      <span>{statusLabel(task.status)}{task.progressPercent !== undefined ? ` · ${task.progressPercent}% complete` : ''}{task.due_at && !complete ? ` · Due ${formatDate(task.due_at, timezone)}` : ''}</span>
      {task.progressPercent !== undefined && <div className="dash-task-progress" role="progressbar" aria-label="Website intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progressPercent}><i style={{ width: `${task.progressPercent}%` }} /></div>}
    </div>
    {!complete && href && <a className="dash-task-action" href={href}>{href.endsWith('/content') ? 'Review & comment' : 'Add details'}</a>}
  </li>
}

function TaskList({ tasks, timezone, projectId }: { tasks: DashboardData['tasks'], timezone: string, projectId: string }) {
  const uniqueTasks = tasks.filter((task, index, all) => all.findIndex(item => item.title.trim().toLowerCase() === task.title.trim().toLowerCase()) === index)
  const todoTasks = uniqueTasks.filter(task => task.status !== 'done')
  const completedTasks = uniqueTasks.filter(task => task.status === 'done')
  return <div className="dash-task-list">
    <div className="dash-card-heading"><div><span className="eyebrow accent">YOUR NEXT STEPS</span><h2>Your part</h2></div></div>
    {todoTasks.length ? <ul>{todoTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} projectId={projectId} />)}</ul> : <p className="dash-empty-inline">Nothing to do right now.</p>}
    {completedTasks.length > 0 && <details className="dash-completed-tasks"><summary>{completedTasks.length} completed</summary><ul>{completedTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} projectId={projectId} />)}</ul></details>}
  </div>
}

function WalkthroughCard() {
  return <section className="dash-howto" aria-labelledby="howto-title">
    <div className="dash-card-heading"><div><span className="eyebrow accent">NEW TO THE PORTAL?</span><h2 id="howto-title">How it works</h2></div></div>
    <div className="dash-video-placeholder" role="img" aria-label="Space reserved for a project portal walkthrough video"><span className="dash-play-icon" aria-hidden="true">▶</span></div>
    <span className="dash-video-caption">Walkthrough video coming soon</span>
  </section>
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { projects, activeProject: project, tasks, activity, files, fileCount } = data
  const timezone = project?.project_timezone ?? 'Europe/Berlin'
  const clientTasks = tasks.filter(task => task.owner_type === 'client' || task.owner_type === 'shared')
  const completedMilestones = data.milestones.filter(item => item.status === 'complete').length
  const progress = data.milestones.length ? Math.round(completedMilestones / data.milestones.length * 100) : 0
  const visibleActivity = activity.filter((item, index, all) => all.findIndex(other => `${other.title}|${other.created_at.slice(0, 10)}` === `${item.title}|${item.created_at.slice(0, 10)}`) === index).slice(0, 1)
  const projectTitle = project?.name.replace(/\bwebsite\b/i, 'Website')

  return <main className="dash-shell" id="overview">
    {project && <PortalSidebar projectId={project.id} projectName={project.name} active="overview" demo={Boolean(data.demo)} />}

    <div className="dash-main">
      {data.demo && <div className="dash-demo-banner" role="note">Preview with synthetic data · No customer information is shown · <a href="/demo/cato">Try the Cato site editor</a></div>}
      {!project ? <section className="dash-no-project"><span className="eyebrow accent">WORKSPACE READY</span><h1>Your first project will appear here.</h1><p>Your TZ Digital team is setting things up. When they add your project, this page will show its next steps and updates.</p><a href="/#kontakt">Contact your team</a></section> : <>
        <header className="dash-project-summary" aria-labelledby="project-title">
          <div className="dash-project-summary-row"><div className="dash-project-heading"><h1 id="project-title">{projectTitle?.toLowerCase().endsWith(' website') ? <>{projectTitle.slice(0, -8)} <em>Website</em></> : projectTitle}</h1></div>
          <div className="dash-project-facts"><span className="dash-updated-fact">Updated {formatDate(project.updated_at, timezone)}</span><span className="dash-completion-fact"><b>{progress}%</b> complete</span><span className="dash-header-progress" role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></span></div></div>
          {projects.length > 1 && <form method="get" action="/dashboard" className="dash-project-switch"><label htmlFor="project-picker">Switch project</label><select id="project-picker" name="project" defaultValue={project.id}>{projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button type="submit">View</button></form>}
        </header>

        <div className="dash-primary-grid">
          <section className="dash-responsibilities" id="tasks" aria-labelledby="tasks-title"><TaskList tasks={clientTasks} timezone={timezone} projectId={project.id} /></section>
          <WalkthroughCard />
        </div>

        <section className="dash-detail-grid" aria-label="Project resources and updates">
          <ProjectFiles projectId={project.id} files={files} fileCount={fileCount} canUpload={Boolean(data.canEdit) && !data.demo} demo={Boolean(data.demo)} />
          <section className="dash-info-card" aria-labelledby="activity-heading"><div className="dash-card-heading"><div><span className="eyebrow accent">RECENT ACTIVITY</span><h2 id="activity-heading">Latest activity</h2></div><a className="dash-card-icon" href={`/projects/${project.id}/updates`} aria-label="Open all updates">All</a></div>{visibleActivity.length ? visibleActivity.map(item => <div className="dash-activity-item" key={item.id}><span className="dash-activity-dot" aria-hidden="true"/><div><strong>{item.title}</strong><time dateTime={item.created_at}>{formatDate(item.created_at, timezone)}</time></div></div>) : <p className="dash-empty-inline">Project updates will appear here as work progresses.</p>}<a className="dash-preview-button" href={`/projects/${project.id}/content`}>Review &amp; comment</a></section>
          <section className="dash-info-card dash-help-card"><div className="dash-card-heading"><div><span className="eyebrow accent">HERE TO HELP</span><h2>Need a hand?</h2></div><span className="dash-card-icon" aria-hidden="true">?</span></div><p>Questions or need support? Get in touch with your TZ Digital team.</p><a href="/#kontakt">Contact your team</a></section>
        </section>
      </>}
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team</a></footer>
    </div>
  </main>
}
