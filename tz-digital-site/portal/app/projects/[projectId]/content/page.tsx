import { notFound, redirect } from 'next/navigation'
import { projectAccess } from '@/lib/project-access'
import { ContentStudio } from './studio'
import type { ContentRecord } from '@/lib/content'
import { siteProfile } from '@/lib/site-profiles'
import { SiteStudio } from './site-studio'
import { readLivePage } from '@/lib/cato-live'
import { PortalSidebar } from '@/app/dashboard/portal-sidebar'
import './content.css'

export const dynamic = 'force-dynamic'

export default async function ContentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) redirect('/login')
  if (access.project.service !== 'website') notFound()
  const profile = siteProfile(access.project.site_key)
  if (profile) {
    const [pages, files, livePages, activity] = await Promise.all([
      access.supabase.from('portal_site_pages').select('page_key, changes, images, colors, pins, status, version, updated_at, snapshot_path, snapshot_device').eq('project_id', projectId),
      access.supabase.from('portal_file_records').select('id, display_name').eq('project_id', projectId).eq('category', 'brand').like('mime_type', 'image/%'),
      Promise.all(profile.pages.map(async page => [page.key, await readLivePage(projectId, page.key)] as const)),
      access.supabase.from('portal_activity').select('id, title, detail, actor_type, created_at').eq('project_id', projectId).like('title', 'Site review comment ·%').order('created_at', { ascending: false }).limit(30),
    ])
    if (pages.error) throw pages.error
    if (files.error) throw files.error
    if (activity.error) throw activity.error
    return <main className="dash-shell"><PortalSidebar projectId={projectId} projectName={access.project.name} active="preview"/><div className="dash-main cms-editor-outer"><SiteStudio projectId={projectId} profile={profile} initialPages={(pages.data ?? []).filter(page => profile.pages.some(item => item.key === page.page_key))} initialPublished={Object.fromEntries(livePages)} initialImages={files.data ?? []} initialComments={activity.data ?? []} canEdit={access.canEdit} isAgency={access.role.startsWith('agency_')} /></div></main>
  }
  const [contentResult, imageResult] = await Promise.all([
    access.supabase.from('portal_content_pages').select('page_key, fields, design, pins, status, version, updated_at').eq('project_id', projectId),
    access.supabase.from('portal_file_records').select('id, display_name, mime_type').eq('project_id', projectId).eq('category', 'brand').order('uploaded_at', { ascending: false }),
  ])
  if (contentResult.error) throw contentResult.error
  if (imageResult.error) throw imageResult.error
  return <ContentStudio projectId={projectId} projectName={access.project.name} initialPages={(contentResult.data ?? []) as ContentRecord[]} images={(imageResult.data ?? []).filter(file => file.mime_type?.startsWith('image/'))} canEdit={access.canEdit} isAgency={access.role.startsWith('agency_')} />
}
