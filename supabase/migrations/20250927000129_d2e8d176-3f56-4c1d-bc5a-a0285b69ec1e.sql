-- Fix the security issue by ensuring sales summary data is only accessible through admin functions
-- We'll modify the approach: keep the views but make sure they can only be accessed via RPC calls

-- First, revoke all privileges on the views from public and authenticated roles
REVOKE ALL ON public.venue_sales_summary FROM public, authenticated, anon;
REVOKE ALL ON public.event_sales_summary FROM public, authenticated, anon;

-- Grant access only to the postgres role (for internal use by the admin functions)
GRANT SELECT ON public.venue_sales_summary TO postgres;
GRANT SELECT ON public.event_sales_summary TO postgres;

-- Update the existing admin functions to be more explicit about security
-- and ensure they're the only way to access this data
CREATE OR REPLACE FUNCTION public.get_venue_sales_summary_admin()
RETURNS SETOF venue_sales_summary
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Strict admin access check
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required to view financial data';
  END IF;
  
  -- Return the venue sales summary data
  RETURN QUERY SELECT * FROM public.venue_sales_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_sales_summary_admin()
RETURNS SETOF event_sales_summary
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Strict admin access check
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required to view financial data';
  END IF;
  
  -- Return the event sales summary data
  RETURN QUERY SELECT * FROM public.event_sales_summary;
END;
$$;