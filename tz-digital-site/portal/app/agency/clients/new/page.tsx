import { redirect } from 'next/navigation'
import { userClient } from '@/lib/supabase'
import { NewClientForm } from './new-client-form'

export const dynamic = 'force-dynamic'
const agencyRoles = ['agency_owner', 'agency_admin']

export default async function NewClientPage() {
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: membership } = await supabase.from('portal_memberships')
    .select('role').eq('user_id', auth.user.id).in('role', agencyRoles).limit(1).maybeSingle()
  if (!membership) redirect('/dashboard')
  return <main style={{ minHeight: '100vh', background: '#140e25', color: '#f7f3ff', padding: '32px clamp(18px, 5vw, 72px)', fontFamily: 'inherit' }}>
    <NewClientForm />
  </main>
}
