-- A site profile selects a real website preview. Drafts remain tenant-scoped.
alter table public.portal_projects add column site_key text;

create table public.portal_site_pages (
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  page_key text not null check (page_key ~ '^[a-z0-9_-]{1,40}$'),
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  images jsonb not null default '{}'::jsonb check (jsonb_typeof(images) = 'object'),
  colors jsonb not null default '{}'::jsonb check (jsonb_typeof(colors) = 'object'),
  pins jsonb not null default '[]'::jsonb check (jsonb_typeof(pins) = 'array'),
  status text not null default 'draft' check (status in ('draft','submitted','approved')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  primary key (project_id, page_key)
);
create trigger portal_site_pages_tenant_match before insert or update of project_id, tenant_id on public.portal_site_pages
for each row execute function public.portal_child_tenant_matches();
alter table public.portal_site_pages enable row level security;
create policy portal_site_pages_member on public.portal_site_pages for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_site_pages.tenant_id and m.user_id = (select auth.uid())));
