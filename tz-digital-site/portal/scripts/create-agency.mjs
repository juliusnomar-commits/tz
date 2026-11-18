import { randomBytes, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const projectId = process.argv[2]
const allClients = projectId === '--all'
if (!allClients && !/^[0-9a-f-]{36}$/i.test(projectId ?? '')) throw new Error('Usage: npm run create-agency -- PROJECT_UUID or --all')
const desiredLoginId = process.env.TZ_AGENCY_LOGIN_ID
if (desiredLoginId && !/^[A-Za-z][A-Za-z0-9]{2,31}$/.test(desiredLoginId)) throw new Error('Invalid agency login ID')
const customPassword = process.env.TZ_AGENCY_INITIAL_PASSWORD
if (desiredLoginId && (!customPassword || customPassword.length < 12)) throw new Error('For a custom agency login, set a unique TZ_AGENCY_INITIAL_PASSWORD of at least 12 characters')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
let tenantIds = []
let projectName = 'All existing clients'
if (allClients) {
  const { data: tenants, error } = await db.from('portal_tenants').select('id')
  if (error) throw error
  tenantIds = (tenants ?? []).map(t => t.id)
} else {
  const { data: project, error: projectError } = await db.from('portal_projects').select('tenant_id, name').eq('id', projectId).single()
  if (projectError || !project) throw projectError ?? new Error('Project not found')
  tenantIds = [project.tenant_id]
  projectName = project.name
}
let loginId = desiredLoginId
if (loginId) {
  const { data, error } = await db.from('portal_login_ids').select('login_id').ilike('login_id', loginId).maybeSingle()
  if (error) throw error
  if (data) throw new Error('Agency login ID already exists; do not overwrite existing accounts')
}
for (let i = 0; !loginId && i < 20; i++) {
  const candidate = String(randomInt(0, 1_000_000)).padStart(6, '0')
  if (candidate === '146069' || candidate === '620314') continue
  const { data, error } = await db.from('portal_login_ids').select('login_id').eq('login_id', candidate).maybeSingle()
  if (error) throw error
  if (!data) { loginId = candidate; break }
}
if (!loginId) throw new Error('Unable to allocate login ID')
const password = customPassword ?? randomBytes(24).toString('base64url')
const email = `agency-${randomBytes(20).toString('hex')}@tz-digital.de`
const { data: created, error: authError } = await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { portal: true, agency: true } })
if (authError || !created.user) throw authError ?? new Error('Auth user was not created')
try {
  if (tenantIds.length) {
    const { error: memberError } = await db.from('portal_memberships').insert(tenantIds.map(tenant_id => ({ tenant_id, user_id: created.user.id, role: 'agency_owner' })))
    if (memberError) throw memberError
  }
  const { error: idError } = await db.from('portal_login_ids').insert({ login_id: loginId, auth_user_id: created.user.id, auth_email: email })
  if (idError) throw idError
  process.stdout.write(`Agency access for: ${projectName}\nLinked tenants: ${tenantIds.length}\nAgency login ID: ${loginId}\n${customPassword ? 'Password supplied through environment; not printed.' : `Generated password: ${password}`}\n`)
} catch (error) {
  await db.auth.admin.deleteUser(created.user.id)
  throw error
}
