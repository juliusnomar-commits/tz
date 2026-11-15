import Image from 'next/image'
import type { CSSProperties } from 'react'
import { logout } from '@/app/login/actions'
import { type DashboardData, formatDate, statusLabel } from '@/lib/dashboard'

function TaskItem({ task, timezone }: { task: DashboardData['tasks'][number], timezone: string }) {
  const complete = task.status === 'done'

  return <li className={`dash-task ${complete ? 'is-complete' : ''}`}>
    <span className="dash-task-icon" aria-hidden="true">{complete ? '✓' : ''}</span>
    <div className="dash-task-copy">
      <strong>{task.title}</strong>
      <span>{statusLabel(task.status)}{task.progressPercent !== undefined ? ` · ${task.progressPercent}% complete` : ''}{task.due_at && !complete ? ` · Due ${formatDate(task.due_at, timezone)}` : ''}</span>
      {task.progressPercent !== undefined && <div className="dash-task-progress" role="progressbar" aria-label="Website intake progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progressPercent}><i style={{ width: `${task.progressPercent}%` }} /></div>}
    </div>
    {!complete && task.href && <a className="dash-task-action" href={task.href}>To do <span aria-hidden="true">→</span></a>}
  </li>
}

function TaskList({ title, tasks, timezone }: { title: string, tasks: DashboardData['tasks'], timezone: string }) {
  const uniqueTasks = tasks.filter((task, index, all) => all.findIndex(item => item.title.trim().toLowerCase() === task.title.trim().toLowerCase()) === index)
  const todoTasks = uniqueTasks.filter(task => task.status !== 'done')
  const completedTasks = uniqueTasks.filter(task => task.status === 'done')

  return <div className="dash-task-list">
    <h3>{title}</h3>
    {todoTasks.length ? <ul>{todoTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} />)}</ul> : <p className="dash-empty-inline">Nothing to do right now.</p>}
    {completedTasks.length > 0 && <details className="dash-completed-tasks"><summary>{completedTasks.length} completed</summary><ul>{completedTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} />)}</ul></details>}
  </div>
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { organization, projects, activeProject: project, tasks, milestones, activity, reviews, fileCount } = data
  const timezone = project?.project_timezone ?? 'Europe/Berlin'
  const clientTasks = tasks.filter(task => task.owner_type === 'client' || task.owner_type === 'shared')
  const agencyTasks = tasks.filter(task => task.owner_type === 'agency')
  const activeReview = reviews.find(review => review.status === 'awaiting_client')
  const pendingAgencyTasks = agencyTasks.filter(task => task.status !== 'done')
  const currentMilestoneIndex = milestones.findIndex(item => item.status === 'current')
  const upcomingMilestoneIndex = currentMilestoneIndex >= 0 ? currentMilestoneIndex : milestones.findIndex(item => item.status === 'upcoming')
  const completedMilestones = milestones.filter(item => item.status === 'complete').length
  const progress = milestones.length ? Math.round(completedMilestones / milestones.length * 100) : 0
  const visibleActivity = activity.filter((item, index, all) => all.findIndex(other => `${other.title}|${other.detail ?? ''}|${other.created_at.slice(0, 10)}` === `${item.title}|${item.detail ?? ''}|${item.created_at.slice(0, 10)}`) === index).slice(0, 3)

  return <main className="dash-app" id="overview">
    <header className="dash-header portal-pill-header">
      <a className="portal-pill-logo" href="/dashboard" aria-label="TZ Digital client portal home"><span>TZ</span> Digital</a>
      <nav aria-label="Portal navigation" className="dash-nav portal-pill-links"><a href="#overview" aria-current="page">Overview</a><a href="#milestones">Timeline</a><a href="#tasks">To do</a><a href="#activity">Updates</a></nav>
      <div className="portal-pill-side"><a className="dash-signout portal-pill-action" href="/">Home <span aria-hidden="true">↗</span></a></div>
    </header>

    {data.demo && <div className="dash-demo-banner" role="note">Preview with synthetic data · No customer information is shown · <a href="/demo/cato">Try the Cato site editor ↗</a></div>}

    <div className="dash-body">
      {!project ? <section className="dash-no-project"><span className="eyebrow accent">WORKSPACE READY</span><h1>Your first project will appear here.</h1><p>Your TZ Digital team is setting things up. When they add your project, this page will show its timeline, next steps, and updates.</p><a href="/#kontakt">Contact your team <span aria-hidden="true">↗</span></a></section> : <>
        <section className="dash-project-summary" aria-labelledby="project-title">
          {data.demo && <div className="dash-project-art" aria-hidden="true"><Image src="/roundabout-demo-terrace.jpg" width={800} height={620} alt="" /><span>THE ROUNDABOUT / MAASTRICHT</span></div>}
          <div className="dash-project-heading"><div><span className="eyebrow accent">YOUR PROJECT</span><h1 id="project-title">{project.name}</h1>{project.summary && <p>{project.summary}</p>}</div><span className="dash-status"><span className="dash-status-dot" aria-hidden="true" />{statusLabel(project.status)}</span></div>
          {projects.length > 1 && <form method="get" action="/dashboard" className="dash-project-switch"><label htmlFor="project-picker">Switch project</label><select id="project-picker" name="project" defaultValue={project.id}>{projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button type="submit">View</button></form>}
          <div className="dash-project-meta"><span>{project.service.toUpperCase()} PROJECT</span><span>{organization}</span><span>Updated {formatDate(project.updated_at, timezone)}</span><span>{progress}% complete</span></div>
          {project.service === 'website' && <div className="dash-project-tools"><a href={data.demo ? '/demo/intake' : `/projects/${project.id}/intake`}>Website intake ↗</a><a href={data.demo ? '/demo/content' : `/projects/${project.id}/content`}>Edit website content ↗</a></div>}
        </section>

        <section className="dash-timeline" id="milestones" aria-labelledby="timeline-title">
          <div className="dash-section-heading"><div><span className="eyebrow accent">WHERE WE ARE</span><h2 id="timeline-title">Project timeline</h2></div><span>{completedMilestones} of {milestones.length} complete</span></div>
          {milestones.length ? <ol className="dash-milestones" style={{ '--milestone-count': milestones.length } as CSSProperties}>{milestones.map((item, index) => <li className={`dash-milestone is-${item.status} ${index === upcomingMilestoneIndex ? 'is-next' : ''}`} key={item.id}><span className="dash-milestone-index" aria-hidden="true">{item.status === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.window_label ?? statusLabel(item.status)}</small></div></li>)}</ol> : <p className="dash-empty-inline">Your team will share the milestone plan here.</p>}
          <div className="dash-timeline-foot"><div><span>UP NEXT</span><strong>{milestones[upcomingMilestoneIndex]?.title ?? project.next_milestone ?? 'To be confirmed'}</strong></div><div><span>ESTIMATED LAUNCH</span><strong>{project.target_window ?? 'Pending project plan'}</strong></div><div className="dash-team-next"><span>TZ DIGITAL’S NEXT STEP</span>{pendingAgencyTasks.length ? <><strong>{pendingAgencyTasks[0].title}</strong>{pendingAgencyTasks[0].status !== 'todo' && <small>{statusLabel(pendingAgencyTasks[0].status)}</small>}{pendingAgencyTasks.length > 1 && <details><summary>See {pendingAgencyTasks.length - 1} more team steps</summary><ul>{pendingAgencyTasks.slice(1).map(task => <li key={task.id}>{task.title} · {statusLabel(task.status)}</li>)}</ul></details>}</> : <strong>Your team will add its next step here.</strong>}</div></div>
          <p className="dash-estimate-note">Timing is an estimate and may change when tasks or approvals change.</p>
        </section>

        <div className="dash-work-grid">
          <section className="dash-responsibilities" id="tasks" aria-labelledby="tasks-title"><div className="dash-section-heading"><div><span className="eyebrow accent">WHAT YOU NEED TO DO</span><h2 id="tasks-title">To do</h2></div></div><div className="dash-responsibility-grid"><TaskList title="Your part" tasks={clientTasks} timezone={timezone} /></div></section>

          <section className="dash-howto" aria-labelledby="howto-title"><div className="dash-section-heading"><div><span className="eyebrow accent">NEW TO THE PORTAL?</span><h2 id="howto-title">How it works</h2></div></div><p>A short guide to your project portal.</p><div className="dash-video-placeholder" role="img" aria-label="Space reserved for a project portal walkthrough video"><span className="dash-play-icon" aria-hidden="true">▶</span><span className="dash-video-caption">Walkthrough video coming soon</span></div></section>
        </div>

        <section className="dash-project-details" aria-label="Project details">
          <div id="review"><span className="eyebrow accent">REVIEW</span><strong>{activeReview ? activeReview.title : reviews[0] ? reviews[0].title : 'No review requested yet'}</strong><p>{activeReview ? `Your feedback is requested${activeReview.due_at ? ` by ${formatDate(activeReview.due_at, timezone)}` : ''}.` : reviews[0] ? `Status: ${statusLabel(reviews[0].status)}.` : 'We’ll let you know when a draft is ready for you.'}</p></div>
          <div><span className="eyebrow accent">FILES</span><strong>{fileCount} {fileCount === 1 ? 'file' : 'files'} in your project</strong><p>{fileCount ? 'Shared files are recorded for this project.' : 'Files shared with your team will appear here.'}</p></div>
        </section>

        <section className="dash-activity" id="activity" aria-labelledby="activity-title"><div className="dash-section-heading"><div><span className="eyebrow accent">RECENT ACTIVITY</span><h2 id="activity-title">Updates</h2></div></div>{visibleActivity.length ? <ol className="dash-activity-list">{visibleActivity.map(item => <li key={item.id}><time dateTime={item.created_at}>{formatDate(item.created_at, timezone)}</time><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div></li>)}</ol> : <p className="dash-empty-inline">Project updates will appear here as work progresses.</p>}</section>
      </>}
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team ↗</a>{data.demo ? <a href="/login">Exit preview ↗</a> : <form action={logout}><button type="submit">Sign out</button></form>}</footer>
    </div>
  </main>
}
