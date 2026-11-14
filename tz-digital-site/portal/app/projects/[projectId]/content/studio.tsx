'use client'

import Image from 'next/image'
import { useState, type MouseEvent, type ReactNode, type CSSProperties } from 'react'
import { contentPages, defaultDesign, type ContentPageKey, type ContentRecord, type VisualDesign } from '@/lib/content'

type ImageOption = { id: string; display_name: string; mime_type: string }
type Props = { projectId: string; projectName: string; initialPages: ContentRecord[]; images: ImageOption[]; canEdit: boolean; isAgency: boolean; preview?: boolean }
type PageMap = Partial<Record<ContentPageKey, ContentRecord>>
type Tool = 'text' | 'image' | 'colors' | 'comments'
const keys = Object.keys(contentPages) as ContentPageKey[]
const demoDesign: VisualDesign = { background: '#151613', text: '#f7f2e8', accent: '#d1ad53', heroImageFileId: null }
const demoCopy: Record<ContentPageKey, Record<string, string>> = {
  home: { eyebrow: 'MAASTRICHT · BRUSSELSESTRAAT 146', headline: 'THE ROUNDABOUT', intro: 'A welcoming place in the heart of Maastricht. Step inside, slow down, and enjoy the moment.', ctaLabel: 'VISIT US' },
  about: { headline: 'OUR STORY', body: 'The Roundabout is a familiar meeting place in Maastricht. Come by, meet the team, and find your favourite spot.', highlights: 'A place to meet\nIn the heart of Maastricht\nOpen every day' },
  services: { headline: 'EXPLORE THE ROUNDABOUT', intro: 'Discover what is waiting for you.', items: 'Gallery\nMenu\nBrands\nProducts' },
  contact: { headline: 'COME FIND US', intro: 'Brusselsestraat 146, Maastricht. Open daily from 09:00 to 00:00.', ctaLabel: 'GET DIRECTIONS' },
}
function blank(key: ContentPageKey, preview: boolean): ContentRecord { return { page_key: key, fields: preview ? demoCopy[key] : {}, design: preview ? demoDesign : defaultDesign, pins: [], status: 'draft', version: 0, updated_at: '' } }
function asMap(pages: ContentRecord[]): PageMap { return Object.fromEntries(pages.map(page => [page.page_key, page])) as PageMap }
function normalize(record: ContentRecord | undefined, key: ContentPageKey, preview: boolean): ContentRecord { return record ? { ...record, fields: record.fields ?? {}, design: { ...(preview ? demoDesign : defaultDesign), ...(record.design ?? {}) }, pins: record.pins ?? [] } : blank(key, preview) }

