-- Fix linter error: set views to run with SECURITY INVOKER
ALTER VIEW public.event_sales_summary SET (security_invoker = on);
ALTER VIEW public.venue_sales_summary SET (security_invoker = on);
