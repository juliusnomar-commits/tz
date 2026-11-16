import { createClient } from '@supabase/supabase-js'

const [projectId, loginId] = process.argv.slice(2)
const password = process.env.CATO_PORTAL_PASSWORD
if (!/^[0-9a-f-]{36}$/i.test(projectId ?? '') || !/^[A-Za-z][A-Za-z0-9]{2,31}$/.test(loginId ?? '')) {
  throw new Error('Usage: CATO_PORTAL_PASSWORD=... npm run activate-cato-login -- PROJECT_UUID LOGIN_ID')
}
if (!password || password.length < 8) throw new Error('Set CATO_PORTAL_PASSWORD to at least eight characters')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase configuration is missing')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: project, error: projectError } = await db.from('portal_projects').select('tenant_id, site_key').eq('id', projectId).single()
if (projectError || project?.site_key !== 'cato') throw projectError ?? new Error('Cato project not found')
const { data: clients, error: memberError } = await db.from('portal_memberships').select('user_id').eq('tenant_id', project.tenant_id).eq('role', 'client_owner')
if (memberError || clients?.length !== 1) throw memberError ?? new Error('Expected one Cato client owner')
const userId = clients[0].user_id
const { data: current, error: currentError } = await db.from('portal_login_ids').select('login_id').eq('auth_user_id', userId).single()
if (currentError || !current) throw currentError ?? new Error('Cato client login not found')
const { data: conflict, error: conflictError } = await db.from('portal_login_ids').select('auth_user_id').ilike('login_id', loginId).maybeSingle()
if (conflictError || (conflict && conflict.auth_user_id !== userId)) throw conflictError ?? new Error('Login ID is already in use')

if (current.login_id !== loginId) {
  const { error } = await db.from('portal_login_ids').update({ login_id: loginId }).eq('auth_user_id', userId)
  if (error) throw error
}
const { error: passwordError } = await db.auth.admin.updateUserById(userId, { password })
if (passwordError) {
  if (current.login_id !== loginId) {
    const { error: rollbackError } = await db.from('portal_login_ids').update({ login_id: current.login_id }).eq('auth_user_id', userId)
    if (rollbackError) throw new Error('Password update failed and login ID rollback failed; inspect the client account before retrying')
  }
  throw passwordError
}
process.stdout.write(`Cato login ID updated to ${loginId}. Password was updated but is not displayed.\n`)
