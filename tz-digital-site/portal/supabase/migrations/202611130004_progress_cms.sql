-- Section handoff state and editable page copy. Apply after 202611130003_intake.sql.
alter table public.portal_project_intakes
  add column section_statuses jsonb not null default '{}'::jsonb
  check (jsonb_typeof(section_statuses) = 'object'),
  add column version integer not null default 1 check (version > 0);

create table public.portal_content_pages (
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  page_key text not null check (page_key in ('home','about','services','contact')),
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object'),
  status text not null default 'draft' check (status in ('draft','submitted','approved')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  primary key (project_id, page_key)
);
create trigger portal_content_tenant_match before insert or update of project_id, tenant_id on public.portal_content_pages
for each row execute function public.portal_child_tenant_matches();
alter table public.portal_content_pages enable row level security;
create policy portal_content_pages_member on public.portal_content_pages for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_content_pages.tenant_id and m.user_id = (select auth.uid())));
