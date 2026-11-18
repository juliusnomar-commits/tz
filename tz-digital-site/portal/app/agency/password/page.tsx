import Link from 'next/link'
import { redirect } from 'next/navigation'
import { userClient } from '@/lib/supabase'
import { changeAgencyPassword } from './actions'

export const dynamic = 'force-dynamic'

type Params = { error?: string; success?: string }
const messages: Record<string, string> = {
  mismatch: 'The new passwords do not match.',
  policy: 'Use a new password of at least 12 characters, different from the current one.',
  incorrect: 'The current password was incorrect.',
  update: 'The password could not be changed. Please try again.',
}

export default async function AgencyPasswordPage({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await userClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: members, error: membershipError } = await supabase.from('portal_memberships')
    .select('role').eq('user_id', auth.user.id)
  if (membershipError || !(members ?? []).some(m => ['agency_owner','agency_admin','agency_member'].includes(m.role))) redirect('/dashboard')
  const { error, success } = await searchParams
  return <main style={{minHeight:'100vh',background:'#140e25',color:'#f7f3ff',padding:'48px 20px',fontFamily:'inherit'}}>
    <section style={{maxWidth:500,margin:'0 auto'}}>
      <Link href="/agency" style={{color:'#d7c1ff'}}>← Agency dashboard</Link>
      <p style={{color:'#b8aacb',fontSize:12,letterSpacing:2,marginTop:36}}>TZ DIGITAL · SECURE ACCOUNT</p>
      <h1 style={{fontSize:32}}>Change your password</h1>
      <p style={{color:'#b8aacb'}}>Enter your current agency password and choose a unique new password. Nothing is sent through chat or saved in the project repository.</p>
      {success==='1' && <p role="status" style={{color:'#a9f1c1'}}>Your password has been changed successfully.</p>}
      {error && <p role="alert" style={{color:'#ffb6b6'}}>{messages[error] ?? 'Could not change password.'}</p>}
      <form action={changeAgencyPassword} style={{display:'grid',gap:14,background:'#211a34',border:'1px solid #443558',borderRadius:16,padding:24,marginTop:20}}>
        <label htmlFor="currentPassword">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} style={{padding:12,borderRadius:8}}/>
        <label htmlFor="newPassword">New password (at least 12 characters)</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} style={{padding:12,borderRadius:8}}/>
        <label htmlFor="confirmPassword">Confirm new password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} style={{padding:12,borderRadius:8}}/>
        <button type="submit" style={{background:'#8063bd',border:0,borderRadius:8,color:'white',fontWeight:650,padding:14,cursor:'pointer'}}>Change password</button>
      </form>
      <p style={{color:'#b8aacb',fontSize:13,marginTop:24}}>Only the account currently signed in can change its password here. Your old password is required.</p>
    </section>
  </main>
}
