import { SiteStudio } from '@/app/projects/[projectId]/content/site-studio'
import { siteProfiles } from '@/lib/site-profiles'
import '@/app/projects/[projectId]/content/content.css'

export default function CatoDemo() {
  return <SiteStudio projectId="demo" profile={siteProfiles.cato} initialPages={[]} initialImages={[]} canEdit isAgency={false} demo />
}
