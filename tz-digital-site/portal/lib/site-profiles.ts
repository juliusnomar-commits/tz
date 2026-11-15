import catoCopy from '../public/site-previews/cato/content/nl.json'
import catoImages from '../public/site-previews/cato/content/images.json'

export type SitePage = { key: string; title: string; path: string; prefix: string }
export type SiteProfile = { key: string; name: string; domain: string; previewRoot: string; pages: SitePage[]; copy: Record<string, string>; images: Record<string, string>; colors: Record<string, string> }

export const siteProfiles: Record<string, SiteProfile> = {
  cato: {
    key: 'cato', name: 'Cato by Cato', domain: 'cato-brown.vercel.app', previewRoot: '/site-previews/cato',
    pages: [
      { key: 'home', title: 'Home', path: 'index.html', prefix: 'home_' },
      { key: 'restaurant', title: 'Restaurant', path: 'restaurant.html', prefix: 'restaurant_' },
      { key: 'catering', title: 'Catering', path: 'catering.html', prefix: 'catering_' },
      { key: 'garden', title: 'Garden', path: 'garden.html', prefix: 'garden_' },
      { key: 'about', title: 'About', path: 'about.html', prefix: 'about_' },
      { key: 'contact', title: 'Contact', path: 'contact.html', prefix: 'contact_' },
    ],
    copy: catoCopy, images: catoImages,
    colors: { teal: '#1c6e6e', 'teal-dark': '#134f4f', cream: '#faf6ee', yellow: '#f5c842', ink: '#1a1a18' },
  },
}

export function siteProfile(key: string | null | undefined) { return key ? siteProfiles[key] : undefined }
export function sitePage(profile: SiteProfile, key: string) { return profile.pages.find(page => page.key === key) }

export function validateSiteChanges(profile: SiteProfile, pageKey: string, input: unknown) {
  if (!sitePage(profile, pageKey)) throw new Error('Choose a valid page')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid page changes')
  const changes: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!(key in profile.copy) || typeof value !== 'string' || value.length > 10000) throw new Error('Invalid text field')
    changes[key] = value.trim()
  }
  return changes
}

export function validateSiteImages(profile: SiteProfile, input: unknown, projectId: string) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid images')
  const images: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!(key in profile.images) || typeof value !== 'string' || !(Object.values(profile.images).includes(value) || new RegExp(`^/api/projects/${projectId}/files/[0-9a-f-]{36}$`, 'i').test(value))) throw new Error('Choose an image from this project')
    images[key] = value
  }
  return images
}

export function validateSiteColors(profile: SiteProfile, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid colors')
  const colors: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!(key in profile.colors) || typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid color')
    colors[key] = value.toLowerCase()
  }
  return colors
}
