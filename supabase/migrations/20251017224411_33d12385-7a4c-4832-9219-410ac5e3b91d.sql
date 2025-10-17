-- Add explicit restrictive policies to prevent accidental public exposure of sensitive data

-- Drop existing policies if they exist to recreate them properly
DROP POLICY IF EXISTS "Prevent public access to checkout logs" ON public.checkout_logs;
DROP POLICY IF EXISTS "Prevent public access to attendees" ON public.attendees;

-- Checkout Logs: Explicit restrictive policy to block public access
-- This ensures that even if a permissive policy is accidentally added, 
-- unauthenticated users cannot access checkout logs
CREATE POLICY "Prevent public access to checkout logs"
ON public.checkout_logs
AS RESTRICTIVE
FOR ALL
TO public
USING (false);

-- Attendees: Explicit restrictive policy to block public access
-- This protects customer PII (emails, phone numbers, names, confirmation codes)
CREATE POLICY "Prevent public access to attendees"
ON public.attendees
AS RESTRICTIVE
FOR ALL
TO public
USING (false);

-- Add comment to document security measure
COMMENT ON POLICY "Prevent public access to checkout logs" ON public.checkout_logs IS 
'Restrictive policy to prevent accidental public exposure of customer payment and contact data. Only admins can access via the admin policy.';

COMMENT ON POLICY "Prevent public access to attendees" ON public.attendees IS 
'Restrictive policy to prevent accidental public exposure of customer PII. Access is controlled via explicit admin and user policies.';