'use server'

import { createHash, createHmac } from 'node:crypto'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { adminClient, userClient } from '@/lib/supabase'

function loginKey(value: string) {
  const secret = process.env.PORTAL_LOGIN_HASH_SECRET
  if (!secret || secret.length < 32) throw new Error('PORTAL_LOGIN_HASH_SECRET must be at least 32 characters')
  return createHmac('sha256', secret).update(value).digest('hex')
}

export async function login(form: FormData) {
  const clientId = String(form.get('clientId') ?? '').trim()
  const password = String(form.get('password') ?? '')
  if (!/^\d{6}$/.test(clientId) || !password || password.length > 256) redirect('/login?error=1')

  const headerStore = await headers()
  const ip = headerStore.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const admin = adminClient()
  const checks = await Promise.all([
    admin.rpc('portal_allow_login_attempt', { p_key: loginKey(`pair:${clientId}:${ip}`), p_limit: 5 }),
    admin.rpc('portal_allow_login_attempt', { p_key: loginKey(`id:${clientId}`), p_limit: 20 }),
    admin.rpc('portal_allow_login_attempt', { p_key: loginKey(`ip:${ip}`), p_limit: 50 }),
  ])
  if (checks.some(({ data, error }) => error || !data)) redirect('/login?error=1')

  const { data: loginId } = await admin.from('portal_login_ids').select('auth_user_id, auth_email').eq('login_id', clientId).maybeSingle()
  const email = loginId?.auth_email ?? `missing-${createHash('sha256').update(clientId).digest('hex').slice(0, 16)}@tz-digital.de`
  const supabase = await userClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  const user = data.user
  if (error || !user || user.id !== loginId?.auth_user_id) redirect('/login?error=1')

  const { data: membership } = await supabase.from('portal_memberships').select('tenant_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership) {
    await supabase.auth.signOut()
    redirect('/login?error=1')
  }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await userClient()
  await supabase.auth.signOut()
  redirect('/login')
}
