-- Revoke all public access to the venue_sales_summary view
REVOKE ALL ON public.venue_sales_summary FROM PUBLIC;
REVOKE ALL ON public.venue_sales_summary FROM anon;
REVOKE ALL ON public.venue_sales_summary FROM authenticated;

-- Grant access only to service role and postgres
-- This ensures the view can only be accessed through security definer functions
GRANT SELECT ON public.venue_sales_summary TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.venue_sales_summary IS 
'Financial data view - access restricted. Use get_venue_sales_summary_admin() function which enforces admin-only access.';