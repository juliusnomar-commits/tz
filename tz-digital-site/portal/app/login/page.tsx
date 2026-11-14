import Image from 'next/image'
import { login } from './actions'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const accessReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.PORTAL_LOGIN_HASH_SECRET)
  return <main className="login-layout">
    <section className="login-intro">
      <a className="brand" href="/"><Image src="/tz-mark.png" width={42} height={42} alt="" /><span>TZ <b>Digital</b></span></a>
      <div className="intro-copy"><span className="eyebrow">CLIENT PORTAL / 01</span><h1>Everything moving.<br /><em>All in one place.</em></h1><p>See what comes next, share what we need, and follow your project from first brief to launch.</p></div>
      <div className="intro-foot">A clearer way to build together. <span>↗</span></div>
    </section>
    <section className="login-panel">
      <div className="login-top">PRIVATE ACCESS <span>↗</span></div>
      <div className="login-content">
        <span className="eyebrow accent">WELCOME BACK</span>
        <h2>Sign in to<br />your space.</h2>
        <p className="muted">{accessReady ? 'Use the six-digit client ID and password your TZ Digital team gave you.' : 'Customer access is being set up. Explore the Roundabout example while the portal is configured.'}</p>
        {accessReady ? <form action={login} className="login-form">
          <label htmlFor="client-id">Client ID</label>
          <input id="client-id" name="clientId" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} autoComplete="username" placeholder="000000" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          {error && <p className="form-error" role="alert">We couldn’t sign you in. Check your ID and password, or contact your TZ Digital team.</p>}
          <button type="submit">Open client portal <span>↗</span></button>
        </form> : <p className="help"><a href="/demo">Open the interactive demo ↗</a></p>}
        {accessReady && <p className="help">Need access or a new password? <a href="/#kontakt">Contact your TZ Digital team</a>.</p>}
        <p className="help"><a href="/">← Zurück zur TZ Digital Website</a></p>
      </div>
      <div className="login-bottom">YOUR PROJECT, ALL IN ONE PLACE <span>© TZ DIGITAL</span></div>
    </section>
  </main>
}
