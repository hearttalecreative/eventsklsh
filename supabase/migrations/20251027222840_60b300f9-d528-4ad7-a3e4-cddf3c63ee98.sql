-- ========================================
-- SECURITY FIX #5: Remove PII from checkout_logs
-- ========================================
-- Current problem: checkout_logs stores first_name, last_name, email, phone indefinitely
-- Solution: Remove PII columns and keep only aggregated metrics

-- Remove PII columns from checkout_logs
ALTER TABLE public.checkout_logs 
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;

-- Add created_at index for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_checkout_logs_created_at 
  ON public.checkout_logs(created_at);

-- Schedule automatic cleanup of old logs (30 days instead of 90)
-- This reduces the data retention window significantly
COMMENT ON TABLE public.checkout_logs IS 'Anonymized checkout attempt metrics. Auto-deleted after 30 days by scheduled function.';

-- Update the cleanup function to use 30 days instead of 90
CREATE OR REPLACE FUNCTION public.cleanup_old_checkout_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete logs older than 30 days (reduced from 90)
  DELETE FROM public.checkout_logs
  WHERE created_at < (now() - INTERVAL '30 days');
END;
$function$;