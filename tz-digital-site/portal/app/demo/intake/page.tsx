import { notFound } from 'next/navigation'
import { IntakeView } from '@/app/projects/[projectId]/intake/intake-view'
import { emptyAnswers } from '@/lib/intake'
import '@/app/projects/[projectId]/intake/intake.css'

export default function DemoIntake() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <IntakeView preview projectId="preview-project" projectName="Northstar Coffee website" initialAnswers={emptyAnswers()} initialStatus="draft" initialFiles={[]} canEdit />
}
