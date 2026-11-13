import Image from 'next/image'
import { logout } from '@/app/login/actions'
import { type DashboardData, formatDate, statusLabel } from '@/lib/dashboard'

function TaskItem({ task, timezone }: { task: DashboardData['tasks'][number], timezone: string }) {
  return <li className="dash-task">
    <span className={`dash-task-icon ${task.status === 'done' ? 'is-done' : ''}`} aria-hidden="true">{task.status === 'done' ? '✓' : ''}</span>
    <div className="dash-task-copy"><strong>{task.href ? <a href={task.href}>{task.title} ↗</a> : task.title}</strong><span>{statusLabel(task.status)}{task.due_at && task.status !== 'done' ? ` · Requested by ${formatDate(task.due_at, timezone)}` : ''}</span></div>
  </li>
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { organization, projects, activeProject: project, tasks, milestones, activity, reviews, fileCount } = data
  const timezone = project?.project_timezone ?? 'Europe/Berlin'
  const clientTasks = tasks.filter(task => task.owner_type === 'client' || task.owner_type === 'shared')
  const agencyTasks = tasks.filter(task => task.owner_type === 'agency')
  const pendingClient = clientTasks.filter(task => task.status !== 'done').sort((a, b) => Number(b.status === 'waiting_client') - Number(a.status === 'waiting_client'))
  const activeReview = reviews.find(review => review.status === 'awaiting_client')
  const nextAction = pendingClient[0]
  const needsYou = Boolean(nextAction || activeReview)
  const currentMilestone = milestones.find(item => item.status === 'current') ?? milestones.find(item => item.status === 'upcoming')

  return <main className="dash-app" id="overview">
    <header className="dash-header">
      <a className="brand dash-brand" href="/dashboard" aria-label="TZ Digital client portal home"><Image src="/tz-mark.png" width={34} height={34} alt="" /><span>TZ <b>Digital</b></span></a>
      <nav aria-label="Portal navigation" className="dash-nav"><a href="#overview" aria-current="page">Overview</a><a href="#milestones">Timeline</a><a href="#tasks">Tasks</a><a href="#activity">Updates</a></nav>
      {data.demo ? <a className="dash-signout" href="/login">Exit preview <span aria-hidden="true">↗</span></a> : <form action={logout}><button className="dash-signout" type="submit">Sign out <span aria-hidden="true">↗</span></button></form>}
    </header>

    {data.demo && <div className="dash-demo-banner" role="note">Preview with synthetic data · No customer information is shown</div>}

    <div className="dash-body">
      <div className="dash-topline"><span className="eyebrow accent">CLIENT WORKSPACE / {organization.toUpperCase()}</span><span className="eyebrow">YOUR PROJECT, ALL IN ONE PLACE</span></div>
      <div className="dash-intro"><div><h1>Good to have<br />you here<span className="dot">.</span></h1><p>One place for your project, decisions, and next steps.</p></div><div className="dash-issue-number" aria-hidden="true">01<span>/</span>TZ</div></div>

      {!project ? <section className="dash-no-project"><span className="eyebrow accent">WORKSPACE READY</span><h2>Your first project will appear here.</h2><p>Your TZ Digital team is setting things up. When they add your project, this page will show its next action, timeline, tasks, and updates.</p><a href="https://tz-digital.de/#kontakt">Contact your team <span aria-hidden="true">↗</span></a></section> : <>
        <section className={`dash-action ${needsYou ? 'needs-you' : ''}`} aria-labelledby="next-action-title">
          <div className="dash-action-icon" aria-hidden="true">↗</div><div className="dash-action-main"><span className="eyebrow">{needsYou ? 'NEXT ACTION FOR YOU' : 'CURRENT STATUS'}</span><h2 id="next-action-title">{nextAction ? nextAction.title : activeReview ? `Review ${activeReview.title}` : 'You’re all caught up.'}</h2><p>{nextAction ? `Your input helps us move to ${project.next_milestone ?? 'the next milestone'}.` : activeReview ? 'Your feedback is needed before we continue with the next revision.' : 'Your TZ Digital team is working on the next step. We’ll update this space when we need you.'}</p></div><a className="dash-action-link" href={nextAction?.href ?? (nextAction ? '#your-tasks' : activeReview ? '#review' : '#activity')}>{nextAction?.href ? 'Open task' : needsYou ? 'See details' : 'See updates'} <span aria-hidden="true">↗</span></a>
        </section>

        <section className="dash-project-summary" aria-labelledby="project-title">
          <div className="dash-project-head"><div><span className="eyebrow">CURRENT PROJECT</span><h2 id="project-title">{project.name}</h2><p>{project.summary ?? 'Follow each step with your TZ Digital team.'}</p></div><span className="dash-status"><span className="dash-status-dot" aria-hidden="true" />{statusLabel(project.status)}</span></div>
          {projects.length > 1 && <form method="get" action="/dashboard" className="dash-project-switch"><label htmlFor="project-picker">Switch project</label><select id="project-picker" name="project" defaultValue={project.id}>{projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button type="submit">View</button></form>}
          <div className="dash-project-meta"><span>{project.service.toUpperCase()} PROJECT</span><span>{organization}</span><span>Updated {formatDate(project.updated_at, timezone)}</span></div>
        </section>

        <div className="dash-section-grid"><section className="dash-timeline" id="milestones" aria-labelledby="timeline-title"><div className="dash-section-heading"><div><span className="eyebrow accent">THE ROAD AHEAD</span><h2 id="timeline-title">Project timeline</h2></div><span>{milestones.length.toString().padStart(2, '0')} STEPS</span></div>
          {milestones.length ? <ol className="dash-milestones">{milestones.map((item, index) => <li className={`dash-milestone is-${item.status}`} key={item.id}><span className="dash-milestone-index">{item.status === 'complete' ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.window_label ?? statusLabel(item.status)}</small></div><span className="dash-milestone-state">{item.status}</span></li>)}</ol> : <p className="dash-empty-inline">Your team will share the milestone plan here.</p>}
          <div className="dash-timeline-foot"><div><span>UP NEXT</span><strong>{currentMilestone?.title ?? project.next_milestone ?? 'To be confirmed'}</strong></div><div><span>ESTIMATED LAUNCH</span><strong>{project.target_window ?? 'Pending project plan'}</strong></div></div><p className="dash-estimate-note">Timing is an estimate and may change when tasks or approvals change.</p>
        </section>
        <aside className="dash-side"><section className="dash-mini" id="review"><div className="dash-mini-top"><span className="eyebrow accent">REVIEW</span><span className="dash-mini-glyph" aria-hidden="true">○</span></div><h3>{activeReview ? activeReview.title : reviews[0] ? reviews[0].title : 'No review requested yet'}</h3><p>{activeReview ? `Your feedback is requested${activeReview.due_at ? ` by ${formatDate(activeReview.due_at, timezone)}` : ''}.` : reviews[0] ? `Status: ${statusLabel(reviews[0].status)}.` : 'We’ll let you know when a draft is ready for you.'}</p></section><section className="dash-mini"><div className="dash-mini-top"><span className="eyebrow accent">FILES</span><span className="dash-mini-glyph" aria-hidden="true">○</span></div><h3>{fileCount} {fileCount === 1 ? 'file' : 'files'} in your project</h3><p>{fileCount ? 'Shared files are recorded for this project.' : 'Files shared with your team will appear here.'}</p></section></aside></div>

        <section className="dash-responsibilities" id="tasks" aria-labelledby="tasks-title"><div className="dash-section-heading"><div><span className="eyebrow accent">WHO DOES WHAT</span><h2 id="tasks-title">Moving forward, together.</h2></div><span>{tasks.filter(task => task.status !== 'done').length.toString().padStart(2, '0')} OPEN TASKS</span></div><div className="dash-responsibility-grid"><div id="your-tasks"><div className="dash-column-heading"><h3>Your side</h3><span>{clientTasks.length.toString().padStart(2, '0')}</span></div>{clientTasks.length ? <ul>{clientTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} />)}</ul> : <p className="dash-empty-inline">No client tasks right now.</p>}</div><div><div className="dash-column-heading"><h3>Our side</h3><span>{agencyTasks.length.toString().padStart(2, '0')}</span></div>{agencyTasks.length ? <ul>{agencyTasks.map(task => <TaskItem key={task.id} task={task} timezone={timezone} />)}</ul> : <p className="dash-empty-inline">Your TZ Digital team will add its next tasks here.</p>}</div></div></section>

        <section className="dash-activity" id="activity" aria-labelledby="activity-title"><div className="dash-section-heading"><div><span className="eyebrow accent">STAY IN THE LOOP</span><h2 id="activity-title">Latest updates</h2></div><span>PROJECT ACTIVITY</span></div>{activity.length ? <ol className="dash-activity-list">{activity.map(item => <li key={item.id}><span className="dash-activity-marker" aria-hidden="true"/><div><span className="eyebrow">{item.actor_type.toUpperCase()} · {formatDate(item.created_at, timezone)}</span><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}</div></li>)}</ol> : <p className="dash-empty-inline">Project updates will appear here as work progresses.</p>}</section>
      </>}
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="https://tz-digital.de/#kontakt">Need help? Contact your team ↗</a></footer>
    </div>
  </main>
}
