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
export type IntakeFile = { id: string; display_name: string; category: 'brand' | 'legal' | 'project'; mime_type: string | null; byte_size: number | null; uploaded_at: string }

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

export function validateSubmission(answers: IntakeAnswers) {
  const required: { key: IntakeField; label: string }[] = [
    { key: 'country', label: 'business country' }, { key: 'legalName', label: 'legal business name' },
    { key: 'streetAddress', label: 'business address' }, { key: 'postalCode', label: 'postal code' },
    { key: 'city', label: 'city' }, { key: 'publicEmail', label: 'public email' },
    { key: 'businessDescription', label: 'business description' }, { key: 'services', label: 'services or products' },
  ]
  const missing = required.filter(({ key }) => !answers[key]).map(({ label }) => label)
  if (missing.length) throw new Error(`Please add: ${missing.join(', ')}.`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.publicEmail)) throw new Error('Enter a valid public email address')
}

