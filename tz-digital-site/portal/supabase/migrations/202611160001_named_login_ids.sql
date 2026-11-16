-- Permit named client login IDs while preserving existing six-digit accounts.
alter table public.portal_login_ids drop constraint if exists portal_login_ids_login_id_check;
alter table public.portal_login_ids add constraint portal_login_ids_login_id_check
  check (login_id ~ '^[0-9]{6}$' or login_id ~ '^[A-Za-z][A-Za-z0-9]{2,31}$');
create unique index if not exists portal_login_ids_casefold_unique on public.portal_login_ids (lower(login_id));
