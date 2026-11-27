import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { projectSiteProfile } from '@/lib/project-site-profile'
import { readLivePage } from '@/lib/cato-live'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  const { projectId, fileId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse(null, { status: 404 })
  try {
    const db = adminClient()
    const { data: project, error: projectError } = await db.from('portal_projects').select('tenant_id, site_key, site_config').eq('id', projectId).maybeSingle()
    if (projectError || !project) return new NextResponse(null, { status: 404 })
    const profile = projectSiteProfile(project.site_key, project.site_config)
    if (!profile) return new NextResponse(null, { status: 404 })
    const pages = await Promise.all(profile.pages.map(page => readLivePage(projectId, page.key)))
    const expected = `/api/projects/${projectId}/files/${fileId}`
    if (!pages.some(page => Object.values(page.images).includes(expected))) return new NextResponse(null, { status: 404 })
    const { data: file, error } = await db.from('portal_file_records').select('storage_path, mime_type').eq('id', fileId).eq('project_id', projectId).eq('tenant_id', project.tenant_id).eq('category', 'brand').maybeSingle()
    if (error || !file?.mime_type?.startsWith('image/')) return new NextResponse(null, { status: 404 })
    const result = await db.storage.from('portal-intake').download(file.storage_path)
    if (result.error || !result.data) return new NextResponse(null, { status: 404 })
    return new NextResponse(result.data, { headers: { 'Content-Type': file.mime_type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}
