export const contentPages = {
  home: { title: 'Home', description: 'The first impression and main action.', fields: [
    { key: 'eyebrow', label: 'Small headline', placeholder: 'Welcome to…', multiline: false },
    { key: 'headline', label: 'Main headline', placeholder: 'What should visitors understand immediately?', multiline: false, required: true },
    { key: 'intro', label: 'Introduction', placeholder: 'A short, clear description of your business.', multiline: true, required: true },
    { key: 'ctaLabel', label: 'Main button text', placeholder: 'Book a call', multiline: false },
  ] },
  about: { title: 'About', description: 'Who you are and why customers trust you.', fields: [
    { key: 'headline', label: 'Page headline', placeholder: 'Meet our team', multiline: false, required: true },
    { key: 'body', label: 'About text', placeholder: 'Tell your story in your own words.', multiline: true, required: true },
    { key: 'highlights', label: 'Highlights', placeholder: 'One point per line', multiline: true },
  ] },
  services: { title: 'Services', description: 'What you offer and who it helps.', fields: [
    { key: 'headline', label: 'Page headline', placeholder: 'What we do', multiline: false, required: true },
    { key: 'intro', label: 'Short introduction', placeholder: 'A quick overview of your offer.', multiline: true },
    { key: 'items', label: 'Services or products', placeholder: 'One item per line, with a short description if helpful.', multiline: true, required: true },
  ] },
  contact: { title: 'Contact', description: 'Invite visitors to get in touch.', fields: [
    { key: 'headline', label: 'Page headline', placeholder: 'Let’s talk', multiline: false, required: true },
    { key: 'intro', label: 'Contact introduction', placeholder: 'What should visitors know before contacting you?', multiline: true },
    { key: 'ctaLabel', label: 'Button text', placeholder: 'Send a message', multiline: false },
  ] },
} as const

export type ContentPageKey = keyof typeof contentPages
export type VisualDesign = { background: string; text: string; accent: string; heroImageFileId: string | null }
export type VisualPin = { id: string; x: number; y: number; target: string; comment: string }
export type ContentRecord = { page_key: ContentPageKey; fields: Record<string, string>; design: VisualDesign; pins: VisualPin[]; status: 'draft' | 'submitted' | 'approved'; version: number; updated_at: string }

export const defaultDesign: VisualDesign = { background: '#f5f0e9', text: '#211d26', accent: '#7454c7', heroImageFileId: null }

export function parseVisualDesign(input: unknown): VisualDesign {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid visual design')
  const source = input as Record<string, unknown>
  const colors = ['background', 'text', 'accent'] as const
  const design = { ...defaultDesign }
  for (const key of colors) {
    const value = source[key] ?? defaultDesign[key]
    if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Invalid ${key} color`)
    design[key] = value.toLowerCase()
  }
  const fileId = source.heroImageFileId ?? null
  if (fileId !== null && (typeof fileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(fileId))) throw new Error('Invalid selected image')
  design.heroImageFileId = fileId
  return design
}

export function parseVisualPins(input: unknown): VisualPin[] {
  if (!Array.isArray(input) || input.length > 30) throw new Error('Use up to 30 comments per page')
  return input.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid comment pin')
    const pin = item as Record<string, unknown>
    if (typeof pin.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(pin.id)) throw new Error('Invalid comment pin')
    if (typeof pin.x !== 'number' || typeof pin.y !== 'number' || !Number.isFinite(pin.x) || !Number.isFinite(pin.y) || pin.x < 0 || pin.x > 100 || pin.y < 0 || pin.y > 100) throw new Error('Comment pin is outside the preview')
    if (typeof pin.target !== 'string' || pin.target.length > 80 || typeof pin.comment !== 'string' || pin.comment.trim().length < 1 || pin.comment.length > 1000) throw new Error('Add a short comment to each pin')
    return { id: pin.id, x: pin.x, y: pin.y, target: pin.target, comment: pin.comment.trim() }
  })
}

export function parseContent(pageKey: ContentPageKey, input: unknown) {
  if (!Object.hasOwn(contentPages, pageKey) || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid page content')
  const source = input as Record<string, unknown>
  const fields: Record<string, string> = {}
  for (const field of contentPages[pageKey].fields) {
    const value = source[field.key] ?? ''
    if (typeof value !== 'string' || value.length > (field.multiline ? 10000 : 300)) throw new Error(`Invalid ${field.label.toLowerCase()}`)
    fields[field.key] = value.trim()
  }
  return fields
}

export function validateContentSubmission(pageKey: ContentPageKey, fields: Record<string, string>) {
  const missing = contentPages[pageKey].fields.filter(field => 'required' in field && field.required && !fields[field.key]).map(field => field.label.toLowerCase())
  if (missing.length) throw new Error(`Please add: ${missing.join(', ')}.`)
}
