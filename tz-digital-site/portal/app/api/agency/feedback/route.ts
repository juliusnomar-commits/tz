import { NextRequest, NextResponse } from 'next/server'
import { agencyFeedback } from '@/lib/agency-feedback'
import { adminClient } from '@/lib/supabase'
import { createZip } from '@/lib/zip'

export const dynamic = 'force-dynamic'
const encoder = new TextEncoder()
const safe = (s:string) => s.replace(/[^a-z0-9_-]/gi,'-').slice(0,80)
const dayKey = (s:string) => new Date(s).toISOString().slice(0,10)

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('project') ?? ''
  const selectedDay = request.nextUrl.searchParams.get('day')
  const format = request.nextUrl.searchParams.get('format')
  const pageKey = request.nextUrl.searchParams.get('page') ?? ''
  const result = await agencyFeedback()
  if (!result.authorized) return NextResponse.json({error:'Agency sign-in required'},{status:403})
  const project = result.projects.find(p=>p.id===projectId)
  if (!project) return NextResponse.json({error:'Project not accessible'},{status:404})
  const db = adminClient()
  async function capture(page:string) {
    const {data,error} = await db.from('portal_site_pages')
      .select('snapshot_path').eq('project_id',project.id).eq('page_key',page).maybeSingle()
    if (error || !data?.snapshot_path) return null
    const expected = new RegExp('^'+project.tenant_id+'/'+project.id+'/site-reviews/[A-Za-z0-9_-]+/[0-9a-f-]{36}\\.jpg$','i')
    if (!expected.test(data.snapshot_path)) return null
    const download = await db.storage.from('portal-intake').download(data.snapshot_path)
    if (download.error || !download.data) return null
    const bytes = new Uint8Array(await download.data.arrayBuffer())
    return bytes.byteLength <= 10*1024*1024 ? bytes : null
  }
  if (format==='image') {
    if (!project.items.some(i=>i.page===pageKey && i.snapshot)) return NextResponse.json({error:'Capture unavailable'},{status:404})
    const bytes = await capture(pageKey)
    if (!bytes) return NextResponse.json({error:'Capture unavailable'},{status:404})
    return new NextResponse(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store'}})
  }
  if (format!=='zip' || (selectedDay && !/^\\d{4}-\\d{2}-\\d{2}$/.test(selectedDay)))
    return NextResponse.json({error:'Invalid export'},{status:400})
  const items = project.items.filter(i=>!selectedDay || dayKey(i.createdAt)===selectedDay)
  const folder = safe(project.name)+'-feedback'
  const entries:{path:string;data:Uint8Array}[]=[]
  const add=(path:string,value:string|Uint8Array)=>entries.push({path:folder+'/'+path,data:typeof value==='string'?encoder.encode(value):value})
  const groups = new Map<string,typeof items>()
  items.forEach(i=>{const d=dayKey(i.createdAt);groups.set(d,[...(groups.get(d)??[]),i])})
  const manifest = items.map((i,index)=>({
    number:index+1,id:i.id,page:i.page,type:i.kind,request:i.body,values:i.details,
    pin:i.pin,receivedAt:i.createdAt,capture:i.snapshot?'See captures/'+safe(i.page)+'.jpg if available':null,
  }))
  add('README.md','# '+project.name+' — feedback brief\\n\\nExported '+new Date().toISOString()+'\\n\\nThe page edits listed here are the current saved values. A page capture is the latest available submitted capture; it is not an image of every historical edit. Agency statuses and notes are separate from client feedback.\\n')
  for (const [day,dayItems] of groups) {
    add(day+'/requests.md','# '+project.name+' — '+day+'\\n\\n'+dayItems.map(i=>{
      const n=items.indexOf(i)+1
      return '## '+n+'. '+i.kind+' · '+i.page+'\\n\\n'+(i.body||'No comment provided')+'\\n\\n'+
        i.details.map(d=>'- **'+d.field+'**: '+d.value.replaceAll('\\n',' ')).join('\\n')+
        (i.pin?'\\n\\nPin: '+i.pin.target+' ('+i.pin.x+'%, '+i.pin.y+'%)':'')+'\\n\\nReceived: '+i.createdAt+'\\n'
    }).join('\\n'))
  }
  add('feedback.json',JSON.stringify({project:project.name,exportedAt:new Date().toISOString(),items:manifest},null,2))
  const pages=[...new Set(items.filter(i=>i.snapshot).map(i=>i.page))]
  for (const page of pages) {
    const bytes=await capture(page)
    if (bytes) add('captures/'+safe(page)+'.jpg',bytes)
  }
  const zip=createZip(entries)
  return new NextResponse(new Uint8Array(zip),{headers:{
    'Content-Type':'application/zip','Content-Disposition':'attachment; filename="'+folder+(selectedDay?'-'+selectedDay:'')+'.zip"',
    'Cache-Control':'private, no-store',
  }})
}
