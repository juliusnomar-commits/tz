import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/app/dashboard/portal-sidebar'
import { ProjectFiles } from '@/app/dashboard/project-files'
import type { DashboardFile } from '@/lib/dashboard'
import { projectAccess } from '@/lib/project-access'

export const dynamic = 'force-dynamic'

export default async function FilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) redirect('/login')
  const { data, count, error } = await access.supabase.from('portal_file_records').select('id, display_name, category, mime_type, byte_size, uploaded_at', { count: 'exact' }).eq('project_id', projectId).order('uploaded_at', { ascending: false })
  if (error) throw error
  return <main className="dash-shell">
    <PortalSidebar projectId={projectId} projectName={access.project.name} active="files" />
    <div className="dash-main">
      <header className="dash-page-heading"><h1>Files</h1></header>
      <ProjectFiles projectId={projectId} files={(data ?? []) as DashboardFile[]} fileCount={count ?? data?.length ?? 0} canUpload={access.canEdit} demo={false} showAll />
      <footer className="dash-footer"><span>TZ DIGITAL · CLIENT PORTAL</span><a href="/#kontakt">Need help? Contact your team</a></footer>
    </div>
  </main>
}
