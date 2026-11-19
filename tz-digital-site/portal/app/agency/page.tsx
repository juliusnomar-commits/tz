import Link from 'next/link'
import { redirect } from 'next/navigation'
import { agencyFeedback } from '@/lib/agency-feedback'
import { statusLabel } from '@/lib/dashboard'
import { userClient } from '@/lib/supabase'

export const dynamic='force-dynamic'
const box={padding:22,background:'#211a30',border:'1px solid #49395d',borderRadius:16} as const
const muted={color:'#bdb0d3',fontSize:13} as const
const link={color:'#d5b7ff',textDecoration:'none'} as const
const date=(s:string)=>new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})

export default async function AgencyOverview(){
  const {authorized,projects}=await agencyFeedback()
  if(!authorized) redirect('/login')
  const db=await userClient()
  const {data:auth}=await db.auth.getUser()
  const {data:memberships}=await db.from('portal_memberships').select('role').eq('user_id',auth.user!.id)
  const canCreate=(memberships??[]).some(m=>['agency_owner','agency_admin'].includes(m.role))
  const ids=projects.map(p=>p.id)
  const [projectResult,taskResult]=ids.length?await Promise.all([
    db.from('portal_projects').select('id,status,next_milestone,updated_at').in('id',ids),
    db.from('portal_tasks').select('id,project_id,title,owner_type,status').in('project_id',ids).neq('status','archived').limit(1000)
  ]):[{data:[],error:null},{data:[],error:null}]
  if(projectResult.error||taskResult.error) throw projectResult.error??taskResult.error
  const statuses=new Map((projectResult.data??[]).map(p=>[p.id,p]))
  const active=(taskResult.data??[]).filter(t=>t.status!=='done')
  const pending=projects.flatMap(p=>p.items.filter(i=>i.kind==='Pin'||i.kind==='Comment').map(i=>({...i,project:p}))).slice(0,6)
  const feedbackCount=projects.reduce((sum,p)=>sum+p.items.length,0)
  return <main style={{minHeight:'100vh',background:'#120d20',color:'#f7f3ff',padding:'32px clamp(18px,5vw,72px)',fontFamily:'inherit'}}>
    <div style={{maxWidth:1240,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:32}}>
        <div><p style={{...muted,letterSpacing:2,textTransform:'uppercase'}}>TZ DIGITAL · PRIVATE WORKSPACE</p><h1 style={{fontSize:32,margin:'6px 0'}}>Agency overview</h1><p style={muted}>Clients, project progress, and requests needing attention.</p></div>
        <nav aria-label="Agency pages" style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'}}><strong>Overview</strong><Link href="/agency/feedback" style={link}>Feedback Inbox</Link>{canCreate&&<Link href="/agency/clients/new" style={{...link,background:'#a980e4',color:'#1b102d',padding:'10px 16px',borderRadius:9,fontWeight:700}}>+ New client</Link>}</nav>
      </header>
      <section aria-label="Summary" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:24}}>
        {([['Active clients',projects.length],['Feedback items',feedbackCount],['Agency tasks',active.filter(t=>t.owner_type==='agency').length],['Waiting on clients',active.filter(t=>t.owner_type==='client').length]] as const).map(([label,value])=><div key={label} style={box}><div style={muted}>{label}</div><strong style={{fontSize:32,display:'block',marginTop:8}}>{value}</strong></div>)}
      </section>
      <section style={{...box,marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><h2 style={{fontSize:21,margin:0}}>Clients & project stages</h2><span style={muted}>{projects.length} projects</span></div>
        {!projects.length&&<p style={muted}>No client projects yet. Create a client workspace to get started.</p>}
        <div style={{display:'grid',gap:12,marginTop:16}}>{projects.map(p=>{
          const project=statuses.get(p.id)
          return <article key={p.id} style={{padding:18,background:'#2a203a',border:'1px solid #49395d',borderRadius:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,flexWrap:'wrap'}}>
            <div><h3 style={{margin:'0 0 6px'}}>{p.name}</h3><span style={muted}>{project?statusLabel(project.status):'Project'} · {project?.next_milestone??'Next milestone to be set'} · Updated {project?date(project.updated_at):'—'}</span></div>
            <div style={{display:'flex',gap:16,alignItems:'center'}}><span style={muted}>{p.items.length} feedback items · {active.filter(t=>t.project_id===p.id).length} open tasks</span><Link href={'/agency/feedback?project='+encodeURIComponent(p.id)} style={{...link,fontWeight:700}}>Open feedback →</Link></div>
          </article>
        })}</div>
      </section>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,420px),1fr))',gap:20}}>
        <section style={box}><h2 style={{fontSize:21,marginTop:0}}>Needs attention</h2><p style={muted}>Recent comments and pinned requests from clients.</p>
          {pending.map(i=><div key={i.id} style={{borderTop:'1px solid #49395d',padding:'13px 0'}}><Link href={'/agency/feedback?project='+encodeURIComponent(i.projectId)} style={{...link,fontWeight:650}}>{i.body||'Pinned request'}</Link><div style={muted}>{i.project.name} · {i.page} · {date(i.createdAt)}</div></div>)}
          {!pending.length&&<p style={muted}>No comments or pinned requests yet.</p>}
        </section>
        <section style={box}><h2 style={{fontSize:21,marginTop:0}}>Project work</h2>
          <h3 style={{fontSize:15,color:'#d5b7ff'}}>TZ Digital ({active.filter(t=>t.owner_type==='agency').length})</h3>
          {active.filter(t=>t.owner_type==='agency').slice(0,6).map(t=><p key={t.id} style={{borderTop:'1px solid #49395d',paddingTop:10}}>{t.title}<br/><span style={muted}>{projects.find(p=>p.id===t.project_id)?.name}</span></p>)}
          {!active.some(t=>t.owner_type==='agency')&&<p style={muted}>No outstanding agency tasks.</p>}
          <h3 style={{fontSize:15,color:'#d5b7ff'}}>Waiting on clients ({active.filter(t=>t.owner_type==='client').length})</h3>
          {active.filter(t=>t.owner_type==='client').slice(0,6).map(t=><p key={t.id} style={{borderTop:'1px solid #49395d',paddingTop:10}}>{t.title}<br/><span style={muted}>{projects.find(p=>p.id===t.project_id)?.name}</span></p>)}
          {!active.some(t=>t.owner_type==='client')&&<p style={muted}>No client tasks waiting.</p>}
        </section>
      </div>
      <footer style={{...muted,marginTop:28}}><Link href="/agency/password" style={link}>Account settings</Link></footer>
    </div>
  </main>
}
