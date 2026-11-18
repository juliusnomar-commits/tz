import Link from 'next/link'
import { redirect } from 'next/navigation'
import { agencyFeedback, type FeedbackItem } from '@/lib/agency-feedback'
import { userClient } from '@/lib/supabase'
import { updateFeedbackTriage } from './actions'

export const dynamic = 'force-dynamic'
const panel = {background:'#211a30',border:'1px solid #49395d',borderRadius:16,padding:22} as const
const muted = {color:'#bdb0d3',fontSize:13} as const
const link = {color:'#d5b7ff',textDecoration:'none'} as const
const day = (s:string)=>new Date(s).toISOString().slice(0,10)
const label = (s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})

export default async function Feedback({searchParams}:{searchParams:Promise<{project?:string}>}) {
  const {projects,authorized}=await agencyFeedback()
  if (!authorized) redirect('/login')
  const {project:requested}=await searchParams
  const project=projects.find(p=>p.id===requested)??projects[0]
  const items=project?.items??[]
  const db=await userClient()
  const {data:triageRows,error}=project?await db.from('portal_feedback_triage')
    .select('feedback_key,status,internal_note').eq('project_id',project.id):{data:[],error:null}
  if (error) throw error
  const triage=new Map((triageRows??[]).map(r=>[r.feedback_key,r]))
  const grouped=new Map<string,FeedbackItem[]>()
  items.forEach(i=>{const d=day(i.createdAt);grouped.set(d,[...(grouped.get(d)??[]),i])})
  const zip=(d?:string)=>'/api/agency/feedback?format=zip&project='+encodeURIComponent(project?.id??'')+(d?'&day='+d:'')
  const image=(page:string)=>'/api/agency/feedback?format=image&project='+encodeURIComponent(project?.id??'')+'&page='+encodeURIComponent(page)
  return <main style={{minHeight:'100vh',background:'#120d20',color:'#f7f3ff',padding:'32px clamp(18px,5vw,72px)',fontFamily:'inherit'}}>
    <div style={{maxWidth:1240,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16,marginBottom:32}}>
        <div><p style={{...muted,letterSpacing:2,textTransform:'uppercase'}}>TZ DIGITAL · PRIVATE WORKSPACE</p><h1 style={{fontSize:32,margin:'6px 0'}}>Feedback Inbox</h1><p style={muted}>Client requests, organized by project and day.</p></div>
        <nav aria-label="Agency pages" style={{display:'flex',gap:18,alignItems:'center'}}><Link href="/agency" style={link}>Overview</Link><strong>Feedback Inbox</strong></nav>
      </header>
      <section style={{...panel,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div><label htmlFor="project" style={muted}>PROJECT</label><form action="/agency/feedback" method="get" style={{marginTop:8,display:'flex',gap:8}}>
            <select id="project" name="project" defaultValue={project?.id} style={{background:'#302543',color:'#fff',border:'1px solid #6d5687',borderRadius:9,padding:'10px 14px',minWidth:230}}>
              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select><button style={{background:'#8063bd',color:'#fff',border:0,borderRadius:9,padding:'10px 16px'}}>View</button>
          </form></div>
          {project&&<a href={zip()} style={{...link,background:'#a980e4',color:'#1b102d',fontWeight:700,padding:'12px 18px',borderRadius:9}}>↓ Download project ZIP</a>}
        </div>
        <p style={{...muted,marginBottom:0}}>{project?items.length+' current feedback items · '+grouped.size+' days':'No projects yet'}</p>
      </section>
      {!items.length&&<section style={panel}><h2 style={{marginTop:0}}>All caught up</h2><p style={muted}>Feedback from this client will appear here when they save changes or submit comments.</p></section>}
      <div style={{display:'grid',gap:16}}>
        {[...grouped].map(([date,records])=><details key={date} open={date===[...grouped.keys()][0]} style={panel}>
          <summary style={{cursor:'pointer',fontSize:19,fontWeight:700}}>{label(date)} <span style={{...muted,marginLeft:12}}>{records.length} items</span></summary>
          <div style={{borderTop:'1px solid #49395d',marginTop:18,paddingTop:18}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:14,flexWrap:'wrap',alignItems:'start'}}>
              <div><strong>What the client wants</strong><p style={{...muted,maxWidth:760,lineHeight:1.6}}>{records.map(i=>i.kind==='Saved changes'?i.details.map(d=>d.field).join(', '):i.body).filter(Boolean).join(' · ')||'Saved feedback for this day'}</p></div>
              <a href={zip(date)} style={{...link,border:'1px solid #775d9f',padding:'9px 14px',borderRadius:9}}>↓ Download this day</a>
            </div>
            <div style={{display:'grid',gap:12}}>
              {records.map((item,index)=>{
                const saved=triage.get(item.id)
                return <article key={item.id} style={{...panel,background:'#271d38',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:20}}>
                  <div>
                    <div style={{...muted,textTransform:'uppercase',letterSpacing:1}}>{String(index+1).padStart(2,'0')} · {item.kind} · {item.page}</div>
                    <h3 style={{fontSize:18,margin:'12px 0'}}>{item.kind==='Pin'?(item.body||'Pinned request'):item.kind==='Comment'?'Client comment':'Saved page changes'}</h3>
                    {item.kind!=='Saved changes'&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.body||'No message supplied'}</p>}
                    {item.details.length>0&&<dl>{item.details.map((d,i)=><div key={i} style={{borderTop:'1px solid #49395d',padding:'8px 0'}}><dt style={muted}>{d.field}</dt><dd style={{margin:'4px 0',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{d.value}</dd></div>)}</dl>}
                    {item.pin&&<p style={muted}>Pinned to {item.pin.target||item.page} · {item.pin.x.toFixed(1)}% across, {item.pin.y.toFixed(1)}% down</p>}
                    <small style={muted}>{new Date(item.createdAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} UTC</small>
                  </div>
                  <div>
                    {item.snapshot?<a href={image(item.page)} target="_blank" rel="noreferrer" style={link}><img src={image(item.page)} alt={'Annotated '+item.page+' page with client pins'} style={{width:'100%',maxHeight:270,objectFit:'contain',background:'#140e25',border:'1px solid #49395d',borderRadius:10}}/><span style={{display:'block',marginTop:6,fontSize:12}}>Open full annotated capture ↗</span></a>:<p style={muted}>No page capture attached to this request.</p>}
                    <form action={updateFeedbackTriage} style={{display:'grid',gap:8,marginTop:14}}>
                      <input type="hidden" name="projectId" value={item.projectId}/><input type="hidden" name="feedbackKey" value={item.id}/>
                      <label htmlFor={'status-'+item.id} style={muted}>Internal status</label>
                      <select id={'status-'+item.id} name="status" defaultValue={saved?.status??'new'} style={{padding:9,borderRadius:8,background:'#352848',color:'#fff'}}>
                        <option value="new">New</option><option value="in_progress">In progress</option><option value="needs_client">Needs client response</option><option value="completed">Done</option>
                      </select>
                      <label htmlFor={'note-'+item.id} style={muted}>Private team note</label>
                      <textarea id={'note-'+item.id} name="note" rows={2} maxLength={4000} defaultValue={saved?.internal_note??''} style={{padding:9,borderRadius:8,background:'#352848',color:'#fff'}}/>
                      <button style={{justifySelf:'start',border:0,borderRadius:8,padding:'8px 14px',background:'#8063bd',color:'#fff'}}>Save status</button>
                    </form>
                  </div>
                </article>
              })}</div>
          </div>
        </details>)}
      </div>
      <p style={{...muted,marginTop:24}}>Day labels use UTC. Saved changes show the current values; older versions are not stored as separate feedback events.</p>
    </div>
  </main>
}
