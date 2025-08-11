-- Restrict direct access to sensitive sales summary views (admins access via RPC only)
BEGIN;

-- Revoke from anon/authenticated and PUBLIC
REVOKE ALL ON TABLE public.event_sales_summary FROM anon, authenticated;
REVOKE ALL ON TABLE public.venue_sales_summary FROM anon, authenticated;
REVOKE SELECT ON TABLE public.event_sales_summary FROM PUBLIC;
REVOKE SELECT ON TABLE public.venue_sales_summary FROM PUBLIC;

-- Optional: document purpose
COMMENT ON VIEW public.event_sales_summary IS 'Sensitive financial summary. Access only via get_event_sales_summary_admin() RPC.';
COMMENT ON VIEW public.venue_sales_summary IS 'Sensitive financial summary. Access only via get_venue_sales_summary_admin() RPC.';

COMMIT;