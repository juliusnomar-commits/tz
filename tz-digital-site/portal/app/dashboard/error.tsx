'use client'

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="dash-error" role="alert"><span className="eyebrow accent">CLIENT PORTAL</span><h1>We couldn’t load your workspace.</h1><p>Please try again. If the problem continues, contact your TZ Digital team.</p><button type="button" onClick={reset}>Try again ↗</button></main>
}
