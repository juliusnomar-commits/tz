import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { projectSiteProfile } from '@/lib/project-site-profile'
import { readLivePage } from '@/lib/cato-live'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string; pageKey: string }> }) {
  const { projectId, pageKey } = await params
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[a-z0-9_-]{1,40}$/.test(pageKey)) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  try {
    const db = adminClient()
    const { data: project, error } = await db.from('portal_projects').select('site_key, site_config').eq('id', projectId).maybeSingle()
    if (error || !project) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    const profile = projectSiteProfile(project.site_key, project.site_config)
    if (!profile || !profile.pages.some(page => page.key === pageKey)) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    const page = await readLivePage(projectId, pageKey)
    const origin = new URL(request.url).origin
    const images = Object.fromEntries(Object.entries(page.images).map(([key, value]) => {
      const candidate = value.split('/files/').pop() ?? ''
      const fileId = /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null
      return [key, fileId ? `${origin}/api/live/${projectId}/image/${fileId}` : value]
    }))
    return NextResponse.json({ ...page, images }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load live content' }, { status: 500 })
  }
}
