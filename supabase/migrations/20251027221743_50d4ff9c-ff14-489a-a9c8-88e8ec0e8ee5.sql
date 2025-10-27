-- Add unique index on stripe_session_id to enable upsert and prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orders_stripe_session_id 
ON public.orders(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL;