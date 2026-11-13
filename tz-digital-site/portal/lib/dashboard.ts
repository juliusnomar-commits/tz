export type DashboardProject = {
  id: string
  tenant_id: string
  name: string
  service: string
  status: string
  summary: string | null
  next_milestone: string | null
  target_window: string | null
  project_timezone: string
  updated_at: string
}

export type DashboardTask = {
  id: string
  title: string
  owner_type: 'client' | 'agency' | 'external' | 'shared'
  status: string
  due_at: string | null
  href?: string
}

export type DashboardMilestone = {
  id: string
  title: string
  status: 'complete' | 'current' | 'upcoming' | 'blocked'
  window_label: string | null
  position: number
}

export type DashboardActivity = {
  id: string
  title: string
  detail: string | null
  actor_type: 'agency' | 'client' | 'system'
  created_at: string
}

export type DashboardReview = {
  id: string
  title: string
  status: 'preparing' | 'awaiting_client' | 'in_revision' | 'approved'
  due_at: string | null
}

export type DashboardData = {
  organization: string
  projects: DashboardProject[]
  activeProject: DashboardProject | null
  tasks: DashboardTask[]
  milestones: DashboardMilestone[]
  activity: DashboardActivity[]
  reviews: DashboardReview[]
  fileCount: number
  demo?: boolean
}

export function formatDate(value: string | null, timezone = 'Europe/Berlin') {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' }).format(date)
  }
}

export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    planned: 'Planned',
    on_track: 'On track',
    at_risk: 'At risk',
    waiting_on_client: 'Waiting on you',
    waiting_on_agency: 'TZ Digital is working',
    blocked_external: 'External blocker',
    ready_to_launch: 'Ready to launch',
    launched: 'Launched',
    paused: 'Paused',
    todo: 'To do',
    in_progress: 'In progress',
    waiting_client: 'Waiting on you',
    waiting_agency: 'With TZ Digital',
    waiting_external: 'Waiting externally',
    done: 'Complete',
    preparing: 'Preparing',
    awaiting_client: 'Awaiting your feedback',
    in_revision: 'In revision',
    approved: 'Approved',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}
