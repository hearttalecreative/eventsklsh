-- Secure financial summary views by revoking direct access and enforcing RPC-only access for admins
-- These are views (not tables), so RLS cannot be applied. We restrict privileges instead.

-- Revoke all privileges from anon and authenticated on event_sales_summary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'event_sales_summary'
  ) THEN
    REVOKE ALL ON TABLE public.event_sales_summary FROM anon, authenticated;
  END IF;
END $$;

-- Revoke all privileges from anon and authenticated on venue_sales_summary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'venue_sales_summary'
  ) THEN
    REVOKE ALL ON TABLE public.venue_sales_summary FROM anon, authenticated;
  END IF;
END $$;

-- (Optional safety) Ensure functions exist and remain SECURITY DEFINER with admin check
-- No changes to functions; relying on existing:
-- public.get_event_sales_summary_admin() and public.get_venue_sales_summary_admin()
-- Both already check public.has_role(auth.uid(), 'admin') and are SECURITY DEFINER.
