-- Add Stripe session id to orders for idempotency
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- Ensure only one order per Stripe session
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_stripe_session_id
  ON public.orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;