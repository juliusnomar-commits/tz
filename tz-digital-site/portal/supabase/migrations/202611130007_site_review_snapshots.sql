-- Keep a visual record of the page and pin positions at submission time.
alter table public.portal_site_pages
  add column snapshot_path text,
  add column snapshot_device text check (snapshot_device in ('desktop', 'mobile'));
