import Image from 'next/image'
import { login } from './actions'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const accessReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.PORTAL_LOGIN_HASH_SECRET)
  return <main className="login-layout">
    <section className="login-intro">
      <a className="brand" href="/"><Image src="/tz-mark.png" width={42} height={42} alt="" /><span>TZ <b>Digital</b></span></a>
      <div className="intro-copy"><span className="eyebrow">TZ DIGITAL / CLIENT SPACE</span><h1>Your website.<br /><em>In your hands.</em></h1><p>See your project take shape, share what matters, and review every detail in one calm space.</p></div>
      <div className="login-showcase" aria-hidden="true"><div className="login-showcase-top"><span>THE ROUNDABOUT / EXAMPLE PROJECT</span><span>↗</span></div><div className="login-showcase-image"><Image src="/roundabout-demo-terrace.jpg" alt="" width={600} height={270} /><span>YOUR SITE, IN VIEW.</span></div><div className="login-showcase-bottom"><span><b>01</b> Share the details</span><span><b>02</b> Review the design</span><span><b>03</b> Send feedback</span></div></div>
      <div className="intro-foot">Built with you, every step of the way. <span>© TZ DIGITAL</span></div>
    </section>
    <section className="login-panel">
      <div className="login-top">SECURE CLIENT ACCESS <span>↗</span></div>
      <div className="login-content">
        <span className="eyebrow accent">WELCOME TO YOUR SPACE</span>
        <h2>Welcome to<br />your space.</h2>
        <p className="muted">Enter the six-digit ID and password from TZ Digital. No account setup needed.</p>
        <form action={login} className="login-form">
          <label htmlFor="client-id">Your six-digit client ID</label>
          <input id="client-id" name="clientId" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} autoComplete="username" placeholder="e.g. 146069" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
          {error && <p className="form-error" role="alert">That ID and password did not match. Check the details and try again.</p>}
          <button type="submit">Enter client portal <span>↗</span></button>
        </form>
        <div className="login-demo-card"><span className="login-demo-label">TRY THE ROUNDABOUT EXAMPLE</span><p>Use the sample details to explore the client experience.</p><div><span>Client ID <strong>146069</strong></span><span>Password <strong>RoundaboutDemo26!</strong></span></div></div>
        <p className="help">{accessReady ? 'Need access or a new password?' : 'Your real client login will be available once your project is connected.'} {accessReady && <a href="/#kontakt">Contact TZ Digital</a>}</p>
        <p className="help login-back"><a href="/">← Back to TZ Digital</a></p>
      </div>
      <div className="login-bottom">A CLEARER WAY TO BUILD TOGETHER <span>© TZ DIGITAL</span></div>
    </section>
  </main>
}
