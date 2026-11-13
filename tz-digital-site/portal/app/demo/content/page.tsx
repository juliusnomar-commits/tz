import { ContentStudio } from '@/app/projects/[projectId]/content/studio'
import '@/app/projects/[projectId]/content/content.css'

export default function DemoContent() {
  return <ContentStudio preview projectId="preview-project" projectName="The Roundabout website" initialPages={[]} images={[]} canEdit isAgency={false} />
}
