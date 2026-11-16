import { logout } from '@/app/login/actions'
import type { ReactNode } from 'react'
import { type DashboardData, formatDate, statusLabel } from '@/lib/dashboard'
import { ProjectFiles } from './project-files'

function NavIcon({ kind }: { kind: 'overview' | 'todo' | 'files' | 'updates' }) {
  const paths = {
    overview: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    todo: <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 2.5 2.5L16 9"/></>,
    files: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></>,
    updates: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  } satisfies Record<string, ReactNode>
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
}

function TaskItem({ task, timezone }: { task: DashboardData['tasks'][number], timezone: string }) {
  const complete = task.status === 'done'
  return <li className={`dash-task ${complete ? 'is-complete' : ''}`}>
    <span className="dash-task-icon" aria-hidden="true">{complete ? '✓' : ''}</span>
    <div className="dash-task-copy">
      <strong>{task.title}</strong>
      <span>{statusLabel(task.status)}{task.progressPercent !== undefined ? ` · ${task.progressPercent}% complete` : ''}{task.due_at && !complete ? ` · Due ${formatDate(task.due_at, timezone)}` : ''}</span>
      {task.progressPercent !== undefined && <div className="dash-task-progress" role="progressbar" aria-label="Website intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progressPercent}><i style={{ width: `${task.progressPercent}%` }} /></div>}
    </div>
    {!complete && task.href && <a className="dash-task-action" href={task.href}>Open <span aria-hidden="true">↗</span></a>}
  </li>
}

function TaskList({ tasks, timezone }: { tasks: DashboardData['tasks'], timezone: string }) {
  const uniqueTasks = tasks.filter((task, index, all) => all.findIndex(item => item.title.trim().toLowerCase() === task.title.trim().toLowerCase()) === index)
  const todoTasks = uniqueTasks.filter(task => task.status !== 'done')
  const completedTasks = uniqueTasks.filter(task => task.status === 'done')
  return <div className="dash-task-list">
    <div className="dash-card-heading"><div><span className="eyebrow accent">YOUR NEXT STEPS</span><h2>Your part</h2></div><span className="dash-task-count">{todoTasks.length} open</span></div>
    {todoTasks.length ? <ul>{todoTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} />)}</ul> : <p className="dash-empty-inline">Nothing to do right now.</p>}
    {completedTasks.length > 0 && <details className="dash-completed-tasks"><summary>{completedTasks.length} completed</summary><ul>{completedTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} />)}</ul></details>}
  </div>
}

function WalkthroughCard() {
  return <section className="dash-howto" aria-labelledby="howto-title">
    <div className="dash-card-heading"><div><span className="eyebrow accent">NEW TO THE PORTAL?</span><h2 id="howto-title">How it works</h2></div></div>
    <p>A short guide to your project portal.</p>
    <div className="dash-video-placeholder" role="img" aria-label="Space reserved for a project portal walkthrough video"><span className="dash-play-icon" aria-hidden="true">▶</span></div>
    <span className="dash-video-caption">Walkthrough video coming soon</span>
  </section>
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { organization, projects, activeProject: project, tasks, activity, files, fileCount } = data
  const timezone = project?.project_timezone ?? 'Europe/Berlin'
  const clientTasks = tasks.filter(task => task.owner_type === 'client' || task.owner_type === 'shared')
  const completedMilestones = data.milestones.filter(item => item.status === 'complete').length
  const progress = data.milestones.length ? Math.round(completedMilestones / data.milestones.length * 100) : 0
  const visibleActivity = activity.filter((item, index, all) => all.findIndex(other => `${other.title}|${other.created_at.slice(0, 10)}` === `${item.title}|${item.created_at.slice(0, 10)}`) === index).slice(0, 1)

  return <main className="dash-shell" id="overview">
    <aside className="dash-sidebar">
      <a className="dash-sidebar-brand" href="/dashboard" aria-label="TZ Digital client portal home"><span>TZ</span> Digital</a>
      <nav aria-label="Portal navigation" className="dash-sidebar-nav">
        <a href="#overview" aria-current="page"><NavIcon kind="overview" />Overview</a>
        <a href="#tasks"><NavIcon kind="todo" />To do{clientTasks.filter(task => task.status !== 'done').length > 0 && <span className="dash-nav-count">{clientTasks.filter(task => task.status !== 'done').length}</span>}</a>
        <a href="#files"><NavIcon kind="files" />Files</a>
        <a href="#activity"><NavIcon kind="updates" />Updates</a>
      </nav>
      <div className="dash-sidebar-bottom"><span>{organization}</span>{data.demo ? <a href="/login">Exit preview ↗</a> : <form action={logout}><button type="submit">Sign out</button></form>}</div>
    </aside>

    <div className="dash-main">
      {data.demo && <div className="dash-demo-banner" role="note">Preview with synthetic data · No customer information is shown · <a href="/demo/cato">Try the Cato site editor ↗</a></div>}
      {!project ? <section className="dash-no-project"><span className="eyebrow accent">WORKSPACE READY</span><h1>Your first project will appear here.</h1><p>Your TZ Digital team is setting things up. When they add your project, this page will show its next steps and updates.</p><a href="/#kontakt">Contact your team <span aria-hidden="true">↗</span></a></section> : <>
        <header className="dash-project-summary" aria-labelledby="project-title">
          <div className="dash-project-heading"><h1 id="project-title">{project.name}</h1><span className="dash-status"><span className="dash-status-dot" aria-hidden="true" />{statusLabel(project.status)}</span></div>
          <div className="dash-project-facts"><span>Updated {formatDate(project.updated_at, timezone)}</span><span><b>{progress}%</b> complete</span><span className="dash-header-progress" role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></span></div>
          {projects.length > 1 && <form method="get" action="/dashboard" className="dash-project-switch"><label htmlFor="project-picker">Switch project</label><select id="project-picker" name="project" defaultValue={project.id}>{projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button type="submit">View</button></form>}
        </header>

        <div className="dash-primary-grid">
          <section className="dash-responsibilities" id="tasks" aria-labelledby="tasks-title"><TaskList tasks={clientTasks} timezone={timezone} /></section>
          <WalkthroughCard />
        </div>

        <section className="dash-detail-grid" aria-label="Project resources and updates">
          <ProjectFiles projectId={project.id} files={files} fileCount={fileCount} canUpload={Boolean(data.canEdit) && !data.demo} demo={Boolean(data.demo)} />
          <section className="dash-info-card" id="activity" aria-labelledby="activity-heading"><div className="dash-card-heading"><div><span className="eyebrow accent">RECENT ACTIVITY</span><h2 id="activity-heading">Latest activity</h2></div><span className="dash-card-icon" aria-hidden="true">↗</span></div>{visibleActivity.length ? visibleActivity.map(item => <div className="dash-activity-item" key={item.id}><span className="dash-activity-dot" aria-hidden="true"/><div><strong>{item.title}</strong><time dateTime={item.created_at}>{formatDate(item.created_at, timezone)}</time></div></div>) : <p className="dash-empty-inline">Project updates will appear here as work progresses.</p>}</section>
          <section className="dash-info-card dash-help-card"><div className="dash-card-heading"><div><span className="eyebrow accent">HERE TO HELP</span><h2>Need a hand?</h2></div><span className="dash-card-icon" aria-hidden="true">?</span></div><p>Questions or need support? Get in touch with your TZ Digital team.</p><a href="/#kontakt">Contact your team <span aria-hidden="true">↗</span></a></section>
        </section>
      </>}
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team ↗</a></footer>
    </div>
  </main>
}
