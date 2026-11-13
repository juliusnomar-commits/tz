import { redirect, notFound } from 'next/navigation'
import { emptyAnswers, type IntakeAnswers, type IntakeFile, type IntakeStatus, type SectionStatuses } from '@/lib/intake'
import { projectAccess } from '@/lib/project-access'
import { IntakeView } from './intake-view'
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
  return <IntakeView projectId={projectId} projectName={access.project.name} initialAnswers={{ ...emptyAnswers(), ...(intakeResult.data?.answers as Partial<IntakeAnswers> ?? {}) }} initialStatus={(intakeResult.data?.status ?? 'draft') as IntakeStatus} initialSectionStatuses={(intakeResult.data?.section_statuses ?? {}) as SectionStatuses} initialVersion={intakeResult.data?.version ?? 0} initialFiles={(filesResult.data ?? []) as IntakeFile[]} canEdit={access.canEdit && intakeResult.data?.status !== 'accepted'} />
}
