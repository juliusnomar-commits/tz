import { IntakeView } from '@/app/projects/[projectId]/intake/intake-view'
import { emptyAnswers } from '@/lib/intake'
import '@/app/projects/[projectId]/intake/intake.css'

export default function DemoIntake() {
  return <IntakeView preview projectId="preview-project" projectName="The Roundabout website" initialAnswers={emptyAnswers()} initialStatus="draft" initialSectionStatuses={{}} initialVersion={0} initialFiles={[]} canEdit />
}
