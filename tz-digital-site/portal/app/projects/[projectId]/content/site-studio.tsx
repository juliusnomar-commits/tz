'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { SiteProfile } from '@/lib/site-profiles'
import type { VisualPin } from '@/lib/content'

type Review = { page_key: string; changes: Record<string,string>; images: Record<string,string>; colors: Record<string,string>; pins: VisualPin[]; status: 'draft'|'submitted'|'approved'; version: number; updated_at: string; snapshot_path?: string|null; snapshot_device?: Device|null }
type Props = { projectId: string; profile: SiteProfile; initialPages: Review[]; initialImages: { id: string; display_name: string }[]; canEdit: boolean; isAgency: boolean; demo?: boolean }
type Mode = 'text'|'images'|'colors'|'pins'
type Device = 'desktop'|'mobile'
const empty = (key: string): Review => ({ page_key: key, changes: {}, images: {}, colors: {}, pins: [], status: 'draft', version: 0, updated_at: '' })

export function SiteStudio({ projectId, profile, initialPages, initialImages, canEdit, isAgency, demo = false }: Props) {
  const [pageKey, setPageKey] = useState(profile.pages[0].key)
  const [reviews, setReviews] = useState<Record<string,Review>>(() => Object.fromEntries(initialPages.map(page => [page.page_key,page])))
  const [saved, setSaved] = useState<Record<string,Review>>(() => Object.fromEntries(initialPages.map(page => [page.page_key,page])))
  const [mode, setMode] = useState<Mode>('text')
  const [device, setDevice] = useState<Device>('desktop')
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<Omit<VisualPin,'id'|'comment'>|null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState(initialImages)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const frameConfigured = useRef(false)
  const page = reviews[pageKey] ?? empty(pageKey)
  const original = saved[pageKey] ?? empty(pageKey)
  const dirty = JSON.stringify([page.changes,page.images,page.colors,page.pins]) !== JSON.stringify([original.changes,original.images,original.colors,original.pins])
  const current = profile.pages.find(item => item.key === pageKey) ?? profile.pages[0]
  const copyKeys = Object.keys(profile.copy).filter(key => key.startsWith(current.prefix) || key.startsWith('nav_'))
  const imageKeys = Object.keys(profile.images).filter(key => key.startsWith(current.prefix) || key === current.key + '_hero' || (pageKey === 'home' && key.startsWith('home_')))
  const state = { changes: page.changes, images: page.images, colors: page.colors, pins: page.pins }
  useEffect(() => { if (demo) { try { const items = JSON.parse(sessionStorage.getItem('tz-cato-demo') ?? '{}') as Record<string,Review>; setReviews(items); setSaved(items) } catch { /* Ignore stale preview data. */ } } }, [demo])
  function post(type: 'configure'|'update') { frame.current?.contentWindow?.postMessage({ source: 'tz-portal-editor', type, state, imageKeys: profile.images, mode }, window.location.origin) }
  useEffect(() => { post('update') }) // Keep the real page in sync with edits and mode changes.
  useEffect(() => {
    frameConfigured.current = false
    const timer = setInterval(() => { if (!frameConfigured.current) post('configure') }, 1000)
    post('configure')
    return () => clearInterval(timer)
  }, [pageKey, device])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const updateScale = () => element.style.setProperty('--preview-scale', String(Math.min(1, element.clientWidth / (device === 'desktop' ? 1440 : 390))))
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    updateScale()
    return () => observer.disconnect()
  }, [device, expanded])
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== 'tz-site-preview') return
      const data = event.data
      if (data.type === 'ready') post('configure')
      if (data.type === 'configured') { frameConfigured.current = true; post('update') }
      if (data.type === 'select' && canEdit) { setExpanded(false); setMode(data.kind); setSelected(data.key); setError('') }
      if (data.type === 'pin-place' && canEdit) { setExpanded(false); setMode('pins'); setPending({ x: data.x, y: data.y, target: data.target }); setComment('') }
      if (data.type === 'pin-selected') { setMode('pins'); setSelected(data.id); setPending(null) }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  })
  function update(change: Partial<Review>) {
    setReviews(old => ({ ...old, [pageKey]: { ...(old[pageKey] ?? empty(pageKey)), ...change, status: 'draft' } }))
    setNotice(''); setError('')
  }
  function pickPage(key: string) { setPageKey(key); setSelected(''); setPending(null); setNotice(''); setError('') }
  function addPin() {
    if (!pending || !comment.trim()) { setError('Write a comment for the pin.'); return }
    update({ pins: [...page.pins, { id: crypto.randomUUID(), ...pending, comment: comment.trim() }] })
    setPending(null); setComment('')
  }
  async function upload(files: FileList | File[]) {
    if (!canEdit) return
    if (demo) { setError('Demo only: uploads need a connected customer project.'); return }
    setUploading(true); setError(''); setNotice('')
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!url || !key) throw new Error('Image storage is not configured')
      const storage = createClient(url, key).storage.from('portal-intake')
      for (const file of Array.from(files)) {
        if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: use JPG, PNG or WebP under 10 MB`)
        const prepare = await fetch(`/api/projects/${projectId}/uploads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size, category: 'brand' }) })
        const signed = await prepare.json()
        if (!prepare.ok) throw new Error(signed.error ?? 'Unable to prepare upload')
        const result = await storage.uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })
        if (result.error) throw result.error
        const finish = await fetch(`/api/projects/${projectId}/uploads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: signed.path, name: file.name, category: 'brand' }) })
        const recorded = await finish.json()
        if (!finish.ok) throw new Error(recorded.error ?? 'Unable to record upload')
        setUploadedImages(old => [recorded.file, ...old])
        if (selected && selected in profile.images) update({ images: { ...page.images, [selected]: `/api/projects/${projectId}/files/${recorded.file.id}` } })
      }
      setNotice('Image uploaded privately. Save the page to keep this selection.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed') }
    finally { setUploading(false) }
  }
  async function capturePage() {
    const document = frame.current?.contentDocument
    const body = document?.body
    if (!document || !body) throw new Error('Wait for the site preview to finish loading before submitting')
    const ready = await new Promise<boolean>(resolve => {
      const until = Date.now() + 15000
      const check = () => {
        if (frameConfigured.current && body.querySelectorAll('.tz-preview-pin').length === page.pins.length) resolve(true)
        else if (Date.now() >= until) resolve(false)
        else setTimeout(check, 200)
      }
      check()
    })
    if (!ready) throw new Error('Wait for the site preview and comment pins to finish loading before submitting')
    const width = Math.max(document.documentElement.scrollWidth, body.scrollWidth)
    const height = Math.max(document.documentElement.scrollHeight, body.scrollHeight)
    const view = document.defaultView as (Window & { htmlToImage?: { toJpeg: (node: HTMLElement, options: Record<string, unknown>) => Promise<string> } }) | null
    if (!view) throw new Error('The site preview is unavailable')
    if (!view.htmlToImage) await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/site-previews/cato/js/html-to-image.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Unable to load the page capture tool'))
      document.head.appendChild(script)
    })
    if (!view.htmlToImage) throw new Error('Unable to load the page capture tool')
    const reveal = Array.from(body.querySelectorAll<HTMLElement>('.fade-in-section')).map(element => ({ element, style: element.getAttribute('style'), visible: element.classList.contains('visible') }))
    reveal.forEach(({ element }) => { element.classList.add('visible'); element.style.opacity = '1'; element.style.transform = 'none'; element.style.transition = 'none' })
    let image: Blob
    try {
      const scale = Math.min(1, 12000 / height, 1800 / width)
      const dataUrl = await view.htmlToImage.toJpeg(body, { quality: 0.82, skipFonts: true, onImageErrorHandler: () => {},
        backgroundColor: document.defaultView?.getComputedStyle(body).backgroundColor ?? '#ffffff',
        width, height, canvasWidth: Math.round(width * scale), canvasHeight: Math.round(height * scale) })
      image = await (await fetch(dataUrl)).blob()
    } finally { reveal.forEach(({ element, style, visible }) => { if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style); if (!visible) element.classList.remove('visible') }) }
    if (image.size > 10 * 1024 * 1024) throw new Error('The page capture is too large; try the mobile view')
    const prepare = await fetch(`/api/projects/${projectId}/site-snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageKey, size: image.size }) })
    const signed = await prepare.json()
    if (!prepare.ok) throw new Error(signed.error ?? 'Unable to prepare page capture')
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!).storage.from('portal-intake')
    const uploaded = await storage.uploadToSignedUrl(signed.path, signed.token, image, { contentType: 'image/jpeg' })
    if (uploaded.error) throw uploaded.error
    return signed.path as string
  }
  async function save(intent: 'save'|'submit'|'approve') {
    setBusy(true); setError(''); setNotice('')
    try {
      if (demo) {
        const next: Review = { ...page, status: intent === 'save' ? 'draft' : intent === 'submit' ? 'submitted' : 'approved', version: page.version + 1, updated_at: new Date().toISOString() }
        const items = { ...reviews, [pageKey]: next }
        sessionStorage.setItem('tz-cato-demo', JSON.stringify(items)); setReviews(items); setSaved(items)
        setNotice('Demo only: saved in this browser session. Connect storage for a real client account.')
        return
      }
      const snapshotPath = intent === 'submit' ? await capturePage() : null
      const response = await fetch(`/api/projects/${projectId}/site`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageKey, ...state, intent, expectedVersion: page.version, snapshotPath, snapshotDevice: intent === 'submit' ? device : null }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to save')
      setReviews(old => ({ ...old, [pageKey]: data.page })); setSaved(old => ({ ...old, [pageKey]: data.page }))
      setNotice(intent === 'save' ? 'Draft saved.' : intent === 'submit' ? 'Sent to TZ Digital with a page capture and pinned comments.' : 'Changes approved. TZ Digital can apply them to the live site.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save') }
    finally { setBusy(false) }
  }
  return <main className="cms-app site-editor"><header className="cms-header portal-pill-header"><a className="portal-pill-logo" href={demo ? '/demo' : '/dashboard'}><span>TZ</span> Digital</a><nav className="portal-pill-links" aria-label="Portal navigation"><a href={demo ? '/demo' : '/dashboard'}>Dashboard</a><a href={demo ? '/demo/intake' : `/projects/${projectId}/intake`}>Website intake</a><a href={demo ? '/demo/cato' : `/projects/${projectId}/content`} aria-current="page">Site review</a></nav><a className="portal-pill-action" href="/">TZ Digital site ↗</a></header>{demo && <div className="dash-demo-banner">Cato editor preview · Changes stay in this browser session</div>}
    <div className="cms-body"><div className="cms-intro"><span className="eyebrow accent">REAL SITE / VISUAL EDITOR</span><h1>Review <em>{profile.name}.</em></h1><p>Browse the actual site design. Click text or images to suggest changes, try colors, and pin comments. Your changes stay in review until TZ Digital applies them.</p><a className="cms-reference" href={`https://${profile.domain}`} target="_blank" rel="noreferrer">Open current site ↗</a></div>
      <div className="cms-workspace"><aside className="cms-pages"><span className="eyebrow">PAGES</span><nav aria-label="Site pages">{profile.pages.map((item,index) => <button type="button" key={item.key} className={pageKey === item.key ? 'active' : ''} onClick={() => pickPage(item.key)}><span className="cms-page-index">{String(index+1).padStart(2,'0')}</span><span><strong>{item.title}</strong><small>{reviews[item.key]?.status ?? 'Draft'}</small></span><span>↗</span></button>)}</nav>{isAgency && <a className="cms-export" href={`/api/projects/${projectId}/export`}>↓ Download review handoff</a>}<p className="cms-help">Every page has its own draft and review status. Changes here do not publish directly to Cato.</p></aside>
        <section className={'cms-main' + (expanded ? ' is-expanded' : '')}><div className="cms-toolbar"><div><span className="eyebrow accent">{current.title.toUpperCase()} / EXACT SITE PREVIEW</span><h2>{current.title} page</h2></div><span className={`cms-state is-${page.status}`}>{dirty ? 'Unsaved changes' : page.status}</span></div>
          <div className="cms-tools" role="toolbar" aria-label="Editor tools">{([['text','✎ Text'],['images','▧ Images'],['colors','◉ Colors'],['pins','◎ Comments']] as const).map(([key,label]) => <button type="button" key={key} className={mode === key ? 'active' : ''} onClick={() => { setMode(key); setSelected('') }}>{label}{key === 'pins' && page.pins.length ? ` ${page.pins.length}` : ''}</button>)}</div>
          <div className="cms-review-controls"><div className="cms-device-switch" aria-label="Preview size"><button type="button" className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>▣ Desktop</button><button type="button" className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>▯ Mobile</button></div><button type="button" className="cms-expand-preview" onClick={() => setExpanded(value => !value)}>{expanded ? '↙ Close full preview' : '⛶ Full preview'}</button><button type="button" className={'cms-add-pin ' + (mode === 'pins' ? 'active' : '')} onClick={() => setMode('pins')}>⊕ Drop a comment pin</button></div>
          <div className={'cms-preview-stage is-' + device}><div className="cms-browser"><div className="cms-browser-bar"><i/><i/><i/><span>{profile.domain}/{current.path === 'index.html' ? '' : current.path}</span><b>{device.toUpperCase()} VIEW</b></div><div className="site-editor-viewport" ref={viewport}><iframe key={pageKey + device} ref={frame} className="site-editor-frame" title={`${profile.name} ${current.title} preview`} src={`${profile.previewRoot}/${current.path}`} onLoad={() => { frameConfigured.current = false; post('configure') }} /></div></div></div><p className="cms-preview-note">{mode === 'pins' ? 'Click anywhere on the page to place a comment pin.' : 'Scroll the complete page and click an item to edit it.'}</p></section>
        <aside className="cms-inspector"><span className="eyebrow accent">INSPECTOR / {mode.toUpperCase()}</span>
          {mode === 'text' && <><h3>Page text</h3><p>Click text inside the preview or select a field.</p><div className="cms-field-choices">{copyKeys.map(key => <button type="button" key={key} className={selected === key ? 'active' : ''} onClick={() => setSelected(key)}>{key.replaceAll('_',' ')}</button>)}</div>{selected && selected in profile.copy && <label className="cms-input-label">{selected.replaceAll('_',' ')}<textarea rows={5} value={page.changes[selected] ?? profile.copy[selected]} onChange={event => update({ changes: { ...page.changes, [selected]: event.target.value } })} disabled={!canEdit} /></label>}</>}
          {mode === 'images' && <><h3>Site images</h3><p>Click an image in the preview, then choose a replacement or drop a new image here.</p><div className="site-editor-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files) }}><label>{uploading ? 'Uploading…' : 'Drop images here or choose files'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit || uploading} onChange={event => { if (event.target.files) void upload(event.target.files); event.target.value = '' }} /></label></div>{selected && selected in profile.images && <><strong className="site-editor-selected">{selected.replaceAll('_',' ')}</strong><div className="site-editor-images">{uploadedImages.map(file => { const path = `/api/projects/${projectId}/files/${file.id}`; return <button type="button" key={file.id} className={page.images[selected] === path ? 'active' : ''} onClick={() => update({ images: { ...page.images, [selected]: path } })} disabled={!canEdit}><img src={path} alt="" /><span>{file.display_name}</span></button> })}{Object.entries(profile.images).map(([key,path]) => <button type="button" key={key} className={(page.images[selected] ?? profile.images[selected]) === path ? 'active' : ''} onClick={() => update({ images: { ...page.images, [selected]: path } })} disabled={!canEdit}><img src={path.startsWith('images/') ? `https://${profile.domain}/${path}` : path} alt="" /><span>{key.replaceAll('_',' ')}</span></button>)}</div></>}{!selected && <div className="cms-field-choices">{imageKeys.map(key => <button type="button" key={key} onClick={() => setSelected(key)}>{key.replaceAll('_',' ')}</button>)}</div>}</>}
          {mode === 'colors' && <><h3>Site colors</h3><p>Preview changes to Cato’s real color tokens.</p>{Object.entries(profile.colors).map(([key,value]) => <label className="cms-color-row" key={key}><span>{key.replaceAll('-',' ')}</span><input type="color" value={page.colors[key] ?? value} onChange={event => update({ colors: { ...page.colors, [key]: event.target.value } })} disabled={!canEdit} /><code>{page.colors[key] ?? value}</code></label>)}</>}
          {mode === 'pins' && <><h3>Pinned comments</h3><p>Click the page where your team should look.</p>{pending && <div className="cms-comment-form"><strong>New pin</strong><textarea rows={4} maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} placeholder="What should change here?" aria-label="Comment" /><div><button type="button" onClick={addPin}>Add pin</button><button type="button" onClick={() => setPending(null)}>Cancel</button></div></div>}{page.pins.length ? <ol className="cms-pin-list">{page.pins.map((pin,index) => <li key={pin.id}><button type="button" onClick={() => setSelected(pin.id)}><b>{index+1}</b>{pin.comment}</button>{canEdit && <button type="button" className="site-editor-remove" onClick={() => update({ pins: page.pins.filter(item => item.id !== pin.id) })}>Remove</button>}</li>)}</ol> : !pending && <p>No comments yet.</p>}</>}
          {error && <p className="cms-error" role="alert">{error}</p>}{notice && <p className="cms-message" role="status">{notice}</p>}{canEdit && <div className="cms-actions"><button type="button" className="cms-secondary" disabled={busy} onClick={() => save('save')}>Save draft</button><button type="button" className="cms-primary" disabled={busy} onClick={() => save('submit')}>Send for review ↗</button>{isAgency && page.status === 'submitted' && !dirty && <button type="button" className="cms-approve" disabled={busy} onClick={() => save('approve')}>Approve changes ✓</button>}</div>}<p className="cms-version">{page.version ? `Version ${page.version} · ${new Date(page.updated_at).toLocaleDateString('en-GB')}` : 'Not saved yet'}</p></aside></div>
      <footer className="cms-footer">TZ DIGITAL · CATO SITE REVIEW <a href={demo ? '/demo' : '/dashboard'}>Back to dashboard ↗</a></footer></div></main>
}
