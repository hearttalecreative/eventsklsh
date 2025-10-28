-- Create table for Stripe audit logs
CREATE TABLE IF NOT EXISTS public.stripe_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  stripe_session_id text,
  stripe_event_id text,
  customer_name text,
  customer_email text NOT NULL,
  amount_cents integer,
  currency text DEFAULT 'usd',
  status text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  event_title text,
  tickets_count integer,
  metadata jsonb,
  error_message text,
  processing_time_ms integer
);

-- Create indexes for fast querying
CREATE INDEX idx_stripe_logs_created_at ON public.stripe_logs(created_at DESC);
CREATE INDEX idx_stripe_logs_customer_email ON public.stripe_logs(customer_email);
CREATE INDEX idx_stripe_logs_customer_name ON public.stripe_logs(customer_name);
CREATE INDEX idx_stripe_logs_stripe_session_id ON public.stripe_logs(stripe_session_id);
CREATE INDEX idx_stripe_logs_event_type ON public.stripe_logs(event_type);
CREATE INDEX idx_stripe_logs_status ON public.stripe_logs(status);

-- Enable RLS
ALTER TABLE public.stripe_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies: Only admins can access
CREATE POLICY "Stripe logs: admin full access"
  ON public.stripe_logs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add comment
COMMENT ON TABLE public.stripe_logs IS 'Audit log of all Stripe payment events and processing';
