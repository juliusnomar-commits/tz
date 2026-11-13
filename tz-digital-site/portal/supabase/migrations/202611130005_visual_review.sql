-- Editable visual preview requests. Apply after 202611130004_progress_cms.sql.
alter table public.portal_content_pages
  add column design jsonb not null default '{}'::jsonb check (jsonb_typeof(design) = 'object'),
  add column pins jsonb not null default '[]'::jsonb check (jsonb_typeof(pins) = 'array');
