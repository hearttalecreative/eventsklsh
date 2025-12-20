-- Store Stripe checkout cart payload server-side (avoids Stripe metadata 500-char limit)

CREATE TABLE IF NOT EXISTS public.pending_checkouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 days'),
  cart JSONB NOT NULL,
  buyer_email TEXT NULL,
  event_id UUID NULL,
  stripe_session_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_expires_at ON public.pending_checkouts (expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_stripe_session_id ON public.pending_checkouts (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_pending_checkouts_event_id ON public.pending_checkouts (event_id);

ALTER TABLE public.pending_checkouts ENABLE ROW LEVEL SECURITY;

-- No RLS policies on purpose: only the service role (Edge Functions) can read/write.
