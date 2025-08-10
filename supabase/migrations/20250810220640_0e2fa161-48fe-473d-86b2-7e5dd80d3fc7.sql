-- 1) Create a public bucket for event images
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- 2) Storage policies for the bucket
-- Public can read images from this specific bucket
create policy "Event images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'event-images');

-- Admins can upload/update/delete in this bucket
create policy "Admins can manage event images"
  on storage.objects for all
  using (bucket_id = 'event-images' and has_role(auth.uid(), 'admin'::app_role))
  with check (bucket_id = 'event-images' and has_role(auth.uid(), 'admin'::app_role));

-- 3) Helper view (optional) skipped to keep minimal changes

-- Note: No DB schema changes required for addons/tickets/venues/events as tables already exist.
