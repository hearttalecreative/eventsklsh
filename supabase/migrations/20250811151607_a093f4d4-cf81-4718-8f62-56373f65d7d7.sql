-- Tighten storage access and attach validation trigger

-- 1) Storage policies for event-images bucket
-- Public read
create policy if not exists "Event images: public read"
  on storage.objects
  for select
  using (bucket_id = 'event-images');

-- Admin-only insert
create policy if not exists "Event images: admin insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'event-images' and public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Admin-only update
create policy if not exists "Event images: admin update"
  on storage.objects
  for update
  using (
    bucket_id = 'event-images' and public.has_role(auth.uid(), 'admin'::app_role)
  )
  with check (
    bucket_id = 'event-images' and public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Admin-only delete
create policy if not exists "Event images: admin delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'event-images' and public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) Attach early-bird validation trigger to tickets table if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_ticket_eb') THEN
    CREATE TRIGGER validate_ticket_eb
    BEFORE INSERT OR UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_early_bird();
  END IF;
END $$;