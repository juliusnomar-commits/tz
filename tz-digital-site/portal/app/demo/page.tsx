import { notFound } from 'next/navigation'
import { DashboardView } from '@/app/dashboard/dashboard-view'
import type { DashboardData } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

const project: DashboardData['activeProject'] = { id: 'preview-project', tenant_id: 'preview-tenant', name: 'Northstar Coffee website', service: 'website', status: 'waiting_on_client', summary: 'A new digital home for the neighborhood coffee shop.', next_milestone: 'First design draft', target_window: 'Early December 2026', project_timezone: 'Europe/Berlin', updated_at: '2026-11-13T10:00:00Z' }

const previewData: DashboardData = {
  demo: true,
  organization: 'Northstar Coffee',
  projects: [project!],
  activeProject: project,
  milestones: [
    { id: 'm1', title: 'Kickoff & brief', status: 'complete', window_label: 'Completed 06 Nov', position: 1 },
    { id: 'm2', title: 'Content & images', status: 'current', window_label: 'In progress', position: 2 },
    { id: 'm3', title: 'First design draft', status: 'upcoming', window_label: 'Next milestone', position: 3 },
    { id: 'm4', title: 'Review & refinements', status: 'upcoming', window_label: 'After design draft', position: 4 },
    { id: 'm5', title: 'Launch', status: 'upcoming', window_label: 'After approval', position: 5 },
  ],
  tasks: [
    { id: 't1', title: 'Share your brand images', owner_type: 'client', status: 'waiting_client', due_at: '2026-11-18T17:00:00Z' },
    { id: 't2', title: 'Approve the content brief', owner_type: 'client', status: 'todo', due_at: '2026-11-20T17:00:00Z' },
    { id: 't3', title: 'Confirm business details', owner_type: 'client', status: 'done', due_at: null },
    { id: 't4', title: 'Plan page structure', owner_type: 'agency', status: 'done', due_at: null },
    { id: 't5', title: 'Design first draft', owner_type: 'agency', status: 'in_progress', due_at: null },
    { id: 't6', title: 'Responsive quality check', owner_type: 'agency', status: 'todo', due_at: null },
  ],
  reviews: [{ id: 'r1', title: 'First design draft', status: 'preparing', due_at: null }],
  fileCount: 3,
  activity: [
    { id: 'a1', title: 'Design work is underway', detail: 'We are shaping the first draft around the approved page structure.', actor_type: 'agency', created_at: '2026-11-13T10:00:00Z' },
    { id: 'a2', title: 'Business details confirmed', detail: 'Contact information and opening hours have been checked.', actor_type: 'client', created_at: '2026-11-11T14:00:00Z' },
    { id: 'a3', title: 'Project kickoff complete', detail: 'The brief and initial scope are ready.', actor_type: 'agency', created_at: '2026-11-06T09:00:00Z' },
  ],
}

export default function Demo() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <DashboardView data={previewData} />
}
