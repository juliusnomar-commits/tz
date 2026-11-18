import Link from 'next/link'
import { redirect } from 'next/navigation'
import { agencyFeedback, type FeedbackItem } from '@/lib/agency-feedback'
import { userClient } from '@/lib/supabase'
import { markFeedbackDay, updateFeedbackTriage } from './actions'

export const dynamic = 'force-dynamic'
const panel = {background:'#211a30',border:'1px solid #49395d',borderRadius:16,padding:22} as const
const muted = {color:'#bdb0d3',fontSize:14} as const
const link = {color:'#d5b7ff',textDecoration:'none'} as const
const day = (s:string)=>new Date(s).toISOString().slice(0,10)
const label = (s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
const button = {border:'1px solid #775d9f',borderRadius:9,padding:'8px 12px',background:'transparent',color:'#d5b7ff',cursor:'pointer'} as const

export default async function Feedback() {
  const {projects,authorized}=await agencyFeedback()
  if (!authorized) redirect('/login')
  const latest=projects.flatMap(project=>project.items.filter(item=>item.kind!=='Saved changes').map(item=>({project,item})))
    .sort((a,b)=>b.item.createdAt.localeCompare(a.item.createdAt))[0]
  const db=await userClient()
  const ids=projects.map(p=>p.id)
  const {data:triageRows,error}=ids.length?await db.from('portal_feedback_triage')
    .select('project_id,feedback_key,status,internal_note').in('project_id',ids):{data:[],error:null}
  if (error) throw error
  const triage=new Map((triageRows??[]).map(r=>[r.project_id+':'+r.feedback_key,r]))
  const status=(projectId:string,itemId:string)=>triage.get(projectId+':'+itemId)?.status??'new'
  const zip=(projectId:string,date?:string)=>'/api/agency/feedback?format=zip&project='+encodeURIComponent(projectId)+(date?'&day='+date:'')
  const image=(projectId:string,page:string)=>'/api/agency/feedback?format=image&project='+encodeURIComponent(projectId)+'&page='+encodeURIComponent(page)
  return <main style={{minHeight:'100vh',background:'#120d20',color:'#f7f3ff',padding:'32px clamp(18px,5vw,72px)',fontFamily:'inherit'}}>
    <div style={{maxWidth:1240,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16,marginBottom:32}}>
        <div><p style={{...muted,letterSpacing:2,textTransform:'uppercase'}}>TZ DIGITAL · PRIVATE WORKSPACE</p><h1 style={{fontSize:32,margin:'6px 0'}}>Feedback Inbox</h1><p style={muted}>Requests by client, day, and task.</p></div>
        <nav aria-label="Agency pages" style={{display:'flex',gap:18,alignItems:'center'}}><Link href="/agency" style={link}>Overview</Link><strong>Feedback Inbox</strong></nav>
      </header>
      <section aria-label="Latest feedback" style={{...panel,marginBottom:20,background:'#2a203d'}}>
        <p style={{...muted,letterSpacing:1.2,textTransform:'uppercase',margin:'0 0 8px'}}>Latest feedback</p>
        {latest?<div>
          <p style={{fontSize:18,fontWeight:700,margin:'0 0 8px',overflowWrap:'anywhere'}}>{latest.item.body?.trim()||'New client request'}</p>
          <p style={{...muted,margin:0}}>From <strong style={{color:'#f7f3ff'}}>{latest.project.name}</strong> · {new Date(latest.item.createdAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} UTC</p>
        </div>:<p style={{...muted,margin:0}}>No client feedback yet.</p>}
      </section>
      {!projects.length&&<section style={panel}><h2 style={{marginTop:0}}>No projects yet</h2><p style={muted}>Client requests will appear here when a project is ready.</p></section>}
      <div style={{display:'grid',gap:16}}>
        {projects.map((project,projectIndex)=>{
          const requests=project.items.filter(i=>i.kind!=='Saved changes')
          const edits=project.items.filter(i=>i.kind==='Saved changes')
          const grouped=new Map<string,FeedbackItem[]>()
          requests.forEach(i=>{const d=day(i.createdAt);grouped.set(d,[...(grouped.get(d)??[]),i])})
          return <details key={project.id} open={projectIndex===0} style={panel}>
            <summary style={{cursor:'pointer',fontSize:22,fontWeight:700}}>
              {project.name} <span style={{...muted,marginLeft:12,fontWeight:400}}>{requests.length} requests · {grouped.size} days</span>
            </summary>
            <div style={{borderTop:'1px solid #49395d',marginTop:18,paddingTop:18}}>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
                <a href={zip(project.id)} style={{...link,background:'#a980e4',color:'#1b102d',fontWeight:700,padding:'10px 16px',borderRadius:9}}>↓ Download project ZIP</a>
              </div>
              {!requests.length&&<p style={muted}>No client requests yet.</p>}
              <div style={{display:'grid',gap:12}}>
                {[...grouped].map(([date,records],dayIndex)=>{
                  const done=records.filter(item=>status(project.id,item.id)==='completed').length
                  const allDone=done===records.length
                  return <details key={date} open={dayIndex===0} style={{...panel,background:'#291f3a'}}>
                    <summary style={{cursor:'pointer',fontSize:18,fontWeight:700}}>{label(date)}
                      <span style={{...muted,marginLeft:12,fontWeight:400}}>{done}/{records.length} done</span>
                    </summary>
                    <div style={{borderTop:'1px solid #49395d',marginTop:16,paddingTop:16}}>
                      <div style={{display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap',marginBottom:16}}>
                        <form action={markFeedbackDay}>
                          <input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="day" value={date}/>
                          <input type="hidden" name="completed" value={allDone?'false':'true'}/>
                          <button type="submit" style={button}>{allDone?'↺ Reopen day':'✓ Mark whole day done'}</button>
                        </form>
                        <a href={zip(project.id,date)} style={{...button,textDecoration:'none'}}>↓ Download this day</a>
                      </div>
                      <div style={{display:'grid',gap:10}}>
                        {records.map((item,index)=>{
                          const saved=triage.get(project.id+':'+item.id)
                          const isDone=saved?.status==='completed'
                          const title=item.body?.trim()||'Client request'
                          return <div key={item.id} style={{display:'flex',alignItems:'flex-start',gap:10,background:'#211a30',border:'1px solid #49395d',borderRadius:12,padding:'13px 15px'}}>
                            <form action={updateFeedbackTriage} style={{flex:'0 0 auto'}}>
                              <input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="feedbackKey" value={item.id}/>
                              <input type="hidden" name="status" value={isDone?'new':'completed'}/>
                              <input type="hidden" name="note" value={saved?.internal_note??''}/>
                              <button type="submit" aria-label={(isDone?'Reopen':'Mark done')+' request: '+title} title={isDone?'Reopen request':'Mark request done'}
                                style={{minHeight:30,borderRadius:7,border:'1px solid #a980e4',background:isDone?'#a980e4':'transparent',color:isDone?'#1b102d':'#d5b7ff',cursor:'pointer',fontWeight:700,padding:'3px 9px',whiteSpace:'nowrap'}}>{isDone?'✓ Done':'○ Mark done'}</button>
                            </form>
                            <details style={{minWidth:0,flex:1}}>
                              <summary style={{cursor:'pointer',lineHeight:1.5,overflowWrap:'anywhere'}}>
                                <strong style={{textDecoration:isDone?'line-through':'none'}}>{title}</strong>
                                <span style={{...muted,marginLeft:10}}>{item.kind} · {item.page}</span>
                              </summary>
                              <div style={{marginTop:14,borderTop:'1px solid #49395d',paddingTop:14,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:20}}>
                                <div>
                                  <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:0}}>{item.body||'No message supplied'}</p>
                                  {item.pin&&<p style={muted}>Pinned to {item.pin.target||item.page} · {item.pin.x.toFixed(1)}% across, {item.pin.y.toFixed(1)}% down</p>}
                                  <small style={muted}>{new Date(item.createdAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} UTC</small>
                                  {item.snapshot?<a href={image(project.id,item.page)} target="_blank" rel="noreferrer" style={{...link,display:'block',marginTop:12}}>
                                    <img src={image(project.id,item.page)} alt={'Annotated '+item.page+' page with client pins'} style={{width:'100%',maxHeight:260,objectFit:'contain',background:'#140e25',border:'1px solid #49395d',borderRadius:10}}/>
                                    <span style={{display:'block',fontSize:12}}>Open full page capture ↗</span>
                                  </a>:item.kind==='Pin'&&<p style={muted}>No screenshot was captured with this earlier pin.</p>}
                                </div>
                                <form action={updateFeedbackTriage} style={{display:'grid',gap:8,alignContent:'start'}}>
                                  <input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="feedbackKey" value={item.id}/>
                                  <label htmlFor={'status-'+item.id} style={muted}>Task status</label>
                                  <select id={'status-'+item.id} name="status" defaultValue={saved?.status??'new'} style={{padding:9,borderRadius:8,background:'#352848',color:'#fff'}}>
                                    <option value="new">New</option><option value="in_progress">In progress</option><option value="needs_client">Needs client response</option><option value="completed">Done</option>
                                  </select>
                                  <label htmlFor={'note-'+item.id} style={muted}>Private team note</label>
                                  <textarea id={'note-'+item.id} name="note" rows={2} maxLength={4000} defaultValue={saved?.internal_note??''} style={{padding:9,borderRadius:8,background:'#352848',color:'#fff'}}/>
                                  <button style={{...button,justifySelf:'start',background:'#8063bd',color:'#fff'}}>Save</button>
                                </form>
                              </div>
                            </details>
                          </div>
                        })}
                      </div>
                    </div>
                  </details>
                })}
              </div>
              {edits.length>0&&<details style={{marginTop:16,padding:'14px 16px',border:'1px solid #49395d',borderRadius:12}}>
                <summary style={{cursor:'pointer',fontWeight:700}}>Saved edits <span style={{...muted,marginLeft:8,fontWeight:400}}>{edits.length} pages · already saved</span></summary>
                <div style={{display:'grid',gap:10,marginTop:14}}>
                  {edits.map(item=><div key={item.id} style={{borderTop:'1px solid #49395d',paddingTop:10}}>
                    <strong>{item.page}</strong><span style={{...muted,marginLeft:10}}>{item.details.length} fields · {label(day(item.createdAt))}</span>
                    <ul style={{...muted,margin:'8px 0 0',paddingLeft:22}}>
                      {item.details.map((detail,index)=><li key={index} style={{overflowWrap:'anywhere'}}>{detail.field}: {detail.value}</li>)}
                    </ul>
                  </div>)}
                </div>
              </details>}
            </div>
          </details>
        })}
      </div>
    </div>
  </main>
}
