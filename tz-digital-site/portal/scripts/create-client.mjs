import { randomBytes, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const name = process.argv.slice(2).join(' ').trim()
if (!name || name.length > 160) {
  process.stderr.write('Usage: npm run create-client -- "Client organization name"\n')
  process.exit(1)
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

let id
for (let i = 0; i < 20; i++) {
  const candidate = String(randomInt(0, 1_000_000)).padStart(6, '0')
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
  process.stdout.write(`Client: ${name}\nClient ID: ${id}\nPassword: ${password}\nStore this password securely. It is shown only now.\n`)
} catch (error) {
  if (tenantId) await db.from('portal_tenants').delete().eq('id', tenantId)
  await db.auth.admin.deleteUser(userId)
  throw error
}
