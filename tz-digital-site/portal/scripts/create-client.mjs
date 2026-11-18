import { randomBytes, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const loginFlag = args.indexOf('--login-id')
const customLoginId = loginFlag >= 0 ? args[loginFlag + 1] : null
if (loginFlag >= 0 && !/^[A-Za-z][A-Za-z0-9]{2,31}$/.test(customLoginId ?? '')) throw new Error('Specify a 3–32 character letter-and-number login ID after --login-id')
if (loginFlag >= 0) args.splice(loginFlag, 2)
const siteFlag = args.indexOf('--site')
const siteKey = siteFlag >= 0 ? args[siteFlag + 1] : null
if (siteFlag >= 0 && !siteKey) throw new Error('Specify a site profile after --site')
if (siteFlag >= 0) args.splice(siteFlag, 2)
const configFlag = args.indexOf('--site-config')
const configPath = configFlag >= 0 ? args[configFlag + 1] : null
if (configFlag >= 0 && !configPath) throw new Error('Specify a JSON file after --site-config')
if (configFlag >= 0) args.splice(configFlag, 2)
let siteConfig = {}
if (configPath) {
  siteConfig = JSON.parse(await readFile(configPath, 'utf8'))
  if (!siteConfig || typeof siteConfig !== 'object' || Array.isArray(siteConfig)) throw new Error('Site configuration must be a JSON object')
}
const resolvedSiteKey = siteKey ?? (typeof siteConfig.key === 'string' ? siteConfig.key : null)
if (siteKey && typeof siteConfig.key === 'string' && siteConfig.key !== siteKey) throw new Error('The site key must match the --site value')
if (siteKey && !['cato'].includes(siteKey)) throw new Error('Unknown site profile. Available: cato')
const name = args.join(' ').trim()
if (!name || name.length > 160) {
  process.stderr.write('Usage: npm run create-client -- "Client organization name" [--site cato] [--site-config ./profile.json]\n')
  process.exit(1)
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the shell')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

let id = customLoginId
if (id) {
  const { data, error } = await db.from('portal_login_ids').select('login_id').ilike('login_id', id).maybeSingle()
  if (error) throw error
  if (data) throw new Error('Login ID is already in use')
}
for (let i = 0; !id && i < 20; i++) {
  const candidate = String(randomInt(0, 1_000_000)).padStart(6, '0')
  if (candidate === '146069' || candidate === '620314') continue
  const { data, error } = await db.from('portal_login_ids').select('login_id').eq('login_id', candidate).maybeSingle()
  if (error) throw error
  if (!data) { id = candidate; break }
}
if (!id) throw new Error('Unable to allocate a unique client ID')

const password = randomBytes(24).toString('base64url')
const email = `client-${randomBytes(20).toString('hex')}@tz-digital.de`
const { data: created, error: authError } = await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { portal: true } })
if (authError || !created.user) throw authError ?? new Error('Auth user was not created')
const userId = created.user.id

let tenantId
try {
  const { data: tenant, error: tenantError } = await db.from('portal_tenants').insert({ name }).select('id').single()
  if (tenantError || !tenant) throw tenantError ?? new Error('Tenant was not created')
  tenantId = tenant.id
  const { error: memberError } = await db.from('portal_memberships').insert({ tenant_id: tenant.id, user_id: userId, role: 'client_owner' })
  if (memberError) throw memberError
  const { error: idError } = await db.from('portal_login_ids').insert({ login_id: id, auth_user_id: userId, auth_email: email })
  if (idError) throw idError
  const { data: project, error: projectError } = await db.from('portal_projects').insert({ tenant_id: tenant.id, name: siteKey === 'cato' ? 'Cato by Cato website' : `${name} website`, service: 'website', site_key: resolvedSiteKey, site_config: siteConfig,
    status: siteKey === 'cato' ? 'awaiting_client' : 'active', summary: siteKey === 'cato' ? 'Your website is ready for review. You can suggest edits and leave comments whenever you are ready.' : 'Your website project and review workspace.', next_milestone: siteKey === 'cato' ? 'Cato review' : 'Review website content' }).select('id').single()
  if (projectError || !project) throw projectError ?? new Error('Project was not created')
  if (siteKey === 'cato') {
    const milestones = ['Project planning', 'Website design', 'Website build', 'Portal and editor', 'Cato review'].map((title, position) => ({ tenant_id: tenant.id, project_id: project.id, title, position, status: position < 4 ? 'complete' : 'current' }))
    const { error: milestoneError } = await db.from('portal_milestones').insert(milestones)
    if (milestoneError) throw milestoneError
  } else {
    const { error: taskError } = await db.from('portal_tasks').insert([
      { tenant_id: tenant.id, project_id: project.id, title: 'Complete website intake', owner_type: 'client', status: 'todo' },
      { tenant_id: tenant.id, project_id: project.id, title: 'Review and comment on the website', owner_type: 'client', status: 'todo' },
    ])
    if (taskError) throw taskError
  }
  process.stdout.write(`Client: ${name}\nProject: ${project.id}\nSite profile: ${siteKey ?? 'generic'}\nClient ID: ${id}\nPassword: ${password}\nStore this password securely. It is shown only now.\n`)
} catch (error) {
  if (tenantId) await db.from('portal_tenants').delete().eq('id', tenantId)
  await db.auth.admin.deleteUser(userId)
  throw error
}