export function ContentStudio({ projectId, projectName, initialPages, images, canEdit, isAgency, preview = false }: Props) {
  const [pageKey, setPageKey] = useState<ContentPageKey>('home')
  const [pages, setPages] = useState<PageMap>(() => asMap(initialPages))
  const [saved, setSaved] = useState<PageMap>(() => asMap(initialPages))
  const [tool, setTool] = useState<Tool>('text')
  const [selectedField, setSelectedField] = useState('headline')
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null)
  const [comment, setComment] = useState('')
  const [demoImage, setDemoImage] = useState('/roundabout-demo-terrace.jpg')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const page = normalize(pages[pageKey], pageKey, preview)
  const original = normalize(saved[pageKey], pageKey, preview)
  const dirty = JSON.stringify([page.fields, page.design, page.pins]) !== JSON.stringify([original.fields, original.design, original.pins])
  const schema = contentPages[pageKey]
  const currentField = schema.fields.find(field => field.key === selectedField) ?? schema.fields[0]
  const heroImage = page.design.heroImageFileId ? `/api/projects/${projectId}/files/${page.design.heroImageFileId}` : preview ? demoImage : ''
  const activePin = page.pins.find(pin => pin.id === selectedPin)
  function update(change: Partial<ContentRecord>) {
    setPages(previous => ({ ...previous, [pageKey]: { ...normalize(previous[pageKey], pageKey, preview), ...change, status: 'draft' } }))
    setMessage(''); setError('')
  }
  function edit(key: string, value: string) { update({ fields: { ...page.fields, [key]: value } }) }
  function design(key: keyof VisualDesign, value: string | null) { update({ design: { ...page.design, [key]: value } }) }
  function selectText(key: string) { if (canEdit) { setTool('text'); setSelectedField(key) } }
  function addPin(event: MouseEvent<HTMLDivElement>) {
    if (tool !== 'comments' || !canEdit || (event.target as HTMLElement).closest('button')) return
    const rect = event.currentTarget.getBoundingClientRect()
    setPendingPin({ x: Math.round((event.clientX - rect.left) / rect.width * 1000) / 10, y: Math.round((event.clientY - rect.top) / rect.height * 1000) / 10 })
    setSelectedPin(null); setComment('')
  }
  function savePin() {
    if (!pendingPin || !comment.trim()) { setError('Write a comment for the pin.'); return }
    update({ pins: [...page.pins, { id: crypto.randomUUID(), ...pendingPin, target: `${schema.title} page`, comment: comment.trim() }] })
    setPendingPin(null); setComment('')
  }
  function removePin(id: string) { update({ pins: page.pins.filter(pin => pin.id !== id) }); setSelectedPin(null) }
  async function save(intent: 'save' | 'submit' | 'approve') {
    setError(''); setMessage(''); setBusy(true)
    try {
      if (intent === 'submit' && !dirty && page.status === 'submitted') throw new Error('This page has already been sent for review.')
      if (preview) {
        const updated: ContentRecord = { ...page, version: page.version + 1, status: intent === 'save' ? 'draft' : intent === 'submit' ? 'submitted' : 'approved', updated_at: new Date().toISOString() }
        setPages(previous => ({ ...previous, [pageKey]: updated })); setSaved(previous => ({ ...previous, [pageKey]: updated }))
        setMessage(intent === 'submit' ? 'Demo page sent for review in this browser session.' : 'Demo draft saved in this browser session.')
        return
      }
      const response = await fetch(`/api/projects/${projectId}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageKey, fields: page.fields, design: page.design, pins: page.pins, intent, expectedVersion: page.version }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Unable to save page')
      const updated = body.page as ContentRecord
      setPages(previous => ({ ...previous, [pageKey]: updated })); setSaved(previous => ({ ...previous, [pageKey]: updated }))
      setMessage(intent === 'save' ? 'Draft saved.' : intent === 'submit' ? 'Changes sent to TZ Digital for review.' : 'Page approved for the build handoff.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save page') }
    finally { setBusy(false) }
  }
  const editable = (key: string, children: ReactNode, className: string) => <button type="button" className={`${className} cms-clickable ${tool === 'text' && selectedField === key ? 'is-selected' : ''}`} onClick={() => selectText(key)} disabled={!canEdit} title={`Edit ${key}`}>{children}</button>
  return <main className="cms-app"><header className="cms-header"><a className="brand" href={preview ? '/demo' : '/dashboard'}><Image src="/tz-mark.png" width={32} height={32} alt="" /><span>TZ <b>Digital</b></span></a><nav><a href={preview ? '/demo/intake' : `/projects/${projectId}/intake`}>Website intake</a><a href={preview ? '/demo' : '/dashboard'}>Dashboard ↗</a></nav></header>
    {preview && <div className="dash-demo-banner">Roundabout example · Changes stay in this browser session</div>}
    <div className="cms-body"><div className="cms-intro"><span className="eyebrow accent">VISUAL WEBSITE REVIEW</span><h1>See the change.<br /><em>Then send it.</em></h1><p>Click text or the hero image to propose edits. Use Colors to try a new palette. Place pins for precise feedback, then send the page to TZ Digital for review.</p><div className="cms-project-name">{projectName}</div>{preview && <a className="cms-reference" href="https://roundabout69.nl/" target="_blank" rel="noreferrer">View the Roundabout site ↗</a>}</div>
      <div className="cms-workspace"><aside className="cms-pages"><span className="eyebrow">PAGES</span><nav aria-label="Content pages">{keys.map((key,index) => { const record = pages[key]; return <button type="button" key={key} className={pageKey === key ? 'active' : ''} onClick={() => { setPageKey(key); setSelectedField(contentPages[key].fields[0].key); setSelectedPin(null); setPendingPin(null); setError(''); setMessage('') }}><span className="cms-page-index">{String(index+1).padStart(2,'0')}</span><span><strong>{contentPages[key].title}</strong><small>{record?.status ?? 'Draft'}</small></span><span aria-hidden="true">↗</span></button> })}</nav>{isAgency && !preview && <a className="cms-export" href={`/api/projects/${projectId}/export`}>↓ Download AI handoff ZIP</a>}<p className="cms-help">The preview records proposed changes. TZ Digital reviews them before updating the customer website.</p></aside>
      <section className="cms-main"><div className="cms-toolbar"><div><span className="eyebrow accent">{schema.title.toUpperCase()} / LIVE PREVIEW</span><h2>{schema.title} page</h2></div><span className={`cms-state is-${page.status}`}>{dirty ? 'Unsaved changes' : page.status}</span></div><div className="cms-tools" role="toolbar" aria-label="Visual editor tools">{([['text','✎ Text'],['image','▧ Images'],['colors','◉ Colors'],['comments','◎ Comments']] as const).map(([value,label]) => <button type="button" key={value} className={tool === value ? 'active' : ''} onClick={() => { setTool(value); setError('') }}>{label}{value === 'comments' && page.pins.length ? ` ${page.pins.length}` : ''}</button>)}</div>
      <div className="cms-browser"><div className="cms-browser-bar"><i/><i/><i/><span>{preview ? 'roundabout69.nl' : projectName.toLowerCase().replaceAll(' ','-')}</span></div><div className={`cms-site ${tool === 'comments' ? 'pin-mode' : ''}`} style={{ '--site-bg': page.design.background, '--site-text': page.design.text, '--site-accent': page.design.accent } as CSSProperties} onClick={addPin}><div className="cms-site-hero" style={heroImage ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.58), rgba(0,0,0,.08)), url("${heroImage}")` } : undefined}><div className="cms-site-nav"><span>{preview ? '◉ THE ROUNDABOUT' : projectName.toUpperCase()}</span><span>HOME　 ABOUT　 GALLERY　 CONTACT</span></div><div className="cms-site-content">{pageKey === 'home' && editable('eyebrow', page.fields.eyebrow || 'YOUR LOCATION OR TAGLINE', 'cms-site-eyebrow')}{editable('headline', page.fields.headline || 'YOUR PAGE HEADLINE', 'cms-site-title')}{editable(pageKey === 'about' ? 'body' : 'intro', page.fields[pageKey === 'about' ? 'body' : 'intro'] || 'Click to add a short introduction.', 'cms-site-copy')}{page.fields.ctaLabel !== undefined && editable('ctaLabel', page.fields.ctaLabel || 'BUTTON LABEL', 'cms-site-cta')}</div><button type="button" className="cms-image-hotspot" onClick={() => setTool('image')} disabled={!canEdit} aria-label="Change hero image">▧ Change image</button></div><div className="cms-site-lower"><span>{projectName.toUpperCase()}</span><h3>{pageKey === 'home' ? 'A place to make yourself at home.' : page.fields.headline || schema.title}</h3><p>{page.fields.intro || page.fields.body || page.fields.items || 'Your words appear in the preview as you edit.'}</p></div>{page.pins.map((pin,index) => <button type="button" key={pin.id} className="cms-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} onClick={event => { event.stopPropagation(); setTool('comments'); setSelectedPin(pin.id); setPendingPin(null) }} aria-label={`Comment pin ${index+1}`}>{index+1}</button>)}{pendingPin && <span className="cms-pin pending" style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}>+</span>}</div></div><p className="cms-preview-note">{tool === 'comments' ? 'Click anywhere on the page preview to place a comment pin.' : 'Click text or the hero image to edit it. This is a proposed page preview.'}</p></section>
      <aside className="cms-inspector"><span className="eyebrow accent">INSPECTOR / {tool.toUpperCase()}</span>{tool === 'text' && <><h3>Edit page text</h3><p>Choose a field below, or click text in the preview.</p><div className="cms-field-choices">{schema.fields.map(field => <button type="button" key={field.key} className={selectedField === field.key ? 'active' : ''} onClick={() => setSelectedField(field.key)}>{field.label}</button>)}</div><label className="cms-input-label">{currentField.label}{currentField.multiline ? <textarea rows={6} value={page.fields[currentField.key] ?? ''} placeholder={currentField.placeholder} onChange={event => edit(currentField.key,event.target.value)} disabled={!canEdit} /> : <input value={page.fields[currentField.key] ?? ''} placeholder={currentField.placeholder} onChange={event => edit(currentField.key,event.target.value)} disabled={!canEdit} />}</label></>}
      {tool === 'image' && <><h3>Hero image</h3><p>Choose an image uploaded in the website intake. The preview updates immediately.</p>{preview && <div className="cms-image-options">{([['/roundabout-demo-terrace.jpg','Terrace view'],['/roundabout-demo-tables.jpg','Tables view']] as const).map(([path,label]) => <button type="button" key={path} className={demoImage === path ? 'active' : ''} onClick={() => setDemoImage(path)}><Image src={path} width={70} height={52} alt="" /><span>{label}</span></button>)}</div>}{images.length ? <div className="cms-image-options">{images.map(file => <button type="button" key={file.id} className={page.design.heroImageFileId === file.id ? 'active' : ''} onClick={() => design('heroImageFileId', file.id)} disabled={!canEdit}><Image src={`/api/projects/${projectId}/files/${file.id}`} width={70} height={52} alt="" unoptimized /><span>{file.display_name}</span></button>)}</div> : !preview && <p>No brand images uploaded yet. Add one in Website intake.</p>}{page.design.heroImageFileId && <button type="button" className="cms-link-button" onClick={() => design('heroImageFileId', null)}>Remove selected image</button>}</>}
      {tool === 'colors' && <><h3>Colors</h3><p>Try colors here. Your team will review the palette before applying it.</p>{([['background','Background'],['text','Text'],['accent','Accent']] as const).map(([key,label]) => <label className="cms-color-row" key={key}><span>{label}</span><input type="color" value={page.design[key]} onChange={event => design(key,event.target.value)} disabled={!canEdit} /><code>{page.design[key]}</code></label>)}</>}
      {tool === 'comments' && <><h3>Pinned comments</h3><p>Click a spot on the preview, then write what should change.</p>{pendingPin && <div className="cms-comment-form"><strong>New pin</strong><textarea aria-label="New pin comment" value={comment} onChange={event => setComment(event.target.value)} placeholder="What should we change here?" rows={4} maxLength={1000} /><div><button type="button" onClick={savePin}>Add pin</button><button type="button" onClick={() => setPendingPin(null)}>Cancel</button></div></div>}{activePin && <div className="cms-comment-form"><strong>Selected pin</strong><p>{activePin.comment}</p><button type="button" onClick={() => removePin(activePin.id)}>Remove pin</button></div>}{page.pins.length ? <ol className="cms-pin-list">{page.pins.map((pin,index) => <li key={pin.id}><button type="button" onClick={() => { setSelectedPin(pin.id); setPendingPin(null) }}><b>{index+1}</b>{pin.comment}</button></li>)}</ol> : !pendingPin && <p>No pins on this page yet.</p>}</>}
      {error && <p className="cms-error" role="alert">{error}</p>}{message && <p className="cms-message" role="status">{message}</p>}{canEdit && <div className="cms-actions"><button type="button" className="cms-secondary" onClick={() => void save('save')} disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" className="cms-primary" onClick={() => void save('submit')} disabled={busy}>{busy ? 'Working…' : 'Send for review ↗'}</button>{isAgency && original.status === 'submitted' && !dirty && <button type="button" className="cms-approve" onClick={() => void save('approve')} disabled={busy}>Approve changes ✓</button>}</div>}<p className="cms-version">{page.version ? `Version ${page.version} · ${page.updated_at ? new Date(page.updated_at).toLocaleDateString('en-GB') : 'saved'}` : 'Not saved yet'}</p></aside></div><footer className="cms-footer">TZ DIGITAL · VISUAL REVIEW <a href={preview ? '/demo/intake' : `/projects/${projectId}/intake`}>Back to intake ↗</a><a href="/">TZ Digital site ↗</a></footer></div></main>
}
