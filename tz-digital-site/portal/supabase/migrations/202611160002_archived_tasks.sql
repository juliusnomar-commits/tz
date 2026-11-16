-- Keep obsolete onboarding tasks for audit without showing them as client work.
alter table public.portal_tasks drop constraint if exists portal_tasks_status_check;
alter table public.portal_tasks add constraint portal_tasks_status_check
  check (status in ('todo','in_progress','waiting_client','waiting_agency','waiting_external','done','archived'));
