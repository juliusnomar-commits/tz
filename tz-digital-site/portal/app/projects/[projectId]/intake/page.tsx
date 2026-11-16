import { redirect, notFound } from 'next/navigation'
import { emptyAnswers } from '@/lib/intake'
import { projectAccess } from '@/lib/project-access'
import { IntakeView } from './intake-view'
import { PortalSidebar } from '@/app/dashboard/portal-sidebar'
import type { IntakeAnswers as AnswersType, IntakeFile as FileType, IntakeStatus as StatusType, SectionStatuses as SectionStatusType } from '@/lib/intake'
import './intake.css'

export const dynamic = 'force-dynamic'

export default async function IntakePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const access = await projectAccess(projectId)
  if (!access) redirect('/login')
  if (access.project.service !== 'website') notFound()
  const [intakeResult, filesResult] = await Promise.all([
    access.supabase.from('portal_project_intakes').select('answers, status, section_statuses, version, updated_at').eq('project_id', projectId).maybeSingle(),
    access.supabase.from('portal_file_records').select('id, display_name, category, mime_type, byte_size, uploaded_at').eq('project_id', projectId).in('category', ['brand', 'legal']).order('uploaded_at', { ascending: false }),
  ])
  if (intakeResult.error) throw intakeResult.error
  if (filesResult.error) throw filesResult.error
  return <main className="dash-shell"><PortalSidebar projectId={projectId} projectName={access.project.name} active="details"/><div className="dash-main intake-embedded-main"><IntakeView projectId={projectId} projectName={access.project.name} initialAnswers={{ ...emptyAnswers(), ...(intakeResult.data?.answers as Partial<AnswersType> ?? {}) }} initialStatus={(intakeResult.data?.status ?? 'draft') as StatusType} initialSectionStatuses={(intakeResult.data?.section_statuses ?? {}) as SectionStatusType} initialVersion={intakeResult.data?.version ?? 0} initialFiles={(filesResult.data ?? []) as FileType[]} canEdit={access.canEdit && intakeResult.data?.status !== 'accepted'} embedded /></div></main>
}
