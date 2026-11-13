-- Dashboard records. Apply after 202611130001_portal_foundation.sql.
alter table public.portal_projects
  add column summary text,
  add column project_timezone text not null default 'Europe/Berlin',
  add column updated_at timestamptz not null default now();

create table public.portal_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  position integer not null check (position >= 0),
  status text not null default 'upcoming' check (status in ('complete','current','upcoming','blocked')),
  window_label text,
  created_at timestamptz not null default now(),
  unique(project_id, position)
);
create index portal_milestones_project_idx on public.portal_milestones(project_id, position);

create table public.portal_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  detail text,
  actor_type text not null check (actor_type in ('agency','client','system')),
  visibility text not null default 'client' check (visibility in ('client','agency')),
  created_at timestamptz not null default now()
);
create index portal_activity_project_idx on public.portal_activity(project_id, created_at desc);

create table public.portal_review_rounds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  status text not null default 'preparing' check (status in ('preparing','awaiting_client','in_revision','approved')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_review_rounds_project_idx on public.portal_review_rounds(project_id, status);

create table public.portal_file_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 200),
  storage_path text not null unique,
  uploaded_at timestamptz not null default now()
);
create index portal_file_records_project_idx on public.portal_file_records(project_id, uploaded_at desc);

-- Reuse the first migration's project/tenant boundary check for every child record.
create or replace function public.portal_child_tenant_matches()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.portal_projects p where p.id = new.project_id and p.tenant_id = new.tenant_id) then
    raise exception 'Project/tenant mismatch';
  end if;
  return new;
end $$;
create trigger portal_milestone_tenant_match before insert or update of project_id, tenant_id on public.portal_milestones
for each row execute function public.portal_child_tenant_matches();
create trigger portal_activity_tenant_match before insert or update of project_id, tenant_id on public.portal_activity
for each row execute function public.portal_child_tenant_matches();
create trigger portal_review_tenant_match before insert or update of project_id, tenant_id on public.portal_review_rounds
for each row execute function public.portal_child_tenant_matches();
create trigger portal_file_tenant_match before insert or update of project_id, tenant_id on public.portal_file_records
for each row execute function public.portal_child_tenant_matches();

alter table public.portal_milestones enable row level security;
alter table public.portal_activity enable row level security;
alter table public.portal_review_rounds enable row level security;
alter table public.portal_file_records enable row level security;

create policy portal_milestones_member on public.portal_milestones for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_milestones.tenant_id and m.user_id = (select auth.uid())));
create policy portal_activity_member on public.portal_activity for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_activity.tenant_id and m.user_id = (select auth.uid()) and (portal_activity.visibility = 'client' or m.role in ('agency_owner','agency_admin','agency_member'))));
create policy portal_review_rounds_member on public.portal_review_rounds for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_review_rounds.tenant_id and m.user_id = (select auth.uid())));
create policy portal_file_records_member on public.portal_file_records for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_file_records.tenant_id and m.user_id = (select auth.uid())));
