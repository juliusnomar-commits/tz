import { adminClient } from '@/lib/supabase'

export const CATO_PROJECT_ID = '063c3bae-deaf-4504-92a7-6cb48889eada'
const bucket = 'portal-intake'

export type LivePage = { changes: Record<string, string>; images: Record<string, string>; colors: Record<string, string> }
export const emptyLivePage = (): LivePage => ({ changes: {}, images: {}, colors: {} })
export const livePath = (pageKey: string) => `live-sites/cato/${pageKey}.json`

export async function readLivePage(pageKey: string): Promise<LivePage> {
  const { data, error } = await adminClient().storage.from(bucket).download(livePath(pageKey))
  if (error || !data) return emptyLivePage()
  const parsed = JSON.parse(await data.text()) as Partial<LivePage>
  return { changes: parsed.changes ?? {}, images: parsed.images ?? {}, colors: parsed.colors ?? {} }
}

export async function writeLivePage(pageKey: string, page: LivePage) {
  const { error } = await adminClient().storage.from(bucket).upload(livePath(pageKey), new Blob([JSON.stringify(page)], { type: 'application/json' }), { contentType: 'application/json', upsert: true, cacheControl: '0' })
  if (error) throw error
}
