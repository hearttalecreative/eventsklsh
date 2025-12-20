-- Address linter: RLS enabled without policies on pending_checkouts
-- We intentionally deny all access for anon/auth roles; Edge Functions (service role) bypass RLS.

DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_checkouts'
      AND policyname = 'pending_checkouts_deny_select'
  ) THEN
    EXECUTE 'CREATE POLICY pending_checkouts_deny_select ON public.pending_checkouts FOR SELECT USING (false)';
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_checkouts'
      AND policyname = 'pending_checkouts_deny_insert'
  ) THEN
    EXECUTE 'CREATE POLICY pending_checkouts_deny_insert ON public.pending_checkouts FOR INSERT WITH CHECK (false)';
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_checkouts'
      AND policyname = 'pending_checkouts_deny_update'
  ) THEN
    EXECUTE 'CREATE POLICY pending_checkouts_deny_update ON public.pending_checkouts FOR UPDATE USING (false)';
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pending_checkouts'
      AND policyname = 'pending_checkouts_deny_delete'
  ) THEN
    EXECUTE 'CREATE POLICY pending_checkouts_deny_delete ON public.pending_checkouts FOR DELETE USING (false)';
  END IF;
END $$;
