-- Store reusable client site profiles with the project they configure.
alter table public.portal_projects
  add column if not exists site_config jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.portal_projects'::regclass
      and conname = 'portal_projects_site_config_object'
  ) then
    alter table public.portal_projects
      add constraint portal_projects_site_config_object
      check (jsonb_typeof(site_config) = 'object');
  end if;
end $$;
