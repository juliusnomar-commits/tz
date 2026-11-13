export const intakeFields = [
  'country', 'legalName', 'tradingName', 'legalForm', 'representative', 'streetAddress', 'postalCode', 'city', 'registrationNumber', 'registrationAuthority', 'vatId', 'regulator',
  'publicEmail', 'publicPhone', 'businessHours', 'businessDescription', 'services', 'audience', 'serviceArea', 'primaryContact',
  'existingWebsite', 'socialLinks', 'footerLinks', 'privacyContact', 'dataCollected', 'thirdPartyTools', 'cookiesAnalytics', 'existingPrivacyUrl', 'existingImprintUrl', 'existingTermsUrl', 'termsNeeded',
  'storyEnabled', 'storyText', 'storyMilestones', 'storyFounder',
  'designFeel', 'designColors', 'designAvoid', 'designExamples', 'designPriorities', 'designFeatures', 'designNotes',
] as const

export type IntakeField = typeof intakeFields[number]
export type IntakeAnswers = Record<IntakeField, string>
export type IntakeStatus = 'draft' | 'submitted' | 'changes_requested' | 'accepted'
export type IntakeSection = 'legal' | 'business' | 'story' | 'design' | 'files'
export type SectionStatuses = Partial<Record<IntakeSection, 'submitted'>>
export type IntakeFile = { id: string; display_name: string; category: 'brand' | 'legal' | 'project'; mime_type: string | null; byte_size: number | null; uploaded_at: string }

export const sectionFields: Record<IntakeSection, readonly IntakeField[]> = {
  legal: ['country','legalName','tradingName','legalForm','representative','streetAddress','postalCode','city','registrationNumber','registrationAuthority','vatId','regulator','publicEmail','publicPhone','privacyContact','dataCollected','thirdPartyTools','cookiesAnalytics','existingPrivacyUrl','existingImprintUrl','existingTermsUrl','termsNeeded','footerLinks'],
  business: ['businessHours','businessDescription','services','audience','serviceArea','primaryContact','existingWebsite','socialLinks'],
  story: ['storyEnabled','storyText','storyMilestones','storyFounder'],
  design: ['designFeel','designColors','designAvoid','designExamples','designPriorities','designFeatures','designNotes'],
  files: [],
}

export const requiredFields: { section: IntakeSection; key: IntakeField; label: string }[] = [
  { section: 'legal', key: 'country', label: 'business country' },
  { section: 'legal', key: 'legalName', label: 'legal business name' },
  { section: 'legal', key: 'streetAddress', label: 'business address' },
  { section: 'legal', key: 'postalCode', label: 'postal code' },
  { section: 'legal', key: 'city', label: 'city' },
  { section: 'legal', key: 'publicEmail', label: 'public email' },
  { section: 'business', key: 'businessDescription', label: 'business description' },
  { section: 'business', key: 'services', label: 'services or products' },
  { section: 'design', key: 'designFeel', label: 'site feeling' },
  { section: 'design', key: 'designPriorities', label: 'visitor priority' },
]

export function progress(answers: IntakeAnswers) {
  const fields = [...requiredFields]
  if (answers.storyEnabled === 'yes') fields.push({ section: 'story', key: 'storyText', label: 'Our Story text' })
  return { complete: fields.filter(field => field.key === 'publicEmail' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.publicEmail.trim()) : Boolean(answers[field.key].trim())).length, total: fields.length }
}

export function emptyAnswers(): IntakeAnswers {
  return Object.fromEntries(intakeFields.map(key => [key, ''])) as IntakeAnswers
}

export function parseAnswers(input: unknown): IntakeAnswers {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid intake answers')
  const source = input as Record<string, unknown>
  const answers = emptyAnswers()
  for (const key of intakeFields) {
    const value = source[key] ?? ''
    if (typeof value !== 'string' || value.length > (key === 'storyText' || key === 'designNotes' ? 5000 : 2000)) throw new Error(`Invalid ${key}`)
    answers[key] = value.trim()
  }
  if (answers.country && !['Germany', 'Netherlands', 'Both'].includes(answers.country)) throw new Error('Choose Germany, Netherlands, or both')
  if (answers.storyEnabled && !['yes', 'no'].includes(answers.storyEnabled)) throw new Error('Choose whether to include Our Story')
  if (answers.cookiesAnalytics && !['yes', 'no'].includes(answers.cookiesAnalytics)) throw new Error('Choose whether cookies or analytics are planned')
  if (answers.termsNeeded && !['yes', 'no'].includes(answers.termsNeeded)) throw new Error('Choose whether terms are needed')
  for (const key of ['existingWebsite', 'existingPrivacyUrl', 'existingImprintUrl', 'existingTermsUrl'] as const) {
    if (answers[key]) {
      try { if (!['http:', 'https:'].includes(new URL(answers[key]).protocol)) throw new Error() }
      catch { throw new Error(`Enter a complete web link for ${key}`) }
    }
  }
  return answers
}

export function validateSection(answers: IntakeAnswers, section: IntakeSection) {
  if (!Object.hasOwn(sectionFields, section)) throw new Error('Unknown section')
  const fields = requiredFields.filter(field => field.section === section)
  if (section === 'story' && answers.storyEnabled === 'yes') fields.push({ section: 'story', key: 'storyText', label: 'Our Story text' })
  const missing = fields.filter(({ key }) => !answers[key]).map(({ label }) => label)
  if (missing.length) throw new Error(`Please add: ${missing.join(', ')}.`)
  if (section === 'legal' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.publicEmail)) throw new Error('Enter a valid public email address')
}

export function validateSubmission(answers: IntakeAnswers) {
  const fields = [...requiredFields]
  if (answers.storyEnabled === 'yes') fields.push({ section: 'story', key: 'storyText', label: 'Our Story text' })
  const missing = fields.filter(field => !answers[field.key].trim()).map(field => field.label)
  if (missing.length) throw new Error(`Please add: ${missing.join(', ')}.`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.publicEmail)) throw new Error('Enter a valid public email address')
}

