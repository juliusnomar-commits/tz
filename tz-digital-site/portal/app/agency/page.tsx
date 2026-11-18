import Link from 'next/link'
import { redirect } from 'next/navigation'
import { userClient } from '@/lib/supabase'
import { statusLabel } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

type Project = { id: string; tenant_id: string; name: string; status: string; service: string; updated_at: string; next_milestone: string | null }
type Task = { id: string; project_id: string; title: string; owner_type: string; status: string; due_at: string | null }
type Activity = { id: string; project_id: string; title: string; detail: string | null; created_at: string; actor_type: string }
type Review = { project_id: string; page_key: string; pins: unknown; status: string; updated_at: string; changes: unknown; images: unknown; colors: unknown; submitted_at: string | null }
type InboxItem = { id: string; projectId: string; title: string; detail: string; createdAt: string; type: string }
const count = (v: unknown) => v && typeof v === 'object' ? Object.keys(v).length : 0
const box = { padding: 22, background: '#211a34', border: '1px solid #443558', borderRadius: 16 } as const
const small = { color: '#bdb0d3', fontSize: 13 } as const
const link = { color: '#d7c1ff', textDecoration: 'none' } as const

function dayGroup(value: string) {
  const day = new Date(value)
  const now = new Date()
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const item = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  const days = Math.floor((midnight - item) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7 && days >= 0) return 'Earlier this week'
  return day.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default async function AgencyDashboard() {
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: members, error: memberError } = await supabase.from('portal_memberships')
    .select('tenant_id,role').eq('user_id', auth.user.id)
  if (memberError) throw memberError
  const agencyMembers = members ?? []
  const canCreateClients = agencyMembers.some(m => ['agency_owner', 'agency_admin'].includes(m.role))
  const tenantIds = [...new Set(agencyMembers.filter(m => ['agency_owner', 'agency_admin', 'agency_member'].includes(m.role)).map(m => m.tenant_id))]
  if (!tenantIds.length) redirect('/dashboard')

  const { data: projectData, error: projectError } = await supabase.from('portal_projects')
    .select('id, tenant_id, name, status, service, updated_at, next_milestone')
    .in('tenant_id', tenantIds).order('updated_at', { ascending: false })
  if (projectError) throw projectError
  const projects = (projectData ?? []) as Project[]
  const ids = projects.map(p => p.id)
  let tasks: Task[] = [], activity: Activity[] = [], reviews: Review[] = []
  if (ids.length) {
    const [t, a, r] = await Promise.all([
      supabase.from('portal_tasks').select('id,project_id,title,owner_type,status,due_at').in('project_id', ids).neq('status','archived').limit(1000),
      supabase.from('portal_activity').select('id,project_id,title,detail,created_at,actor_type').in('project_id', ids)
        .like('title','Site review comment ·%').order('created_at',{ascending:false}).limit(250),
      supabase.from('portal_site_pages').select('project_id,page_key,pins,status,updated_at,changes,images,colors,submitted_at')
        .in('project_id', ids).order('updated_at',{ascending:false}).limit(250),
    ])
    for (const result of [t,a,r]) if (result.error) throw result.error
    tasks = (t.data ?? []) as Task[]
    activity = (a.data ?? []) as Activity[]
    reviews = (r.data ?? []) as Review[]
  }
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const agencyTasks = activeTasks.filter(t => t.owner_type === 'agency' || t.owner_type === 'shared')
  const clientTasks = activeTasks.filter(t => t.owner_type === 'client')
  const projectNames = new Map(projects.map(p => [p.id, p.name]))
  const inbox: InboxItem[] = [
    ...activity.map(a => ({id: a.id,projectId:a.project_id,title:a.title,detail:a.detail ?? '',createdAt:a.created_at,type:'Comment'})),
    ...reviews.flatMap(r => (Array.isArray(r.pins) ? r.pins : []).filter(p => p && typeof p === 'object').map((p: {id?:string;comment?:string},i:number) => ({
      id:`${r.project_id}-${r.page_key}-${p.id ?? i}`,projectId:r.project_id,title:`Pin · ${r.page_key}`,
      detail:p.comment ?? '',createdAt:r.submitted_at ?? r.updated_at,type:'Pin'
    }))),
    ...reviews.filter(r => r.status === 'submitted' && (count(r.changes)+count(r.images)+count(r.colors)>0)).map(r => ({
      id:`${r.project_id}-${r.page_key}-changes`,projectId:r.project_id,title:`Edits · ${r.page_key}`,
      detail:`${count(r.changes)} text · ${count(r.images)} images · ${count(r.colors)} colors`,
      createdAt:r.submitted_at ?? r.updated_at,type:'Edit request'
    }))
  ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const grouped = new Map<string,InboxItem[]>()
  inbox.forEach(item => { const k=dayGroup(item.createdAt); grouped.set(k,[...(grouped.get(k) ?? []),item]) })
  const outstanding = reviews.filter(r => r.status === 'submitted').length
  return <main style={{minHeight:'100vh',background:'#140e25',color:'#f7f3ff',padding:'32px clamp(18px, 5vw, 72px)',fontFamily:'inherit'}}>
    <div style={{maxWidth:1280,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:28}}>
        <div><p style={{...small,letterSpacing:2,textTransform:'uppercase'}}>TZ DIGITAL · PRIVATE WORKSPACE</p><h1 style={{fontSize:32,margin:'6px 0'}}>Agency overview</h1><p style={small}>Clients, website progress and everything needing attention.</p></div>
        <nav aria-label="Agency navigation" style={{display:'flex',gap:16}}><Link href="/agency" style={link}>Overview</Link><Link href="/agency/feedback" style={link}>Feedback inbox</Link>{canCreateClients && <Link href="/agency/clients/new" style={link}>New client</Link>}<Link href="/dashboard" style={link}>Client portal</Link><Link href="/agency/password" style={link}>Change password</Link></nav>
      </header>
      <section aria-label="Summary" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:28}}>
        {[['Active projects',projects.length],['Agency tasks',agencyTasks.length],['Waiting on clients',clientTasks.length],['Submitted reviews',outstanding]].map(([label,value])=><div key={label} style={box}><div style={small}>{label}</div><div style={{fontSize:32,fontWeight:750,marginTop:10}}>{value}</div></div>)}
      </section>
      <section style={{...box,marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0,fontSize:21}}>Clients & project stages</h2><span style={small}>{projects.length} accessible projects</span></div>
        <div style={{overflowX:'auto',marginTop:16}}>
          <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
            <thead><tr>{['Client','Stage','Next milestone','Open tasks','Action'].map(h=><th key={h} style={{...small,padding:'12px 8px',borderBottom:'1px solid #493a5d'}}>{h}</th>)}</tr></thead>
            <tbody>{projects.map(p=><tr key={p.id}>
              <td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a'}}>{p.name}</td>
              <td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a'}}>{statusLabel(p.status)}</td>
              <td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a',color:'#bdb0d3'}}>{p.next_milestone ?? '—'}</td>
              <td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a'}}>{activeTasks.filter(t=>t.project_id===p.id).length}</td>
              <td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a'}}><Link href={`/dashboard?project=${encodeURIComponent(p.id)}`} style={link}>View project</Link></td>
            </tr>)}</tbody>
          </table>{!projects.length && <p style={small}>No agency-accessible client projects found.</p>}
        </div>
      </section>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,390px),1fr))',gap:24}}>
        <section style={box}><h2 style={{marginTop:0,fontSize:21}}>What needs doing</h2>
          <h3 style={{fontSize:15,color:'#d2c0ed'}}>Waiting on TZ Digital ({agencyTasks.length})</h3>
          {agencyTasks.slice(0,12).map(t=><p key={t.id} style={{borderBottom:'1px solid #382b4a',paddingBottom:10}}><Link style={link} href={`/projects/${t.project_id}/tasks`}>{t.title}</Link><br/><span style={small}>{projectNames.get(t.project_id)}</span></p>)}
          {!agencyTasks.length && <p style={small}>No outstanding agency tasks.</p>}
          <h3 style={{fontSize:15,color:'#d2c0ed'}}>Waiting on clients ({clientTasks.length})</h3>
          {clientTasks.slice(0,12).map(t=><p key={t.id} style={{borderBottom:'1px solid #382b4a',paddingBottom:10}}>{t.title}<br/><span style={small}>{projectNames.get(t.project_id)}</span></p>)}
          {!clientTasks.length && <p style={small}>No outstanding client tasks.</p>}
        </section>
        <section style={box}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><h2 style={{margin:0,fontSize:21}}>Client feedback</h2><Link href="/agency/feedback" style={link}>All feedback</Link></div>
          <p style={small}>Organized by submission date · newest first</p>
          {[...grouped].slice(0,5).map(([group,items])=><details key={group} open={group==='Today'||group==='Yesterday'} style={{borderTop:'1px solid #493a5d',padding:'14px 0'}}>
            <summary style={{cursor:'pointer',fontWeight:650}}>▸ {group} · {items.length} items</summary>
            {items.slice(0,12).map(item=><div key={item.id} style={{padding:'12px 0 8px 14px',borderBottom:'1px solid #332742'}}>
              <div style={small}>{projectNames.get(item.projectId)} · {item.type}</div>
              <div style={{margin:'4px 0'}}>{item.title}</div>
              <p style={{...small,margin:'4px 0 8px',overflowWrap:'anywhere'}}>{item.detail}</p>
              <Link href={`/projects/${item.projectId}/content`} style={link}>Open editor</Link>
            </div>)}
          </details>)}
          {!inbox.length && <p style={small}>No comments or submitted edits yet.</p>}
          {inbox.length > 0 && <p style={small}>Showing recent feedback. Open the full inbox for filters and older entries.</p>}
        </section>
      </div>
    </div>
  </main>
}
