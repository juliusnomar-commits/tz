-- Client website intake and private upload bucket.
create table public.portal_project_intakes (
  project_id uuid primary key references public.portal_projects(id) on delete cascade,
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','accepted')),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);
create trigger portal_intake_tenant_match before insert or update of project_id, tenant_id on public.portal_project_intakes
for each row execute function public.portal_child_tenant_matches();
alter table public.portal_project_intakes enable row level security;
create policy portal_project_intakes_member on public.portal_project_intakes for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_project_intakes.tenant_id and m.user_id = (select auth.uid())));

alter table public.portal_file_records
  add column category text not null default 'project' check (category in ('project','brand','legal')),
  add column mime_type text,
  add column byte_size bigint check (byte_size is null or byte_size between 1 and 10485760);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-intake', 'portal-intake', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
