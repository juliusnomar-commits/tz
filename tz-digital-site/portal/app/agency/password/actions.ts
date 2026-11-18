'use server'

import { redirect } from 'next/navigation'
import { userClient } from '@/lib/supabase'

export async function changeAgencyPassword(form: FormData) {
  const current = String(form.get('currentPassword') ?? '')
  const next = String(form.get('newPassword') ?? '')
  const confirm = String(form.get('confirmPassword') ?? '')
  if (next !== confirm) redirect('/agency/password?error=mismatch')
  if (next.length < 12 || next.length > 128 || next === current) redirect('/agency/password?error=policy')
  if (current.length < 1 || current.length > 256) redirect('/agency/password?error=incorrect')

  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user?.email) redirect('/login')
  const { data: memberships, error: membershipError } = await supabase.from('portal_memberships')
    .select('role').eq('user_id', auth.user.id)
  if (membershipError || !(memberships ?? []).some(m => ['agency_owner','agency_admin','agency_member'].includes(m.role))) {
    redirect('/dashboard')
  }

  // The user must know their existing password; a session alone is not enough.
  const { data: checked, error: checkError } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: current,
  })
  if (checkError || checked.user?.id !== auth.user.id) redirect('/agency/password?error=incorrect')
  const { error: updateError } = await supabase.auth.updateUser({ password: next })
  if (updateError) redirect('/agency/password?error=update')
  redirect('/agency/password?success=1')
}
