import Link from 'next/link'

export const metadata = { title: 'TZ Digital · Agency Dashboard Preview', robots: { index: false, follow: false } }

const clients = [
  { id:'cato', name:'Restaurant Website', stage:'Client review', milestone:'Review homepage draft', tasks:3 },
  { id:'bakery', name:'Example Bakery', stage:'Building', milestone:'First design draft', tasks:2 },
  { id:'studio', name:'Example Design Studio', stage:'Onboarding', milestone:'Receive brand assets', tasks:1 },
]
const feedback = [
 { client:'Restaurant Website', type:'Pinned comment', title:'Adjust headline spacing', detail:'Homepage · Feedback on hero section', day:'Today' },
 { client:'Restaurant Website', type:'Edit request', title:'Update opening hours', detail:'Contact page · Text change requested', day:'Today' },
 { client:'Example Bakery', type:'Comment', title:'Replace gallery photo', detail:'Gallery · Waiting on new image', day:'Yesterday' },
 { client:'Example Design Studio', type:'Comment', title:'Brand colors provided', detail:'Branding · Client message', day:'Earlier this week' },
]
const base: React.CSSProperties = {padding:22,background:'#211a34',border:'1px solid #443558',borderRadius:16}
const muted: React.CSSProperties = {color:'#bdb0d3',fontSize:13}
const anchor: React.CSSProperties = {color:'#d7c1ff',textDecoration:'none'}

export default function AgencyDemoPage() {
 return <main style={{minHeight:'100vh',background:'#140e25',color:'#f7f3ff',padding:'32px clamp(18px, 5vw, 72px)',fontFamily:'inherit'}}>
 <div style={{maxWidth:1280,margin:'0 auto'}}>
 <div style={{border:'1px solid #7153ae',background:'#2c2146',padding:'12px 16px',borderRadius:12,marginBottom:24,color:'#ded2f5',fontSize:14}} role="note">VIEW-ONLY PREVIEW · All names, messages, stages and counts are example data. No real client records or editing permissions are shown.</div>
 <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:28}}>
  <div><p style={{...muted,letterSpacing:2,textTransform:'uppercase'}}>TZ DIGITAL · AGENCY WORKSPACE</p><h1 style={{fontSize:32,margin:'6px 0'}}>Agency overview</h1><p style={muted}>Clients, website progress and everything needing attention.</p></div>
  <nav aria-label="Preview links" style={{display:'flex',gap:16,flexWrap:'wrap'}}><span style={{color:'#fff',fontWeight:700}}>Overview</span><a href="#client-list" style={anchor}>Clients</a><a href="#feedback" style={anchor}>Feedback</a><a href="#tasks" style={anchor}>Tasks</a><Link href="/login" style={anchor}>Sign in to live portal</Link></nav>
 </header>
 <section aria-label="Example metrics" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:28}}>
 {([['Active projects','03'],['Agency tasks','04'],['Waiting on clients','02'],['Submitted reviews','03']] as const).map(([label,value])=><div key={label} style={base}><div style={muted}>{label}</div><div style={{fontSize:32,fontWeight:750,marginTop:10}}>{value}</div></div>)}
 </section>
 <section id="client-list" style={{...base,marginBottom:24}}>
 <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0,fontSize:21}}>Clients & project stages</h2><span style={muted}>3 sample projects</span></div>
 <div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
 <thead><tr>{['Client','Stage','Next milestone','Open tasks'].map(h=><th key={h} style={{...muted,padding:'12px 8px',borderBottom:'1px solid #493a5d'}}>{h}</th>)}</tr></thead>
 <tbody>{clients.map(c=><tr key={c.id}><td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a',fontWeight:600}}>{c.name}</td><td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a'}}>{c.stage}</td><td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a',color:'#bdb0d3'}}>{c.milestone}</td><td style={{padding:'14px 8px',borderBottom:'1px solid #382b4a'}}>{c.tasks}</td></tr>)}</tbody>
 </table></div>
 </section>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,390px),1fr))',gap:24}}>
 <section id="tasks" style={base}><h2 style={{marginTop:0,fontSize:21}}>What needs doing</h2>
 <h3 style={{fontSize:15,color:'#d2c0ed'}}>Waiting on TZ Digital (4)</h3>
 {[['Review image replacements','Restaurant Website'],['Create first design draft','Example Bakery'],['Prepare mobile layouts','Example Bakery'],['Set up project pages','Example Design Studio']].map(([task,client])=><p key={task} style={{borderBottom:'1px solid #382b4a',paddingBottom:10}}>{task}<br/><span style={muted}>{client}</span></p>)}
 <h3 style={{fontSize:15,color:'#d2c0ed'}}>Waiting on clients (2)</h3>
 {[['Confirm requested revisions','Restaurant Website'],['Upload brand assets','Example Design Studio']].map(([task,client])=><p key={task} style={{borderBottom:'1px solid #382b4a',paddingBottom:10}}>{task}<br/><span style={muted}>{client}</span></p>)}
 </section>
 <section id="feedback" style={base}><h2 style={{marginTop:0,fontSize:21}}>Client feedback</h2><p style={muted}>Date folders · newest first</p>
 {['Today','Yesterday','Earlier this week'].map(day=><details key={day} open={day==='Today'} style={{borderTop:'1px solid #493a5d',padding:'14px 0'}}>
 <summary style={{cursor:'pointer',fontWeight:650}}>▸ {day} · {feedback.filter(f=>f.day===day).length} items</summary>
 {feedback.filter(f=>f.day===day).map(f=><article key={f.title} style={{padding:'12px 0 8px 14px',borderBottom:'1px solid #332742'}}>
 <div style={muted}>{f.client} · {f.type}</div><div style={{margin:'4px 0'}}>{f.title}</div><p style={{...muted,margin:'4px 0'}}>{f.detail}</p>
 </article>)}
 </details>)}
 <p style={{...muted,marginTop:18}}>In the signed-in version, you can open the editor and save internal request statuses and notes.</p>
 </section>
 </div>
 <div style={{marginTop:28,display:'flex',gap:16,flexWrap:'wrap'}}>
 <Link href="/login" style={{...anchor,padding:'12px 18px',borderRadius:9,background:'#7054a8',color:'#fff'}}>Sign in to real agency portal</Link>
 <Link href="/demo" style={{...anchor,padding:'12px 18px',borderRadius:9,border:'1px solid #7054a8'}}>View example client dashboard</Link>
 </div>
 </div></main>
}