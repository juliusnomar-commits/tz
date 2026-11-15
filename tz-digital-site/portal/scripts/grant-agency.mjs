import { createClient } from '@supabase/supabase-js'

const [loginId, projectId] = process.argv.slice(2)
if (!/^\d{6}$/.test(loginId ?? '') || !/^[0-9a-f-]{36}$/i.test(projectId ?? '')) throw new Error('Usage: npm run grant-agency -- SIX_DIGIT_AGENCY_ID PROJECT_UUID')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY')
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const [{ data: login, error: loginError }, { data: project, error: projectError }] = await Promise.all([
  db.from('portal_login_ids').select('auth_user_id').eq('login_id', loginId).single(),
  db.from('portal_projects').select('tenant_id, name').eq('id', projectId).single(),
])
if (loginError || !login || projectError || !project) throw loginError ?? projectError ?? new Error('Login or project not found')
const { data: user, error: userError } = await db.auth.admin.getUserById(login.auth_user_id)
if (userError || !user.user?.app_metadata?.agency) throw new Error('Login ID is not an agency account')
const { error } = await db.from('portal_memberships').upsert({ tenant_id: project.tenant_id, user_id: login.auth_user_id, role: 'agency_owner' }, { onConflict: 'tenant_id,user_id' })
if (error) throw error
process.stdout.write(`Agency ${loginId} can review ${project.name}.\n`)
