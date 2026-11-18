import { siteProfiles, type SitePage, type SiteProfile } from './site-profiles'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringMap(value: unknown, label: string, maxEntries = 300): Record<string, string> {
  if (!isRecord(value) || Object.keys(value).length > maxEntries) throw new Error(`Invalid site ${label}`)
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key) || typeof item !== 'string' || item.length > 20000) throw new Error(`Invalid site ${label}`)
    result[key] = item
  }
  return result
}

function pages(value: unknown): SitePage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error('Invalid site pages')
  return value.map(item => {
    if (!isRecord(item) || typeof item.key !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(item.key) ||
      typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100 ||
      typeof item.path !== 'string' || !/^[a-zA-Z0-9_./-]{1,160}$/.test(item.path) || item.path.includes('..') ||
      typeof item.prefix !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.prefix)) throw new Error('Invalid site page')
    return { key: item.key, title: item.title.trim(), path: item.path, prefix: item.prefix }
  })
}

/** Resolve a trusted project-level profile, falling back to the built-in manifest for legacy projects. */
export function projectSiteProfile(siteKey: string | null | undefined, config: unknown): SiteProfile | undefined {
  const base = siteKey ? siteProfiles[siteKey] : undefined
  if (!isRecord(config) || Object.keys(config).length === 0) return base
  const merged = { ...(base ?? {}), ...config }
  const labels = typeof merged.domain === 'string' ? merged.domain.split('.') : []
  const validDomain = typeof merged.domain === 'string' && merged.domain.length <= 253 && labels.length >= 2 && labels.every((label: string) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  if (typeof merged.key !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(merged.key) ||
    (base && merged.key !== base.key) || typeof merged.name !== 'string' || !merged.name.trim() || merged.name.length > 160 ||
    !validDomain || typeof merged.previewRoot !== 'string' || !merged.previewRoot.startsWith('/site-previews/') || merged.previewRoot.includes('..') || merged.previewRoot.includes('?') || merged.previewRoot.includes('#')) throw new Error('Invalid site configuration')
  const pageList = pages(merged.pages)
  const copy = stringMap(merged.copy, 'text fields')
  const images = stringMap(merged.images, 'images')
  const colors = stringMap(merged.colors, 'colors', 50)
  if (!Object.keys(copy).length || !Object.keys(images).length || !Object.keys(colors).length || Object.values(colors).some(color => !/^#[0-9a-f]{6}$/i.test(color))) throw new Error('Invalid site configuration')
  return { key: merged.key, name: merged.name.trim(), domain: merged.domain.toLowerCase(), previewRoot: merged.previewRoot.replace(/\/$/, ''), pages: pageList, copy, images, colors }
}
