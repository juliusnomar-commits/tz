'use client'

import { useState } from 'react'
import Link from 'next/link'

type Created = { client: { id: string; name: string }; project: { id: string; name: string }; invitation: { loginId: string; password: string } }
const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #58476d', background: '#171025', color: '#f7f3ff', font: 'inherit' } as const
const labelStyle = { display: 'grid', gap: 8, color: '#e9e1f6', fontSize: 14, fontWeight: 650 } as const

export function NewClientForm() {
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [siteMode, setSiteMode] = useState<'generic' | 'cato' | 'custom'>('generic')
  const [configText, setConfigText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)

  async function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setCreated(null)
    try {
      let siteConfig: unknown
      if (siteMode === 'custom') {
        try { siteConfig = JSON.parse(configText) } catch { throw new Error('The site profile must be valid JSON') }
      }
      const response = await fetch('/api/agency/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName, projectName, siteMode, siteConfig }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Unable to create client workspace')
      setCreated(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create client workspace')
    } finally {
      setBusy(false)
    }
  }

  async function copyCredentials() {
    if (!created) return
    await navigator.clipboard.writeText('TZ Digital client login\nClient ID: ' + created.invitation.loginId + '\nPassword: ' + created.invitation.password)
    setCopied(true)
  }

  const panel = { padding: 24, background: '#211a34', border: '1px solid #443558', borderRadius: 16 }

  return <div style={{ maxWidth: 760, margin: '0 auto' }}>
    <p style={{ color: '#bdb0d3', letterSpacing: 2, fontSize: 12, textTransform: 'uppercase' }}>TZ DIGITAL · CLIENT SETUP</p>
    <h1 style={{ fontSize: 32, margin: '8px 0' }}>Create a client workspace</h1>
    <p style={{ color: '#bdb0d3', lineHeight: 1.6 }}>Set up the client organization, project, review checklist, milestones, and login credentials in one pass.</p>
    {!created ? <form onSubmit={createClient} style={{ ...panel, display: 'grid', gap: 20, marginTop: 24 }}>
      <label style={labelStyle}>Client or organization name<input required maxLength={160} value={clientName} onChange={event => setClientName(event.target.value)} style={inputStyle} placeholder="Example: Cato by Cato" /></label>
      <label style={labelStyle}>Project name<input required maxLength={160} value={projectName} onChange={event => setProjectName(event.target.value)} style={inputStyle} placeholder="Example: Website redesign" /></label>
      <label style={labelStyle}>Portal setup
        <select value={siteMode} onChange={event => setSiteMode(event.target.value as typeof siteMode)} style={inputStyle}>
          <option value="generic">General website workspace</option>
          <option value="cato">Cato editor template (sample site)</option>
          <option value="custom">Custom site profile JSON</option>
        </select>
      </label>
      {siteMode === 'cato' && <p style={{ color: '#bdb0d3', margin: '-10px 0 0', lineHeight: 1.55 }}>Creates a separate client project using Cato’s sample editor profile. Their draft and live records remain project-scoped.</p>}
      {siteMode === 'custom' && <><p style={{ color: '#bdb0d3', margin: '-10px 0 0', lineHeight: 1.55 }}>For the Cato sample, the minimal override below inherits its pages, editable text, images, colors, and preview. A different site key needs those fields in the JSON too.</p><label style={labelStyle}>Site profile JSON<textarea required rows={12} value={configText} onChange={event => setConfigText(event.target.value)} spellCheck={false} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} placeholder={['{', '  "key": "cato",', '  "name": "Client website",', '  "domain": "cato-brown.vercel.app",', '  "previewRoot": "/site-previews/cato"', '}'].join('\\n')} /></label></>}
      {error && <p role="alert" style={{ color: '#ff9c9c', margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ justifySelf: 'start', border: 0, borderRadius: 10, padding: '12px 18px', background: '#d6b8ff', color: '#241638', fontWeight: 750, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Creating workspace…' : 'Create client workspace'}</button>
    </form> : <section style={{ ...panel, marginTop: 24 }}>
      <div style={{ color: '#a6e3b1', fontWeight: 750 }}>Client workspace created</div>
      <h2 style={{ marginBottom: 6 }}>{created.client.name}</h2>
      <p style={{ color: '#bdb0d3', marginTop: 0 }}>{created.project.name} · Project ID {created.project.id}</p>
      <div style={{ display: 'grid', gap: 8, padding: 16, borderRadius: 12, background: '#171025', overflowWrap: 'anywhere' }}>
        <b>Share these login credentials with the client</b>
        <div>Client ID: <code>{created.invitation.loginId}</code></div>
        <div>Password: <code>{created.invitation.password}</code></div>
        <small style={{ color: '#bdb0d3' }}>The password is shown only here. Copy and store it before leaving this page.</small>
      </div>
      <button type="button" onClick={() => void copyCredentials()} style={{ marginTop: 14, border: '1px solid #77658d', borderRadius: 9, padding: '10px 14px', background: 'transparent', color: '#f7f3ff', cursor: 'pointer' }}>{copied ? 'Copied' : 'Copy credentials'}</button>
      <p><Link href={'/projects/' + encodeURIComponent(created.project.id) + '/content'} style={{ color: '#d7c1ff' }}>Open the new project</Link></p>
      <button type="button" onClick={() => { setCreated(null); setClientName(''); setProjectName(''); setSiteMode('generic') }} style={{ border: 0, background: 'transparent', color: '#d7c1ff', cursor: 'pointer' }}>Create another client</button>
    </section>}
    <p style={{ marginTop: 22 }}><Link href="/agency" style={{ color: '#d7c1ff' }}>← Back to agency overview</Link></p>
  </div>
}
