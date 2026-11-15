import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { CATO_PROJECT_ID, readLivePage } from '@/lib/cato-live'
import { siteProfile } from '@/lib/site-profiles'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse(null, { status: 404 })
  try {
    const pages = await Promise.all(siteProfile('cato')!.pages.map(page => readLivePage(page.key)))
    const expected = `/api/projects/${CATO_PROJECT_ID}/files/${fileId}`
    if (!pages.some(page => Object.values(page.images).includes(expected))) return new NextResponse(null, { status: 404 })
    const db = adminClient()
    const { data: file, error } = await db.from('portal_file_records').select('storage_path, mime_type').eq('id', fileId).eq('project_id', CATO_PROJECT_ID).eq('category', 'brand').maybeSingle()
    if (error || !file?.mime_type?.startsWith('image/')) return new NextResponse(null, { status: 404 })
    const result = await db.storage.from('portal-intake').download(file.storage_path)
    if (result.error || !result.data) return new NextResponse(null, { status: 404 })
    return new NextResponse(result.data, { headers: { 'Content-Type': file.mime_type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
