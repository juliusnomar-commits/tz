import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase'
import { projectAccess } from '@/lib/project-access'

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; fileId: string }> }) {
  const { projectId, fileId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  const admin = adminClient()
  const { data: record } = await admin.from('portal_file_records').select('storage_path').eq('id', fileId).eq('project_id', projectId).eq('tenant_id', access.project.tenant_id).maybeSingle()
  if (!record) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  const { data, error } = await admin.storage.from('portal-intake').createSignedUrl(record.storage_path, 60)
  if (error || !data) return NextResponse.json({ error: 'Unable to open file' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } })
}
