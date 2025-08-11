-- Restrict access to financial summary views to admins only
-- 1) Revoke direct SELECT from anon/authenticated roles
REVOKE ALL ON TABLE public.event_sales_summary FROM anon, authenticated;
REVOKE ALL ON TABLE public.venue_sales_summary FROM anon, authenticated;

-- 2) Create admin-only RPCs that expose the summaries securely
CREATE OR REPLACE FUNCTION public.get_event_sales_summary_admin()
RETURNS SETOF public.event_sales_summary
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.event_sales_summary;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_venue_sales_summary_admin()
RETURNS SETOF public.venue_sales_summary
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.venue_sales_summary;
END;
$$;

-- 3) Allow authenticated users to call, but function itself checks admin role
GRANT EXECUTE ON FUNCTION public.get_event_sales_summary_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_venue_sales_summary_admin() TO authenticated;