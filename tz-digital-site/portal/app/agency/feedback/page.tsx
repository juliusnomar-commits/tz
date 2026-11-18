import Link from 'next/link'
import { redirect } from 'next/navigation'
import { userClient } from '@/lib/supabase'
import { updateFeedbackTriage } from './actions'

export const dynamic = 'force-dynamic'

type Search = { client?: string; page?: string; type?: string }
type Activity = { id: string; project_id: string; title: string; detail: string | null; actor_type: string; created_at: string }
type SiteReview = { project_id: string; page_key: string; pins: unknown; changes: unknown; images: unknown; colors: unknown; status: string; version: number; updated_at: string }
type Project = { id: string; tenant_id: string; name: string }
const validTypes = ['all', 'comments', 'pins', 'changes'] as const
const count = (v: unknown) => v && typeof v === 'object' ? Object.keys(v).length : 0
const pins = (v: unknown): Array<{ id?: string; comment?: string; x?: number; y?: number }> => Array.isArray(v) ? v.filter(p => p && typeof p === 'object') : []
const date = (v: string) => new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AgencyFeedbackPage({ searchParams }: { searchParams: Promise<Search> }) {
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: memberships, error: membershipError } = await supabase.from('portal_memberships')
    .select('tenant_id, role').eq('user_id', auth.user.id)
  if (membershipError) throw membershipError
  // Agency privileges are checked at the server, before any cross-project query.
  const tenantIds = [...new Set((memberships ?? []).filter(m => ['agency_owner', 'agency_admin', 'agency_member'].includes(m.role)).map(m => m.tenant_id))]
  if (!tenantIds.length) redirect('/dashboard')
  const { client = '', page = '', type = 'all' } = await searchParams
  const kind = validTypes.includes(type as typeof validTypes[number]) ? type : 'all'
  const { data: projectData, error: projectError } = await supabase.from('portal_projects')
    .select('id, tenant_id, name').in('tenant_id', tenantIds).order('name')
  if (projectError) throw projectError
  const projects = (projectData ?? []) as Project[]
  const filteredProjects = client ? projects.filter(p => p.id === client) : projects
  const projectIds = filteredProjects.map(p => p.id)
  const projectMap = new Map(projects.map(p => [p.id, p]))
  let activities: Activity[] = []
  let reviews: SiteReview[] = []
  if (projectIds.length) {
    const [activityResult, reviewResult] = await Promise.all([
      supabase.from('portal_activity').select('id, project_id, title, detail, actor_type, created_at')
        .in('project_id', projectIds).like('title', 'Site review comment ·%')
        .order('created_at', { ascending: false }).limit(250),
      supabase.from('portal_site_pages').select('project_id, page_key, pins, changes, images, colors, status, version, updated_at')
        .in('project_id', projectIds).order('updated_at', { ascending: false }).limit(250),
    ])
    if (activityResult.error) throw activityResult.error
    if (reviewResult.error) throw reviewResult.error
    activities = (activityResult.data ?? []) as Activity[]
    reviews = (reviewResult.data ?? []) as SiteReview[]
  }
  // Workflow metadata is stored separately so original client submissions remain unchanged.
  const { data: triageData, error: triageError } = projectIds.length ? await supabase.from('portal_feedback_triage')
    .select('project_id,feedback_key,status,internal_note').in('project_id',projectIds) : { data: [], error: null }
  if (triageError) throw triageError
  const triage = new Map((triageData ?? []).map(t => [t.project_id + ':' + t.feedback_key,t]))
  const entries = [
    ...(kind === 'all' || kind === 'comments' ? activities.filter(a => !page || a.title.endsWith(' · ' + page)).map(a => ({
      id: 'comment-' + a.id, projectId: a.project_id, page: a.title.split(' · ').slice(1).join(' · '),
      kind: 'Comment', body: a.detail || '', status: 'Received', createdAt: a.created_at,
    })) : []),
    ...(kind === 'all' || kind === 'pins' ? reviews.flatMap(r => pins(r.pins).filter(p => !page || r.page_key === page).map((p, i) => ({
      id: 'pin-' + r.project_id + '-' + r.page_key + '-' + (p.id || i), projectId: r.project_id, page: r.page_key,
      kind: 'Pinned feedback', body: (p.comment || '') + (Number.isFinite(p.x) && Number.isFinite(p.y) ? ' (' + p.x + ', ' + p.y + ')' : ''),
      status: r.status, createdAt: r.updated_at,
    }))) : []),
    ...(kind === 'all' || kind === 'changes' ? reviews.filter(r => (!page || r.page_key === page) && r.status !== 'draft' && (count(r.changes) + count(r.images) + count(r.colors)) > 0).map(r => ({
      id: 'change-' + r.project_id + '-' + r.page_key, projectId: r.project_id, page: r.page_key,
      kind: 'Submitted changes', body: [count(r.changes) + ' text', count(r.images) + ' images', count(r.colors) + ' colors'].join(' · '),
      status: r.status, createdAt: r.updated_at,
    })) : []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const pages = [...new Set([...reviews.map(r => r.page_key), ...activities.map(a => a.title.split(' · ').slice(1).join(' · '))])].filter(Boolean).sort()
  const filter = (key: string, value: string) => {
    const p = new URLSearchParams({ client, page, type: kind })
    if (value) p.set(key, value)
    else p.delete(key)
    return '/agency/feedback?' + p.toString()
  }
  const folder = (stamp: string) => {
    const d = new Date(stamp), now = new Date()
    const today = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
    const day = Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())
    const gap = Math.floor((today-day)/86400000)
    return gap === 0 ? 'Today' : gap === 1 ? 'Yesterday' : gap < 7 && gap >= 0 ? 'Earlier this week' :
      d.toLocaleDateString('en-GB',{year:'numeric',month:'long',timeZone:'UTC'})
  }
  const groups = new Map<string,typeof entries>()
  for (const item of entries) { const key = folder(item.createdAt); groups.set(key,[...(groups.get(key) ?? []),item]) }
  return <main style={{ minHeight: '100vh', padding: '36px clamp(18px, 5vw, 84px)', background: '#140e25', color: '#f3efff', fontFamily: 'inherit' }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <Link href="/agency" style={{ color: '#cdb4fa' }}>← Agency overview</Link>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Agency feedback inbox</h1>
      <p style={{ color: '#b8aacb', marginTop: 0 }}>{entries.length} matching items across {filteredProjects.length} authorized projects</p>
      <nav aria-label="Feedback filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0' }}>
        <span>Client filters are available below</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['all', 'comments', 'pins', 'changes'] as const).map(t => <Link key={t} href={filter('type', t)} style={{ background: kind === t ? '#8063bd' : '#2b2043', color: '#fff', borderRadius: 20, padding: '7px 14px', textDecoration: 'none' }}>{t}</Link>)}
        </span>
      </nav>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}><Link href={filter('client', '')}>All clients</Link>{projects.map(p => <Link key={p.id} href={filter('client', p.id)} style={{ color: client === p.id ? '#fff' : '#bda4ed' }}>{p.name}</Link>)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}><Link href={filter('page', '')}>All pages</Link>{pages.map(p => <Link key={p} href={filter('page', p)} style={{ color: page === p ? '#fff' : '#bda4ed' }}>{p}</Link>)}</div>
      <section aria-label="Feedback entries" style={{ display: 'grid', gap: 14 }}>
        {entries.length === 0 && <p>No matching feedback found in the accessible projects.</p>}
        {[...groups].map(([group,items]) => <details key={group} open={group==='Today'||group==='Yesterday'} style={{ border:'1px solid #46325f',borderRadius:14,padding:16 }}>
          <summary style={{cursor:'pointer',fontWeight:650,marginBottom:12}}>▸ {group} ({items.length})</summary>
          <div style={{display:'grid',gap:12}}>{items.map(item => {
            const saved = triage.get(item.projectId + ':' + item.id)
            return <article key={item.id} style={{ border: '1px solid #46325f', borderRadius: 14, padding: 20, background: '#211733' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <strong>{projectMap.get(item.projectId)?.name || 'Project'} · {item.page}</strong>
                <span style={{ color: '#cbbbe0' }}>{item.kind} · {item.status}</span>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body || 'No message provided'}</p>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <small style={{ color: '#b8aacb' }}>{date(item.createdAt)}</small>
                <Link href={`/projects/${item.projectId}/content`} style={{ color: '#cdb4fa' }}>Open website editor</Link>
              </div>
              <form action={updateFeedbackTriage} style={{marginTop:16,paddingTop:14,borderTop:'1px solid #493a5d',display:'grid',gap:8}}>
                <input name="projectId" type="hidden" value={item.projectId}/>
                <input name="feedbackKey" type="hidden" value={item.id}/>
                <label htmlFor={'status-'+item.id} style={{fontSize:12,color:'#b8aacb'}}>Internal workflow status</label>
                <select id={'status-'+item.id} name="status" defaultValue={saved?.status ?? 'new'} style={{padding:8,borderRadius:8,background:'#302543',color:'#fff'}}>
                  <option value="new">New</option><option value="in_progress">In progress</option>
                  <option value="needs_client">Needs client response</option><option value="completed">Completed</option>
                </select>
                <label htmlFor={'note-'+item.id} style={{fontSize:12,color:'#b8aacb'}}>Agency note (private)</label>
                <textarea id={'note-'+item.id} name="note" rows={2} maxLength={4000} defaultValue={saved?.internal_note ?? ''} style={{padding:8,borderRadius:8,background:'#302543',color:'#fff'}}/>
                <button type="submit" style={{justifySelf:'start',padding:'8px 16px',borderRadius:8,color:'#fff',background:'#7557ac',border:0,cursor:'pointer'}}>Save status</button>
              </form>
            </article>
          })}</div>
        </details>)}
      </section>
      <p style={{ color: '#a89bbd', marginTop: 24 }}>Agency statuses and notes are stored separately from original feedback. Results are limited to the newest 250 comments and 250 page records per selected scope.</p>
    </div>
  </main>
}
