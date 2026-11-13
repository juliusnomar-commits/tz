'use client'

import Image from 'next/image'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import { emptyAnswers, type IntakeAnswers, type IntakeField, type IntakeFile, type IntakeStatus } from '@/lib/intake'

type Props = { projectId: string; projectName: string; initialAnswers: IntakeAnswers; initialStatus: IntakeStatus; initialFiles: IntakeFile[]; canEdit: boolean; preview?: boolean }
const initial = emptyAnswers()

function FormField({ label, value, onChange, hint, placeholder, multiline = false, type = 'text', required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; hint?: string; placeholder?: string; multiline?: boolean; type?: string; required?: boolean; disabled?: boolean }) {
  return <label className="intake-field"><span>{label}{required && <b aria-label="required"> *</b>}</span>{hint && <small>{hint}</small>}{multiline ? <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={4} disabled={disabled} /> : <input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} />}</label>
}

export function IntakeView({ projectId, projectName, initialAnswers, initialStatus, initialFiles, canEdit, preview = false }: Props) {
  const [answers, setAnswers] = useState<IntakeAnswers>({ ...initial, ...initialAnswers })
  const [status, setStatus] = useState<IntakeStatus>(initialStatus)
  const [files, setFiles] = useState<IntakeFile[]>(initialFiles)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState<'brand' | 'legal' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const brandInput = useRef<HTMLInputElement>(null)
  const legalInput = useRef<HTMLInputElement>(null)
  const edit = (key: IntakeField) => (value: string) => setAnswers(previous => ({ ...previous, [key]: value }))
  const field = (key: IntakeField, label: string, options: { hint?: string; placeholder?: string; multiline?: boolean; type?: string; required?: boolean } = {}) => <FormField key={key} label={label} value={answers[key]} onChange={edit(key)} disabled={!canEdit} {...options} />

  async function save(submit: boolean) {
    setError(''); setMessage(''); setBusy(true)
    try {
      if (preview) { setMessage('Preview only: this sample is not connected to a customer project.'); return }
      const response = await fetch(`/api/projects/${projectId}/intake`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers, submit }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Unable to save')
      setStatus(body.status)
      setMessage(submit ? 'Submitted to TZ Digital. Your project task is now complete.' : 'Draft saved. You can return and continue later.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save') }
    finally { setBusy(false) }
  }

  async function upload(selected: FileList | File[], category: 'brand' | 'legal') {
    setError(''); setMessage('')
    if (preview) { setMessage('Preview only: uploads are available in a connected customer project.'); return }
    setUploading(true)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!url || !key) throw new Error('Uploads are not configured yet')
      const storage = createClient(url, key).storage.from('portal-intake')
      for (const file of Array.from(selected)) {
        if (file.size < 1 || file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || (category === 'brand' && file.type === 'application/pdf')) throw new Error(`${file.name}: use an allowed file under 10 MB`)
        const signedResponse = await fetch(`/api/projects/${projectId}/uploads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size, category }) })
        const signed = await signedResponse.json()
        if (!signedResponse.ok) throw new Error(signed.error ?? 'Unable to prepare upload')
        const result = await storage.uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })
        if (result.error) throw result.error
        const recordResponse = await fetch(`/api/projects/${projectId}/uploads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: signed.path, name: file.name, category }) })
        const recorded = await recordResponse.json()
        if (!recordResponse.ok) throw new Error(recorded.error ?? 'Unable to record upload')
        setFiles(previous => [recorded.file, ...previous])
      }
      setMessage('Files uploaded privately to your project.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed') }
    finally { setUploading(false); if (brandInput.current) brandInput.current.value = ''; if (legalInput.current) legalInput.current.value = '' }
  }

  function drop(event: DragEvent<HTMLDivElement>, category: 'brand' | 'legal') { event.preventDefault(); setDragging(null); if (canEdit) void upload(event.dataTransfer.files, category) }
  function select(event: ChangeEvent<HTMLInputElement>, category: 'brand' | 'legal') { if (event.target.files) void upload(event.target.files, category) }
  const links = [answers.country === 'Netherlands' ? 'Company details' : 'Impressum / company information', 'Privacy policy', answers.cookiesAnalytics === 'yes' && 'Cookie settings / declaration', answers.termsNeeded === 'yes' && 'Terms & conditions'].filter(Boolean)

  return <main className="intake-app">
    <header className="intake-header"><a className="brand" href={preview ? '/demo' : '/dashboard'}><Image src="/tz-mark.png" width={32} height={32} alt="" /><span>TZ <b>Digital</b></span></a><a href={preview ? '/demo' : '/dashboard'}>← Back to dashboard</a></header>
    {preview && <div className="dash-demo-banner">Preview with synthetic data · Input is not saved</div>}
    <div className="intake-body"><div className="intake-heading"><span className="eyebrow accent">YOUR WEBSITE / PROJECT INTAKE</span><h1>Tell us what makes<br />your business <em>yours.</em></h1><p>Share the details we need for your site, footer links and design. Save a draft anytime, then submit when it is ready for our team.</p><div className="intake-meta"><span>{projectName}</span><span className={`intake-status is-${status}`}>{status.replaceAll('_', ' ')}</span></div></div>
      <nav className="intake-jump" aria-label="Intake sections"><a href="#legal">01 Legal & footer</a><a href="#business">02 Business basics</a><a href="#story">03 Our Story</a><a href="#design">04 Design direction</a><a href="#files">05 Images & files</a></nav>
      <div className="intake-form-shell"><div className="intake-sections">
        <section id="legal" className="intake-card"><div className="intake-section-title"><span>01 / LEGAL & FOOTER</span><h2>Details behind the footer links.</h2><p>We’ll use these answers to plan the right company information, privacy and other footer pages for your business. Your team will review the final legal content before it goes live.</p></div>
          <div className="intake-grid"><label className="intake-field"><span>Where does your business operate? *</span><select value={answers.country} onChange={event => edit('country')(event.target.value)} disabled={!canEdit}><option value="">Choose one</option><option>Germany</option><option>Netherlands</option><option>Both</option></select></label>{field('legalName','Registered legal business name',{required:true})}{field('tradingName','Public trading name')}{field('legalForm','Legal form',{placeholder:'GmbH, BV, sole proprietor…'})}{field('representative','Owner / authorised representative')}{field('registrationNumber','Commercial register or KVK number')}{field('registrationAuthority','Register / chamber')}{field('vatId','VAT / USt-IdNr. (if applicable)')}{field('regulator','Supervisory body (if regulated)')}{field('streetAddress','Business street address',{required:true})}{field('postalCode','Postal code',{required:true})}{field('city','City',{required:true})}{field('publicEmail','Public contact email',{type:'email',required:true})}{field('publicPhone','Public phone number')}{field('privacyContact','Privacy contact if different')}</div>
          <div className="intake-grid">{field('existingImprintUrl','Existing company information / Impressum URL',{type:'url',placeholder:'https://…'})}{field('existingPrivacyUrl','Existing privacy policy URL',{type:'url',placeholder:'https://…'})}{field('existingTermsUrl','Existing terms URL',{type:'url',placeholder:'https://…'})}<label className="intake-field"><span>Will the site need terms or sales conditions?</span><select value={answers.termsNeeded} onChange={event => edit('termsNeeded')(event.target.value)} disabled={!canEdit}><option value="">Not sure yet</option><option value="yes">Yes</option><option value="no">No</option></select></label></div>
          <div className="intake-grid">{field('dataCollected','What visitor data will the site collect?',{multiline:true,placeholder:'Contact forms, newsletter, bookings, orders…'})}{field('thirdPartyTools','Which outside tools will the site use?',{multiline:true,placeholder:'Analytics, maps, embedded video, booking tools…'})}<label className="intake-field"><span>Cookies or analytics planned?</span><select value={answers.cookiesAnalytics} onChange={event => edit('cookiesAnalytics')(event.target.value)} disabled={!canEdit}><option value="">Not sure yet</option><option value="yes">Yes</option><option value="no">No</option></select></label>{field('footerLinks','Other footer links you want',{placeholder:'Careers, accessibility, returns, FAQs…'})}</div>
          <div className="intake-links"><strong>Likely footer links from your answers</strong><ul>{links.map(link => <li key={String(link)}>{link}</li>)}</ul><p>Exact legal pages depend on your business, features and final review.</p></div>
        </section>
        <section id="business" className="intake-card"><div className="intake-section-title"><span>02 / BUSINESS BASICS</span><h2>The essentials of your site.</h2><p>Give us the words and contact details visitors should see.</p></div><div className="intake-grid">{field('businessDescription','What does your business do?',{multiline:true,required:true,placeholder:'A few clear sentences about your business'})}{field('services','Main products or services',{multiline:true,required:true})}{field('audience','Who is your ideal customer?')}{field('serviceArea','Where do you serve customers?')}{field('businessHours','Opening or contact hours')}{field('primaryContact','Who should we contact about this project?')}{field('existingWebsite','Current website',{type:'url',placeholder:'https://…'})}{field('socialLinks','Social profiles',{multiline:true,placeholder:'One link per line'})}</div></section>
        <section id="story" className="intake-card"><div className="intake-section-title"><span>03 / OPTIONAL OUR STORY</span><h2>Want to share your story?</h2><p>This section is optional. If you want it, tell us what visitors should know about your beginnings and people.</p></div><div className="intake-choice"><label><input type="radio" name="storyEnabled" checked={answers.storyEnabled === 'yes'} onChange={() => edit('storyEnabled')('yes')} disabled={!canEdit} /> Yes, include Our Story</label><label><input type="radio" name="storyEnabled" checked={answers.storyEnabled === 'no'} onChange={() => edit('storyEnabled')('no')} disabled={!canEdit} /> No, skip it</label></div>{answers.storyEnabled === 'yes' && <div className="intake-grid">{field('storyText','Your story',{multiline:true,placeholder:'How did the business start? What matters most to you?'})}{field('storyMilestones','Key moments or milestones',{multiline:true})}{field('storyFounder','Founder / team details you want to show',{multiline:true})}</div>}</section>
        <section id="design" className="intake-card"><div className="intake-section-title"><span>04 / DESIGN DIRECTION</span><h2>Help us see your vision.</h2><p>There are no wrong answers. These questions help us shape the first design draft.</p></div><div className="intake-grid">{field('designFeel','How should the site feel?',{placeholder:'Warm, premium, playful, minimal…'})}{field('designColors','Colors or brand guidelines to use')}{field('designAvoid','Anything you do not want?')}{field('designExamples','Websites you like and why',{multiline:true,placeholder:'Paste links and a short reason'})}{field('designPriorities','What should visitors do first?',{multiline:true,placeholder:'Call, book, buy, learn, request a quote…'})}{field('designFeatures','Features or pages you need',{multiline:true,placeholder:'Contact form, gallery, booking, multilingual…'})}{field('designNotes','Anything else we should know?',{multiline:true})}</div></section>
        <section id="files" className="intake-card"><div className="intake-section-title"><span>05 / IMAGES & FILES</span><h2>Show us what you already have.</h2><p>Drop your logo, brand photos or visual references here. You can also upload existing legal documents for our team to review.</p></div><div className="intake-upload-grid">{(['brand','legal'] as const).map(category => <div className="intake-upload" key={category} onDragOver={event => { event.preventDefault(); setDragging(category) }} onDragLeave={() => setDragging(null)} onDrop={event => drop(event,category)} data-dragging={dragging === category}><span aria-hidden="true">↥</span><strong>{category === 'brand' ? 'Brand images & logo' : 'Existing legal documents'}</strong><p>{category === 'brand' ? 'JPG, PNG or WebP' : 'PDF, JPG, PNG or WebP'} · max 10 MB each</p><input ref={category === 'brand' ? brandInput : legalInput} type="file" multiple accept={category === 'brand' ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'} onChange={event => select(event,category)} disabled={!canEdit || uploading} aria-label={`Upload ${category} files`} /></div>)}</div>{uploading && <p role="status">Uploading files…</p>}{files.length > 0 && <ul className="intake-files">{files.map(file => <li key={file.id}><span>{file.mime_type?.startsWith('image/') ? '▧' : '▤'}</span><div><a href={`/api/projects/${projectId}/files/${file.id}`} target="_blank" rel="noopener noreferrer">{file.display_name}</a><small>{file.category} · {file.byte_size ? `${Math.ceil(file.byte_size / 1024)} KB` : 'file'}</small></div></li>)}</ul>}</section>
      </div><aside className="intake-sidebar"><span className="eyebrow accent">YOUR PROGRESS</span><h3>Ready when you are.</h3><p>Save your answers as a draft. Submit when the essentials are in place; our team will review the details and follow up if anything is missing.</p><ul><li>Business and public contact</li><li>Footer and legal-page details</li><li>Design direction</li><li>Images or existing files</li></ul>{error && <p className="intake-error" role="alert">{error}</p>}{message && <p className="intake-message" role="status">{message}</p>}{canEdit ? <div className="intake-actions"><button type="button" className="intake-save" onClick={() => void save(false)} disabled={busy || uploading}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" className="intake-submit" onClick={() => void save(true)} disabled={busy || uploading}>{busy ? 'Working…' : status === 'submitted' ? 'Submit update ↗' : 'Submit to TZ Digital ↗'}</button></div> : <p className="intake-readonly">This intake is available for viewing.</p>}<small>Fields marked * are needed before submission.</small></aside></div>
      <footer className="intake-footer">TZ DIGITAL · CLIENT PORTAL <a href={preview ? '/demo' : '/dashboard'}>Back to dashboard ↗</a></footer>
    </div>
  </main>
}
