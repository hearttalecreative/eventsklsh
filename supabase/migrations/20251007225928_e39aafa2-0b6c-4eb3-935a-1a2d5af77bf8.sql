-- Create table for checkout initiation logs
CREATE TABLE public.checkout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  total_amount_cents INTEGER NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_checkout_logs_created_at ON public.checkout_logs(created_at DESC);
CREATE INDEX idx_checkout_logs_event_id ON public.checkout_logs(event_id);

-- RLS policies: only admins can access
ALTER TABLE public.checkout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checkout logs: admin full access"
  ON public.checkout_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Automatic cleanup function for logs older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_old_checkout_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.checkout_logs
  WHERE created_at < (now() - INTERVAL '90 days');
END;
$$;

-- You can set up a cron job later to run this function daily
-- For now, it can be called manually or via a scheduled task