import { adminClient } from '@/lib/supabase'

export const CATO_PROJECT_ID = '063c3bae-deaf-4504-92a7-6cb48889eada'
export type LivePage = { changes: Record<string, string>; images: Record<string, string>; colors: Record<string, string> }
export const emptyLivePage = (): LivePage => ({ changes: {}, images: {}, colors: {} })
export const liveKey = (pageKey: string) => `live-${pageKey}`

/** Published site content is scoped to its project, so clients never share a live row. */
export async function readLivePage(projectId: string, pageKey: string): Promise<LivePage> {
  const { data, error } = await adminClient().from('portal_site_pages').select('changes, images, colors').eq('project_id', projectId).eq('page_key', liveKey(pageKey)).maybeSingle()
  if (error) throw error
  return data ? { changes: data.changes ?? {}, images: data.images ?? {}, colors: data.colors ?? {} } : emptyLivePage()
}

export async function writeLivePage(projectId: string, pageKey: string, tenantId: string, page: LivePage) {
  const { error } = await adminClient().from('portal_site_pages').upsert({ project_id: projectId, tenant_id: tenantId, page_key: liveKey(pageKey),
    changes: page.changes, images: page.images, colors: page.colors, pins: [], status: 'draft', version: 1, updated_at: new Date().toISOString() }, { onConflict: 'project_id,page_key' })
  if (error) throw error
}
