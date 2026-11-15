update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf','application/json']
where id = 'portal-intake';
