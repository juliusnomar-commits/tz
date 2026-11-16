import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/app/dashboard/portal-sidebar'
import type { DashboardActivity } from '@/lib/dashboard'
import { formatDate } from '@/lib/dashboard'
import { projectAccess } from '@/lib/project-access'

export const dynamic = 'force-dynamic'

export default async function UpdatesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) redirect('/login')
  const { data, error } = await access.supabase.from('portal_activity').select('id, title, detail, actor_type, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  const activity = (data ?? []) as DashboardActivity[]
  return <main className="dash-shell">
    <PortalSidebar projectId={projectId} projectName={access.project.name} active="updates" />
    <div className="dash-main">
      <header className="dash-page-heading"><span className="eyebrow accent">RECENT ACTIVITY</span><h1>Updates</h1><p>Recent work and notes for {access.project.name}.</p></header>
      <section className="dash-page-card dash-updates-card" aria-label="Project activity">
        {activity.length ? <ol className="dash-updates-list">{activity.map(item => <li key={item.id}>
          <span className="dash-activity-dot" aria-hidden="true" />
          <div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}<time dateTime={item.created_at}>{formatDate(item.created_at, 'Europe/Berlin')}</time></div>
          {/(comment|preview|review|site editor|home changes)/i.test(`${item.title} ${item.detail ?? ''}`) && <a className="dash-task-action" href={`/projects/${projectId}/content`}>Open preview &amp; comments <span aria-hidden="true">↗</span></a>}
        </li>)}</ol> : <p className="dash-empty-inline">Project updates will appear here as work progresses.</p>}
        <a className="dash-card-link" href={`/projects/${projectId}/content`}>Open website preview &amp; comments <span aria-hidden="true">↗</span></a>
      </section>
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team ↗</a></footer>
    </div>
  </main>
}
