'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { DashboardFile } from '@/lib/dashboard'

type Props = { projectId: string; files: DashboardFile[]; fileCount: number; canUpload: boolean; demo: boolean }

export function ProjectFiles({ projectId, files: initialFiles, fileCount: initialCount, canUpload, demo }: Props) {
  const [files, setFiles] = useState(initialFiles)
  const [fileCount, setFileCount] = useState(initialCount)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files
    if (!selected?.length) return
    setMessage('')
    if (demo) { setMessage('Uploads are available in a connected project.'); return }
    setUploading(true)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      if (!url || !key) throw new Error('File uploads are not configured yet.')
      const storage = createClient(url, key).storage.from('portal-intake')
      const added: DashboardFile[] = []
      for (const file of Array.from(selected)) {
        if (file.size < 1 || file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
          throw new Error(`${file.name}: choose a JPG, PNG, WebP or PDF under 10 MB.`)
        }
        const signedResponse = await fetch(`/api/projects/${projectId}/uploads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size, category: 'project' }) })
        const signed = await signedResponse.json()
        if (!signedResponse.ok) throw new Error(signed.error ?? 'Unable to prepare the upload.')
        const result = await storage.uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type })
        if (result.error) throw result.error
        const recordResponse = await fetch(`/api/projects/${projectId}/uploads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: signed.path, name: file.name, category: 'project' }) })
        const recorded = await recordResponse.json()
        if (!recordResponse.ok) throw new Error(recorded.error ?? 'Unable to save the uploaded file.')
        added.push(recorded.file as DashboardFile)
      }
      setFiles(previous => [...added.reverse(), ...previous])
      setFileCount(previous => previous + added.length)
      setMessage(`${added.length === 1 ? 'File' : 'Files'} uploaded to your project.`)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The upload could not be completed.')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const shownFiles = files.slice(0, 3)
  const moreFiles = Math.max(0, fileCount - shownFiles.length)

  return <section className="dash-info-card dash-files-card" id="files" aria-labelledby="files-heading">
    <div className="dash-card-heading"><div><span className="eyebrow accent">PROJECT RESOURCES</span><h2 id="files-heading">Files <span className="dash-file-count">{fileCount}</span></h2></div></div>
    {shownFiles.length ? <ul className="dash-file-list">{shownFiles.map(file => <li key={file.id}><span className="dash-file-type" aria-hidden="true">{file.display_name.split('.').pop()?.slice(0, 3).toUpperCase() || 'FILE'}</span><div><a href={`/api/projects/${projectId}/files/${file.id}`} target="_blank" rel="noopener noreferrer">{file.display_name}</a><small>{formatFileDate(file.uploaded_at)}</small></div><span className="dash-file-arrow" aria-hidden="true">↗</span></li>)}</ul> : <p className="dash-empty-inline">Files shared with your team will appear here.</p>}
    {moreFiles > 0 && <p className="dash-more-files">+ {moreFiles} more {moreFiles === 1 ? 'file' : 'files'}</p>}
    {(canUpload || demo) && <><input ref={input} className="dash-file-input" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => void upload(event)} aria-label="Choose files to upload" disabled={uploading} /><button type="button" className="dash-upload-button" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : '+ Upload files'}</button><p className="dash-upload-hint">JPG, PNG, WebP or PDF · up to 10 MB each</p></>}
    {message && <p className="dash-upload-message" role="status">{message}</p>}
  </section>
}

function formatFileDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Recently added' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
