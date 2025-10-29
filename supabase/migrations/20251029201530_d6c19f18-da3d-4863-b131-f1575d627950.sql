-- Create table for payment error logs
CREATE TABLE IF NOT EXISTS public.payment_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Request information
  event_id UUID,
  ticket_id UUID,
  ticket_qty INTEGER,
  buyer_email TEXT,
  buyer_name TEXT,
  
  -- Error details
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  
  -- Context
  request_payload JSONB,
  validation_errors JSONB,
  
  -- Metadata
  user_agent TEXT,
  ip_address TEXT
);

-- Create index for faster queries
CREATE INDEX idx_payment_error_logs_created_at ON public.payment_error_logs(created_at DESC);
CREATE INDEX idx_payment_error_logs_event_id ON public.payment_error_logs(event_id);
CREATE INDEX idx_payment_error_logs_buyer_email ON public.payment_error_logs(buyer_email);

-- Enable RLS
ALTER TABLE public.payment_error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view error logs
CREATE POLICY "Admins can view all payment error logs"
  ON public.payment_error_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Grant access
GRANT SELECT ON public.payment_error_logs TO authenticated;
GRANT ALL ON public.payment_error_logs TO service_role;