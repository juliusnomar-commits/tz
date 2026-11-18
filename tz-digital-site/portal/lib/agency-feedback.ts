import { userClient } from '@/lib/supabase'

export type FeedbackItem = {
  id: string; projectId: string; page: string; kind: 'Comment' | 'Pin' | 'Saved changes'
  body: string; createdAt: string; details: { field: string; value: string }[]
  snapshot: boolean; pin?: { x: number; y: number; target: string }
}
export type FeedbackProject = { id: string; name: string; tenant_id: string; items: FeedbackItem[] }

const values = (input: unknown) => input && typeof input === 'object' && !Array.isArray(input)
  ? Object.entries(input as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string') : []

export async function agencyFeedback() {
  const db = await userClient()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return { authorized: false, projects: [] as FeedbackProject[] }
  const { data: memberships, error: membershipError } = await db.from('portal_memberships')
    .select('tenant_id,role').eq('user_id', auth.user.id)
  if (membershipError) throw membershipError
  const tenants = [...new Set((memberships ?? []).filter(m => ['agency_owner','agency_admin','agency_member'].includes(m.role)).map(m => m.tenant_id))]
  if (!tenants.length) return { authorized: false, projects: [] as FeedbackProject[] }
  const { data: rows, error: projectsError } = await db.from('portal_projects')
    .select('id,tenant_id,name').in('tenant_id', tenants).order('name')
  if (projectsError) throw projectsError
  const projects: FeedbackProject[] = (rows ?? []).map(row => ({ ...row, items: [] }))
  if (!projects.length) return { authorized: true, projects }
  const ids = projects.map(p => p.id)
  const [activities, pages] = await Promise.all([
    db.from('portal_activity').select('id,project_id,title,detail,created_at')
      .in('project_id',ids).like('title','Site review comment ·%').order('created_at',{ascending:false}).limit(1000),
    db.from('portal_site_pages').select('project_id,page_key,pins,changes,images,colors,status,updated_at,submitted_at,snapshot_path')
      .in('project_id',ids).order('updated_at',{ascending:false}).limit(1000),
  ])
  if (activities.error) throw activities.error
  if (pages.error) throw pages.error
  const byId = new Map(projects.map(p => [p.id,p]))
  for (const row of activities.data ?? []) byId.get(row.project_id)?.items.push({
    id: 'comment-'+row.id, projectId: row.project_id, page: row.title.split(' · ').slice(1).join(' · ') || 'Website',
    kind:'Comment', body: row.detail ?? '', createdAt: row.created_at, details: [], snapshot:false,
  })
  for (const row of pages.data ?? []) {
    const project = byId.get(row.project_id)
    if (!project) continue
    // Page records contain the current saved state, not a historical event log.
    const date = row.submitted_at ?? row.updated_at
    const snapshot = Boolean(row.snapshot_path)
    const pins = Array.isArray(row.pins) ? row.pins : []
    pins.forEach((pin: unknown, index: number) => {
      if (!pin || typeof pin !== 'object') return
      const p = pin as {id?:string;comment?:string;x?:number;y?:number;target?:string}
      project.items.push({
        id:'pin-'+row.project_id+'-'+row.page_key+'-'+(p.id ?? index),projectId:row.project_id,
        page:row.page_key,kind:'Pin',body:p.comment ?? '',createdAt:date,details:[],snapshot,
        pin:Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x!,y:p.y!,target:p.target ?? ''}:undefined,
      })
    })
    const details = [
      ...values(row.changes).map(([field,value])=>({field:'Text · '+field,value})),
      ...values(row.images).map(([field,value])=>({field:'Image · '+field,value})),
      ...values(row.colors).map(([field,value])=>({field:'Color · '+field,value})),
    ]
    if (details.length) project.items.push({
      id:'changes-'+row.project_id+'-'+row.page_key,projectId:row.project_id,page:row.page_key,
      kind:'Saved changes',body:details.map(d=>d.field).join(', '),createdAt:date,details,snapshot,
    })
  }
  projects.forEach(p=>p.items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))
  return { authorized:true, projects }
}
