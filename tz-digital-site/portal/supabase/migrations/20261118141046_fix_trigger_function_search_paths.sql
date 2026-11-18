-- Lock trigger functions to trusted schemas to prevent search_path hijacking.
alter function public.portal_task_tenant_matches() set search_path = pg_catalog, public, pg_temp;
alter function public.portal_child_tenant_matches() set search_path = pg_catalog, public, pg_temp;
