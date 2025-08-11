-- Tighten storage access and attach validation trigger (safe re-runnable)

-- 1) Storage policies for event-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Event images: public read'
  ) THEN
    CREATE POLICY "Event images: public read"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'event-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Event images: admin insert'
  ) THEN
    CREATE POLICY "Event images: admin insert"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Event images: admin update'
  ) THEN
    CREATE POLICY "Event images: admin update"
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'::app_role)
      )
      WITH CHECK (
        bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Event images: admin delete'
  ) THEN
    CREATE POLICY "Event images: admin delete"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'event-images' AND public.has_role(auth.uid(), 'admin'::app_role)
      );
  END IF;
END $$;

-- 2) Attach early-bird validation trigger to tickets table if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_ticket_eb') THEN
    CREATE TRIGGER validate_ticket_eb
    BEFORE INSERT OR UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.validate_ticket_early_bird();
  END IF;
END $$;