'use client'
import type { ReactNode } from 'react'

type Section = 'overview' | 'details' | 'tasks' | 'preview' | 'files' | 'updates'

function NavIcon({ kind }: { kind: Section }) {
  const paths = {
    overview: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    details: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    tasks: <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 2.5 2.5L16 9"/></>,
    preview: <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M9 9h6M9 12h4"/></>,
    files: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></>,
    updates: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  } satisfies Record<Section, ReactNode>
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
}

export function PortalSidebar({ projectId, projectName, active, demo = false }: { projectId: string; projectName: string; active: Section; demo?: boolean }) {
  const links: Array<{ key: Section; label: string; href: string }> = [
    { key: 'overview', label: 'Overview', href: `/dashboard?project=${encodeURIComponent(projectId)}` },
    { key: 'details', label: 'Details', href: demo ? '/demo/intake' : `/projects/${projectId}/intake` },
    { key: 'tasks', label: 'To do', href: `/projects/${projectId}/tasks` },
    { key: 'preview', label: 'Website preview', href: `/projects/${projectId}/content` },
    { key: 'files', label: 'Files', href: `/projects/${projectId}/files` },
    { key: 'updates', label: 'Updates', href: `/projects/${projectId}/updates` },
  ]

  return <aside className="dash-sidebar">
    <a className={"dash-sidebar-brand" + (active === "preview" ? " cato-sidebar-brand" : "")} href={`/dashboard?project=${encodeURIComponent(projectId)}`} aria-label="Client portal home">{active === "preview" ? <>{projectName.replace(/\s+website\s*$/i, "")}<small>CLIENT PORTAL</small></> : <><span>TZ</span> Digital</>}</a>
    <nav aria-label="Portal navigation" className="dash-sidebar-nav">{links.map(link => <a href={link.href} key={link.key} aria-current={active === link.key ? 'page' : undefined}><NavIcon kind={link.key}/>{link.label}</a>)}</nav>
    {active === "preview" && <button type="button" className="cato-sidebar-howto" onClick={() => window.dispatchEvent(new Event("tz-open-howto"))}><span aria-hidden="true">▷</span> How It Works</button>}
    <div className="dash-sidebar-bottom"><a href="/">Home</a><a href="/#kontakt">Contact us</a></div>
  </aside>
}
