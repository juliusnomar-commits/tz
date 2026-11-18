-- Store reusable client site profiles with the project they configure.
alter table public.portal_projects
  add column site_config jsonb not null default '{}'::jsonb
  check (jsonb_typeof(site_config) = 'object');
