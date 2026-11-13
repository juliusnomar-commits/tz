import { notFound, redirect } from 'next/navigation'
import { projectAccess } from '@/lib/project-access'
import { ContentStudio } from './studio'
import type { ContentRecord } from '@/lib/content'
import './content.css'

export const dynamic = 'force-dynamic'

export default async function ContentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) redirect('/login')
  if (access.project.service !== 'website') notFound()
  const [contentResult, imageResult] = await Promise.all([
    access.supabase.from('portal_content_pages').select('page_key, fields, design, pins, status, version, updated_at').eq('project_id', projectId),
    access.supabase.from('portal_file_records').select('id, display_name, mime_type').eq('project_id', projectId).eq('category', 'brand').order('uploaded_at', { ascending: false }),
  ])
  if (contentResult.error) throw contentResult.error
  if (imageResult.error) throw imageResult.error
  return <ContentStudio projectId={projectId} projectName={access.project.name} initialPages={(contentResult.data ?? []) as ContentRecord[]} images={(imageResult.data ?? []).filter(file => file.mime_type?.startsWith('image/'))} canEdit={access.canEdit} isAgency={access.role.startsWith('agency_')} />
}
