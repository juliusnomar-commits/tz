import Image from 'next/image'
import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'
import { userClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) redirect('/login')
  const { data: memberships, error: membershipError } = await supabase.from('portal_memberships').select('tenant_id, role, portal_tenants(name)').eq('user_id', user.id)
  if (membershipError || !memberships?.length) redirect('/login')
  const tenantIds = (memberships ?? []).map((item) => item.tenant_id)
  const { data: projects } = await supabase.from('portal_projects').select('id, tenant_id, name, service, status, next_milestone, target_window').in('tenant_id', tenantIds).order('created_at', { ascending: false })
  const projectIds = (projects ?? []).map((item) => item.id)
  const { data: tasks } = projectIds.length ? await supabase.from('portal_tasks').select('id, project_id, title, status, due_at').in('project_id', projectIds).eq('owner_type', 'client').neq('status', 'done').order('due_at', { ascending: true }).limit(8) : { data: [] }

  return <main className="dashboard">
    <header className="portal-header"><div className="brand"><Image src="/tz-mark.png" width={34} height={34} alt="" /><span>TZ <b>Digital</b></span></div><div className="header-right"><span>CLIENT PORTAL</span><form action={logout}><button type="submit">Sign out</button></form></div></header>
    <div className="dashboard-inner"><div className="dashboard-kicker">YOUR WORKSPACE <span>↗</span></div><h1>Good to have<br />you here<span className="dot">.</span></h1><p className="dashboard-sub">Your projects, next steps, and updates from TZ Digital.</p>
      <div className="dashboard-grid"><section className="dashboard-section"><div className="section-heading"><h2>Projects</h2><span>{(projects ?? []).length.toString().padStart(2, '0')}</span></div>
        {(projects ?? []).length ? <div className="project-list">{projects!.map((project, index) => <article className="project-card" key={project.id}><div className="project-number">{String(index + 1).padStart(2, '0')}</div><div><span className="eyebrow accent">{project.service ?? 'PROJECT'} / {project.status?.replaceAll('_', ' ') ?? 'IN PROGRESS'}</span><h3>{project.name}</h3><p>{project.next_milestone ? `Next: ${project.next_milestone}` : 'Your TZ Digital team will share the next milestone here.'}</p>{project.target_window && <small>Target window: {project.target_window}</small>}</div><span className="project-arrow">↗</span></article>)}</div> : <div className="empty-state"><span className="empty-mark">↗</span><h3>Your space is ready.</h3><p>Your TZ Digital team will add your first project shortly.</p></div>}</section>
        <aside className="dashboard-section next-steps"><div className="section-heading"><h2>Your next steps</h2><span>{(tasks ?? []).length.toString().padStart(2, '0')}</span></div>{(tasks ?? []).length ? <ul className="task-list">{tasks!.map((task) => <li key={task.id}><span className="task-circle" aria-hidden="true"/><div><strong>{task.title}</strong>{task.due_at && <small>Requested by {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(new Date(task.due_at))}</small>}</div></li>)}</ul> : <div className="empty-state compact"><h3>All clear for now.</h3><p>When we need something from you, it will appear here.</p></div>}<div className="support-box"><span className="eyebrow">NEED A HAND?</span><p>We’re here if anything is unclear.</p><a href="https://tz-digital.de/#kontakt">Contact your team ↗</a></div></aside></div>
    </div>
  </main>
}
