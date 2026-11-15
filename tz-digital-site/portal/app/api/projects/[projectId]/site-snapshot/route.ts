import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { projectAccess } from '@/lib/project-access'
import { sitePage, siteProfile } from '@/lib/site-profiles'
import { adminClient } from '@/lib/supabase'

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Sign in to this project first' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'Editing access required' }, { status: 403 })
  try {
    const { pageKey, size } = await request.json()
    const profile = siteProfile(access.project.site_key)
    if (!profile || !sitePage(profile, pageKey)) throw new Error('Choose a valid site page')
    if (!Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024) throw new Error('Page capture must be under 10 MB')
    const path = `${access.project.tenant_id}/${projectId}/site-reviews/${pageKey}/${randomUUID()}.jpg`
    const { data, error } = await adminClient().storage.from('portal-intake').createSignedUploadUrl(path)
    if (error || !data) throw error ?? new Error('Unable to prepare page capture')
    return NextResponse.json({ path, token: data.token })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to prepare page capture' }, { status: 400 })
  }
}
