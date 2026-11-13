import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { adminClient } from '@/lib/supabase'
import { projectAccess } from '@/lib/project-access'

const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['application/pdf', 'pdf']])
const bucket = 'portal-intake'

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'You do not have editing access' }, { status: 403 })
  try {
    const body = await request.json()
    const { name, mimeType, size, category } = body
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\r\n]/.test(name)) throw new Error('Invalid filename')
    if (!allowed.has(mimeType) || !Number.isInteger(size) || size < 1 || size > 10 * 1024 * 1024) throw new Error('Use a JPG, PNG, WebP or PDF under 10 MB')
    if (!['brand', 'legal'].includes(category) || (category === 'brand' && mimeType === 'application/pdf')) throw new Error('Invalid file category')
    const path = `${access.project.tenant_id}/${projectId}/${randomUUID()}.${allowed.get(mimeType)}`
    const admin = adminClient()
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
    if (error || !data) throw error ?? new Error('Unable to prepare upload')
    return NextResponse.json({ path, token: data.token })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to prepare upload' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) return NextResponse.json({ error: 'Project not found or sign-in required' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'You do not have editing access' }, { status: 403 })
  try {
    const body = await request.json()
    const { path, name, category } = body
    if (typeof path !== 'string' || !new RegExp(`^${access.project.tenant_id}/${projectId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(path)) throw new Error('Invalid file path')
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\r\n]/.test(name)) throw new Error('Invalid filename')
    if (!['brand', 'legal'].includes(category) || (category === 'brand' && path.endsWith('.pdf'))) throw new Error('Invalid file category')
    const admin = adminClient()
    const { data: object, error: objectError } = await admin.storage.from(bucket).info(path)
    if (objectError || !object) throw new Error('Upload has not completed')
    const mime = object.metadata?.mimetype ?? null
    const size = Number(object.metadata?.size)
    if (!mime || !allowed.has(mime) || !Number.isFinite(size) || size < 1 || size > 10 * 1024 * 1024) throw new Error('Uploaded file is not allowed')
    if (allowed.get(mime) !== path.split('.').pop()) throw new Error('File type does not match')
    const { data: record, error } = await admin.from('portal_file_records').insert({ tenant_id: access.project.tenant_id, project_id: projectId, display_name: name.trim(), storage_path: path, category, mime_type: mime, byte_size: size }).select('id, display_name, category, mime_type, byte_size, uploaded_at').single()
    if (error) throw error
    return NextResponse.json({ file: record })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to record upload' }, { status: 400 })
  }
}
