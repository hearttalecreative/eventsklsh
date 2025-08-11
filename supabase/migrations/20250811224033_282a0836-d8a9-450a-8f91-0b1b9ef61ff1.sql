-- Secure sensitive sales summary views by revoking direct access from anon/authenticated roles
-- Rationale: enforce access only via SECURITY DEFINER RPCs that check admin role

-- Revoke any existing privileges for anon/authenticated on views
REVOKE ALL ON TABLE public.event_sales_summary FROM anon, authenticated;
REVOKE ALL ON TABLE public.venue_sales_summary FROM anon, authenticated;

-- Optional: ensure no default PUBLIC grants accidentally expose the views
-- (Keep owners’ access intact; functions run as definer with sufficient rights)
REVOKE SELECT ON TABLE public.event_sales_summary FROM PUBLIC;
REVOKE SELECT ON TABLE public.venue_sales_summary FROM PUBLIC;

-- Verify comments for documentation
COMMENT ON VIEW public.event_sales_summary IS 'Sensitive financial summary. Access only via get_event_sales_summary_admin() RPC.';
COMMENT ON VIEW public.venue_sales_summary IS 'Sensitive financial summary. Access only via get_venue_sales_summary_admin() RPC.';