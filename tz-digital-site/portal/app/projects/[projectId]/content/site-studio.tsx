'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { SiteProfile } from '@/lib/site-profiles'
import type { VisualPin } from '@/lib/content'
import type { LivePage } from '@/lib/cato-live'

type Review = { page_key: string; changes: Record<string,string>; images: Record<string,string>; colors: Record<string,string>; pins: VisualPin[]; status: 'draft'|'submitted'|'approved'; version: number; updated_at: string; snapshot_path?: string|null; snapshot_device?: Device|null }
type Props = { projectId: string; profile: SiteProfile; initialPages: Review[]; initialPublished?: Record<string,LivePage>; initialImages: { id: string; display_name: string }[]; initialComments?: GeneralComment[]; canEdit: boolean; isAgency: boolean; demo?: boolean }
type Mode = 'text'|'images'|'colors'|'pins'
type GeneralComment = { id: string; title: string; detail: string|null; actor_type: string; created_at: string }
type Device = 'desktop'|'mobile'
const empty = (key: string): Review => ({ page_key: key, changes: {}, images: {}, colors: {}, pins: [], status: 'draft', version: 0, updated_at: '' })

export function SiteStudio({ projectId, profile, initialPages, initialPublished = {}, initialImages, initialComments = [], canEdit, isAgency, demo = false }: Props) {
  const initialReviews = () => Object.fromEntries(initialPages.map(page => [page.page_key, { ...page, changes: initialPublished[page.page_key]?.changes ?? {}, images: initialPublished[page.page_key]?.images ?? {}, colors: initialPublished[page.page_key]?.colors ?? {} }])) as Record<string,Review>
  const [pageKey, setPageKey] = useState(profile.pages[0].key)
  const [reviews, setReviews] = useState<Record<string,Review>>(initialReviews)
  const [saved, setSaved] = useState<Record<string,Review>>(() => Object.fromEntries(initialPages.map(page => [page.page_key, page])))
  const [published, setPublished] = useState<Record<string,LivePage>>(initialPublished)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [retryPublish, setRetryPublish] = useState(0)
  const publishQueue = useRef<Promise<void>>(Promise.resolve())
  const [mode, setMode] = useState<Mode>('text')
  const [device, setDevice] = useState<Device>('desktop')
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<Omit<VisualPin,'id'|'comment'>|null>(null)
  const [generalCommentOpen, setGeneralCommentOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [generalComment, setGeneralComment] = useState('')
  const [comments, setComments] = useState(initialComments)
  const [commentBusy, setCommentBusy] = useState(false)
  const [howToOpen, setHowToOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [confirmation, setConfirmation] = useState<Review|null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState(initialImages)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const compareViewport = useRef<HTMLDivElement>(null)
  const compareBefore = useRef<HTMLIFrameElement>(null)
  const compareAfter = useRef<HTMLIFrameElement>(null)
  const frameConfigured = useRef(false)
  const page = reviews[pageKey] ?? empty(pageKey)
  const original = saved[pageKey] ?? empty(pageKey)
  const dirty = JSON.stringify(page.pins) !== JSON.stringify(original.pins)
  const current = profile.pages.find(item => item.key === pageKey) ?? profile.pages[0]
  const pageComments = comments.filter(item => item.title === `Site review comment · ${current.title}`)
  const copyKeys = Object.keys(profile.copy).filter(key => key.startsWith(current.prefix) || key.startsWith('nav_'))
  const imageKeys = Object.keys(profile.images).filter(key => key.startsWith(current.prefix) || key === current.key + '_hero' || (pageKey === 'home' && key.startsWith('home_')))
  const state = { changes: page.changes, images: page.images, colors: page.colors, pins: page.pins }
  const liveContent = { changes: page.changes, images: page.images, colors: page.colors }
  const liveDirty = JSON.stringify(liveContent) !== JSON.stringify(published[pageKey] ?? { changes: {}, images: {}, colors: {} })
  useEffect(() => { const open = () => setHowToOpen(true); window.addEventListener("tz-open-howto", open); return () => window.removeEventListener("tz-open-howto", open) }, [])
  useEffect(() => {
    if (!canEdit || demo) return
    const timers = Object.entries(reviews).flatMap(([key, review]) => {
      const content = { changes: review.changes, images: review.images, colors: review.colors }
      if (JSON.stringify(content) === JSON.stringify(published[key] ?? { changes: {}, images: {}, colors: {} })) return []
      return [setTimeout(() => {
        publishQueue.current = publishQueue.current.catch(() => {}).then(async () => {
          setPublishing(true); setPublishError('')
          try {
            const response = await fetch(`/api/projects/${projectId}/site`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageKey: key, ...content, pins: [], intent: 'publish' }) })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error ?? 'Unable to publish')
            setPublished(old => ({ ...old, [key]: content }))
            setNotice('Changes are live on Cato.')
          } catch (cause) { setPublishError(cause instanceof Error ? cause.message : 'Publishing failed') }
          finally { setPublishing(false) }
        })
      }, 900)]
    })
    return () => timers.forEach(clearTimeout)
  }, [reviews, published, canEdit, demo, projectId, retryPublish])
  useEffect(() => { if (demo) { try { const items = JSON.parse(sessionStorage.getItem('tz-cato-demo') ?? '{}') as Record<string,Review>; setReviews(items); setSaved(items) } catch { /* Ignore stale preview data. */ } } }, [demo])
  function post(type: 'configure'|'update') { frame.current?.contentWindow?.postMessage({ source: 'tz-portal-editor', type, state, pendingPin: pending, imageKeys: profile.images, mode }, window.location.origin) }
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
    const updateScale = () => element.style.setProperty('--preview-scale', String(Math.min(1, element.clientWidth / (device === 'desktop' ? 1200 : 390))))
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    updateScale()
    return () => observer.disconnect()
  }, [device, expanded])
  useEffect(() => {
    const element = compareViewport.current
    if (!element || !compareOpen) return
    const updateScale = () => element.style.setProperty('--compare-scale', String(Math.min(1, (element.querySelector('.cms-compare-viewport')?.clientWidth ?? 720) / 1440)))
    const observer = new ResizeObserver(updateScale)
    observer.observe(element)
    updateScale()
    return () => observer.disconnect()
  }, [compareOpen])
  function postComparison() {
    if (!confirmation) return
    compareAfter.current?.contentWindow?.postMessage({ source: 'tz-portal-editor', type: 'configure', state: { changes: confirmation.changes, images: confirmation.images, colors: confirmation.colors, pins: confirmation.pins }, imageKeys: profile.images, mode: 'view' }, window.location.origin)
  }
  function postBefore() {
    compareBefore.current?.contentWindow?.postMessage({ source: 'tz-portal-editor', type: 'configure', state: { changes: {}, images: {}, colors: {}, pins: [] }, imageKeys: profile.images, mode: 'view' }, window.location.origin)
  }
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.source !== 'tz-site-preview') return
      if (event.source === compareBefore.current?.contentWindow) { if (event.data.type === 'ready') postBefore(); return }
      if (event.source === compareAfter.current?.contentWindow) { if (event.data.type === 'ready') postComparison(); return }
      if (event.source !== frame.current?.contentWindow) return
      const data = event.data
      if (data.type === 'ready') post('configure')
      if (data.type === 'configured') { frameConfigured.current = true; post('update') }
      if (data.type === 'select' && canEdit) { setExpanded(false); setMode(data.kind); setSelected(data.key); setError('') }
      if (data.type === 'pin-place' && canEdit) { setExpanded(false); setMode('pins'); setPending({ x: data.x, y: data.y, target: data.target }); setComment('') }
      if (data.type === 'pin-selected') { setMode('pins'); setSelected(data.id); setPending(null); setComment('') }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  })
  function update(change: Partial<Review>) {
    setReviews(old => ({ ...old, [pageKey]: { ...(old[pageKey] ?? empty(pageKey)), ...change, status: 'pins' in change ? 'draft' : (old[pageKey]?.status ?? 'draft') } }))
    setNotice(''); setError('')
  }
  function pickPage(key: string) {
    if (pending && comment.trim()) {
      const pin: VisualPin = { id: crypto.randomUUID(), ...pending, comment: comment.trim() }
      setReviews(old => ({ ...old, [pageKey]: { ...(old[pageKey] ?? empty(pageKey)), pins: [...(old[pageKey]?.pins ?? []), pin], status: 'draft' } }))
    }
    setPageKey(key); setSelected(''); setPending(null); setComment(''); setGeneralCommentOpen(false); setNotice(''); setError(''); setConfirmation(null); setCompareOpen(false)
  }
  function addPin() {
    if (!pending || !comment.trim()) { setError('Write a comment for the pin.'); return }
    update({ pins: [...page.pins, { id: crypto.randomUUID(), ...pending, comment: comment.trim() }] })
    setPending(null); setComment('')
  }
  async function sendGeneralComment() {
    const text = generalComment.trim()
    if (!text || commentBusy) return
    setCommentBusy(true); setError(''); setNotice('')
    try {
      if (demo) {
        setComments(old => [{ id: crypto.randomUUID(), title: `Site review comment · ${current.title}`, detail: text, actor_type: 'client', created_at: new Date().toISOString() }, ...old])
      } else {
        const response = await fetch(`/api/projects/${projectId}/site`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageKey, comment: text }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Unable to send comment')
        setComments(old => [data.comment, ...old])
      }
      setGeneralComment(''); setNotice('Comment sent to TZ Digital. We will review it and follow up.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send comment') }
    finally { setCommentBusy(false) }
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
      setNotice('Image added to your choices.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed') }
    finally { setUploading(false) }
  }
  async function save(intent: 'save'|'submit'|'approve') {
    if (busy) return
    setBusy(true); setProgress(intent === 'submit' ? 'Preparing your review…' : 'Saving changes…'); setError(''); setNotice('')
    try {
      if (demo) {
        const next: Review = { ...page, status: intent === 'save' ? 'draft' : intent === 'submit' ? 'submitted' : 'approved', version: page.version + 1, updated_at: new Date().toISOString() }
        const items = { ...reviews, [pageKey]: next }
        sessionStorage.setItem('tz-cato-demo', JSON.stringify(items)); setReviews(items); setSaved(items)
        setNotice('Demo only: saved in this browser session. Connect storage for a real client account.')
        if (intent === 'submit') setConfirmation(next)
        return
      }
      setProgress(intent === 'submit' ? 'Sending feedback to TZ Digital…' : 'Saving changes…')
      const response = await fetch(`/api/projects/${projectId}/site`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ pageKey, ...state, intent, expectedVersion: page.version }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Unable to save')
      setReviews(old => ({ ...old, [pageKey]: data.page })); setSaved(old => ({ ...old, [pageKey]: data.page }))
      setNotice(intent === 'save' ? 'Draft saved.' : intent === 'submit' ? 'Your feedback has been submitted.' : 'Changes approved. TZ Digital can apply them to the live site.')
      if (intent === 'submit') { setConfirmation(data.page); setCompareOpen(false) }
    } catch (cause) { setError(cause instanceof DOMException && cause.name === 'TimeoutError' ? 'This is taking longer than expected. Please try again.' : cause instanceof Error ? cause.message : 'Unable to save') }
    finally { setBusy(false); setProgress('') }
  }
  return <div className="cms-app site-editor"><div className="site-editor-main">{demo && <div className="dash-demo-banner">Cato editor preview · Changes stay in this browser session</div>}
    <div className="cms-body"><div className="cms-intro"><div className="cms-intro-copy"><span className="cato-section-label">WEBSITE REVIEW</span><h1>{current.title} page</h1></div><span className="cato-submission-status" aria-live="polite">{page.status === "submitted" ? "● Submitted" : "● Draft"}</span></div>
      <div className="site-editor-control-row"><div className="cms-tools" role="toolbar" aria-label="Editor tools">{([['text','✎ Text'],['images','▧ Images'],['colors','◉ Colors'],['pins','⊕ Add a pin']] as const).map(([key,label]) => <button type="button" key={key} className={mode === key ? 'active' : ''} onClick={() => { setMode(key); setSelected('') }}>{label}</button>)}</div><div className="cms-device-switch" aria-label="Preview size"><button type="button" className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}>▣ Desktop</button><button type="button" className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}>▯ Mobile</button></div></div>
      <div className="cms-workspace"><div className="cato-preview-stack">
        <section className={'cms-main' + (expanded ? ' is-expanded' : '')}><div className="cms-toolbar"><span className="cms-status-copy" aria-live="polite">{liveDirty ? "Publishing live…" : ""}</span></div>
          <div className={'cms-preview-stage is-' + device}><div className="cms-browser"><div className="cms-browser-bar"><i/><i/><i/><button type="button" className="cato-preview-expand" title={expanded ? "Close full preview" : "Full preview"} aria-label={expanded ? "Close full preview" : "Full preview"} onClick={() => setExpanded(value => !value)}>{expanded ? "↙" : "⛶"}</button></div><div className="site-editor-viewport" ref={viewport}><iframe key={pageKey + device} ref={frame} className="site-editor-frame" title={`${profile.name} ${current.title} preview`} src={`${profile.previewRoot}/${current.path}`} onLoad={() => { frameConfigured.current = false; post('configure') }} /></div></div></div>{mode === 'pins' && <p className="cms-preview-note">Choose a spot on the page, then add your comment.</p>}</section><aside className="cms-pages"><span className="eyebrow">PAGES</span><nav aria-label="Site pages">{profile.pages.map((item,index) => <button type="button" key={item.key} className={pageKey === item.key ? 'active' : ''} onClick={() => pickPage(item.key)}><span className="cms-page-index">{String(index+1).padStart(2,'0')}</span><span className="cato-slide-copy"><span className="cato-slide-art" aria-hidden="true"><span className="cato-slide-brand">Cato</span><span className="cato-slide-lines"/><span className="cato-slide-lines short"/></span><strong>{item.title}</strong></span></button>)}</nav>{isAgency && <a className="cms-export" href={`/api/projects/${projectId}/export`}>↓ Download review handoff</a>}</aside></div>
        <aside className="cms-inspector"><span className="eyebrow accent">INSPECTOR / {mode.toUpperCase()}</span>{page.status === 'submitted' && !dirty && <button type="button" className="cms-compare-action cms-inspector-compare" onClick={() => { setConfirmation(saved[pageKey] ?? page); setCompareOpen(true) }}>Compare before and after</button>}
          {mode === 'text' && <><h3>Edit selected text</h3><p className="cato-inspector-hint">Click any text in the preview or select a field below.</p><label className="cato-inspector-label">ELEMENT<select className="cato-field-select" value={selected && copyKeys.includes(selected) ? selected : ""} onChange={event => setSelected(event.target.value)}><option value="">Choose a text element…</option>{copyKeys.map(key => <option key={key} value={key}>{key.replaceAll("_"," ")}</option>)}</select></label>{selected && selected in profile.copy && <label className="cms-input-label cato-content-editor">CONTENT<textarea rows={6} value={page.changes[selected] ?? profile.copy[selected]} onChange={event => update({ changes: { ...page.changes, [selected]: event.target.value } })} disabled={!canEdit} /></label>}{canEdit && <p className="cato-auto-publish">Text edits publish automatically.</p>}</>}
          {mode === 'images' && <><h3>Site images</h3><p>Click an image in the preview, then choose a replacement or drop a new image here.</p><div className="site-editor-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void upload(event.dataTransfer.files) }}><label>{uploading ? 'Uploading…' : 'Drop images here or choose files'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit || uploading} onChange={event => { if (event.target.files) void upload(event.target.files); event.target.value = '' }} /></label></div>{selected && selected in profile.images && <><strong className="site-editor-selected">{selected.replaceAll('_',' ')}</strong><div className="site-editor-images">{uploadedImages.map(file => { const path = `/api/projects/${projectId}/files/${file.id}`; return <button type="button" key={file.id} className={page.images[selected] === path ? 'active' : ''} onClick={() => update({ images: { ...page.images, [selected]: path } })} disabled={!canEdit}><img src={path} alt="" /><span>{file.display_name}</span></button> })}{Object.entries(profile.images).map(([key,path]) => <button type="button" key={key} className={(page.images[selected] ?? profile.images[selected]) === path ? 'active' : ''} onClick={() => update({ images: { ...page.images, [selected]: path } })} disabled={!canEdit}><img src={path.startsWith('images/') ? `https://${profile.domain}/${path}` : path} alt="" /><span>{key.replaceAll('_',' ')}</span></button>)}</div></>}{!selected && <div className="cms-field-choices">{imageKeys.map(key => <button type="button" key={key} onClick={() => setSelected(key)}>{key.replaceAll('_',' ')}</button>)}</div>}</>}
          {mode === 'colors' && <><h3>Site colors</h3><p>Preview changes to Cato’s real color tokens.</p>{Object.entries(profile.colors).map(([key,value]) => <label className="cms-color-row" key={key}><span>{key.replaceAll('-',' ')}</span><input type="color" value={page.colors[key] ?? value} onChange={event => update({ colors: { ...page.colors, [key]: event.target.value } })} disabled={!canEdit} /><code>{page.colors[key] ?? value}</code></label>)}</>}
          {mode === 'pins' && <><h3>Comments</h3><p>Leave a general comment, or pin feedback to a specific place on the page.</p><div className="cms-comment-form cms-general-comment"><button type="button" className="cms-comment-toggle" aria-expanded={generalCommentOpen} onClick={() => setGeneralCommentOpen(value => !value)}><strong>Leave a comment</strong><span aria-hidden="true">{generalCommentOpen ? '−' : '＋'}</span></button>{generalCommentOpen && <><textarea rows={3} maxLength={1000} value={generalComment} onChange={event => setGeneralComment(event.target.value)} placeholder="Write a comment for TZ Digital…" aria-label="General comment" disabled={!canEdit} /><button type="button" onClick={() => void sendGeneralComment()} disabled={!canEdit || !generalComment.trim() || commentBusy}>{commentBusy ? 'Sending…' : 'Send comment'}</button></>}</div>{pageComments.length > 0 && <><h4 className="cms-subheading">Sent comments</h4><ul className="cms-general-comment-list">{pageComments.map(item => <li key={item.id}><b>{item.actor_type === 'agency' ? 'TZ Digital' : 'You'} · {new Date(item.created_at).toLocaleDateString('en-GB')}</b><p>{item.detail}</p></li>)}</ul></>}{pending && <div className="cms-comment-form"><strong>New page pin</strong><textarea rows={4} maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} placeholder="What should change here?" aria-label="Comment" /><div><button type="button" onClick={addPin}>Add pin</button><button type="button" onClick={() => setPending(null)}>Cancel</button></div></div>}{page.pins.length ? <ol className="cms-pin-list">{page.pins.map((pin,index) => <li key={pin.id}><button type="button" onClick={() => setSelected(pin.id)}><b>{index+1}</b>{pin.comment}</button>{canEdit && <button type="button" className="site-editor-remove" aria-label={`Remove comment pin ${index + 1}`} title="Remove pin" onClick={() => update({ pins: page.pins.filter(item => item.id !== pin.id) })}>🗑</button>}</li>)}</ol> : !pending && <p>No pinned comments on this page.</p>}</>}
          {error && <p className="cms-error" role="alert">{error}</p>}{publishError && <p className="cms-error" role="alert">Live publishing failed: {publishError} <button type="button" onClick={() => setRetryPublish(value => value + 1)}>Retry</button></p>}{notice && <p className="cms-message" role="status">{notice}</p>}{(publishing || liveDirty) && canEdit && !demo && <p className="cms-message" role="status">{publishing ? 'Publishing to Cato…' : 'Waiting to publish to Cato…'}</p>}{busy && <p className="cms-submit-progress" role="status" aria-live="polite"><span className="cms-progress-spinner" aria-hidden="true" />{progress}</p>}{canEdit && <div className="cms-actions">{mode === 'pins' && (page.pins.length > 0 || dirty) && <><button type="button" className="cms-secondary" disabled={busy} onClick={() => save('save')}>Save pin draft</button><button type="button" className="cms-primary" disabled={busy || uploading || publishing || liveDirty || !page.pins.length} onClick={() => save('submit')}>{busy ? 'Submitting…' : 'Submit feedback'}</button></>}{isAgency && page.status === 'submitted' && !dirty && <button type="button" className="cms-approve" disabled={busy} onClick={() => save('approve')}>Approve comments ✓</button>}</div>}{page.version > 0 && <p className="cms-version">Comment version {page.version} · {new Date(page.updated_at).toLocaleDateString('en-GB')}</p>}</aside></div>
      </div>
    {howToOpen && <div className="cms-dialog-backdrop" onClick={() => setHowToOpen(false)}><section className="cms-confirm-dialog cms-howto-dialog" role="dialog" aria-modal="true" aria-label="How the site review works" onClick={event => event.stopPropagation()}><button type="button" className="cms-dialog-close" aria-label="Close" onClick={() => setHowToOpen(false)}>×</button><span className="eyebrow accent">HOW IT WORKS</span><h2>Your site review in three steps</h2><ol><li><b>Choose a page</b><span>Use the page list to move around the website.</span></li><li><b>Make edits or leave a comment</b><span>Click text to edit, or open Comments to write a note. Add a pin when feedback relates to a specific spot.</span></li><li><b>Send pinned feedback</b><span>Your text, image, and color edits publish automatically. Send pins to TZ Digital for review.</span></li></ol><button type="button" className="cms-primary" onClick={() => setHowToOpen(false)}>Got it</button></section></div>}</div>
    {confirmation && <div className="cms-dialog-backdrop" onClick={() => { setConfirmation(null); setCompareOpen(false) }}><section className={'cms-confirm-dialog' + (compareOpen ? ' is-comparing' : '')} role="dialog" aria-modal="true" aria-label={compareOpen ? 'Before and after review' : 'Review sent'} onClick={event => event.stopPropagation()}>
      <button type="button" className="cms-dialog-close" aria-label="Close" onClick={() => { setConfirmation(null); setCompareOpen(false) }}>×</button>
      {!compareOpen ? <><span className="cms-confirm-check" aria-hidden="true">✓</span><h2>Feedback submitted</h2><p>Your feedback has been submitted. We’ll get back to you as soon as possible.</p><div className="cms-dialog-actions"><button type="button" className="cms-primary" onClick={() => setConfirmation(null)}>Done</button></div></> : <><h2>Before and after</h2><p>Compare the original Cato page with your submitted draft. Scroll inside either preview to inspect the full page.</p><div className="cms-compare-grid" ref={compareViewport}><div className="cms-compare-card"><strong>Before · original site</strong><div className="cms-compare-viewport"><iframe ref={compareBefore} title="Original Cato page" src={`${profile.previewRoot}/${current.path}`} onLoad={postBefore} /></div></div><div className="cms-compare-card"><strong>After · submitted draft</strong><div className="cms-compare-viewport"><iframe ref={compareAfter} title="Submitted Cato draft" src={`${profile.previewRoot}/${current.path}`} onLoad={postComparison} /></div></div></div><div className="cms-dialog-actions"><button type="button" className="cms-secondary" onClick={() => setCompareOpen(false)}>Back to confirmation</button><button type="button" className="cms-primary" onClick={() => { setConfirmation(null); setCompareOpen(false) }}>Done</button></div></>}
    </section></div>}</div>
}
