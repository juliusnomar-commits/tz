-- Run against an isolated Supabase project before adding client data.
create table public.portal_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.portal_memberships (
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('agency_owner','agency_admin','agency_member','client_owner','client_editor','client_reviewer','client_viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index portal_memberships_user_idx on public.portal_memberships(user_id);

create table public.portal_login_ids (
  login_id text primary key check (login_id ~ '^[0-9]{6}$'),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  auth_email text not null unique,
  created_at timestamptz not null default now()
);
revoke all on public.portal_login_ids from anon, authenticated;

create table public.portal_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  service text not null default 'website',
  status text not null default 'planned',
  next_milestone text,
  target_window text,
  created_at timestamptz not null default now()
);
create index portal_projects_tenant_idx on public.portal_projects(tenant_id, created_at desc);

create table public.portal_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.portal_tenants(id) on delete cascade,
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  owner_type text not null check (owner_type in ('client','agency','external','shared')),
  status text not null default 'todo' check (status in ('todo','in_progress','waiting_client','waiting_agency','waiting_external','done')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index portal_tasks_project_idx on public.portal_tasks(project_id, status, due_at);
create index portal_tasks_tenant_idx on public.portal_tasks(tenant_id);

-- Prevent a task from referencing a project owned by another tenant.
create or replace function public.portal_task_tenant_matches()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.portal_projects p where p.id = new.project_id and p.tenant_id = new.tenant_id) then
    raise exception 'Task project/tenant mismatch';
  end if;
  return new;
end $$;
create trigger portal_task_tenant_match before insert or update of project_id, tenant_id on public.portal_tasks
for each row execute function public.portal_task_tenant_matches();

-- RLS is the data boundary; app code must still check capabilities on mutations.
alter table public.portal_tenants enable row level security;
alter table public.portal_memberships enable row level security;
alter table public.portal_projects enable row level security;
alter table public.portal_tasks enable row level security;
alter table public.portal_login_ids enable row level security;

create policy portal_memberships_self on public.portal_memberships for select to authenticated
using (user_id = (select auth.uid()));
create policy portal_tenants_member on public.portal_tenants for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = id and m.user_id = (select auth.uid())));
create policy portal_projects_member on public.portal_projects for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_projects.tenant_id and m.user_id = (select auth.uid())));
create policy portal_tasks_member on public.portal_tasks for select to authenticated
using (exists (select 1 from public.portal_memberships m where m.tenant_id = portal_tasks.tenant_id and m.user_id = (select auth.uid())));

-- Service-role-only, atomic throttle. The caller supplies a keyed HMAC, never a raw ID/IP.
create table public.portal_login_attempts (
  key_hash text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0)
);
revoke all on public.portal_login_attempts from anon, authenticated;
alter table public.portal_login_attempts enable row level security;

create or replace function public.portal_allow_login_attempt(p_key text, p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_key !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_limit > 100 then return false; end if;
  insert into public.portal_login_attempts(key_hash, window_start, attempts)
  values (p_key, now(), 1)
  on conflict (key_hash) do update set
    window_start = case when public.portal_login_attempts.window_start < now() - interval '15 minutes' then now() else public.portal_login_attempts.window_start end,
    attempts = case when public.portal_login_attempts.window_start < now() - interval '15 minutes' then 1 else public.portal_login_attempts.attempts + 1 end
  returning attempts into n;
  return n <= p_limit;
end $$;
revoke all on function public.portal_allow_login_attempt(text, integer) from public, anon, authenticated;
grant execute on function public.portal_allow_login_attempt(text, integer) to service_role;
