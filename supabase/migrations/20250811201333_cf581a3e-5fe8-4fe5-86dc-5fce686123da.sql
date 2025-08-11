-- 1) Types for coupons
CREATE TYPE public.discount_apply_to AS ENUM ('tickets','addons','both');

-- 2) Coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  discount_percent INTEGER,           -- 0..100 when using percentage discounts
  discount_amount_cents INTEGER,      -- optional fixed amount discount
  apply_to public.discount_apply_to NOT NULL DEFAULT 'both',
  event_id UUID NULL REFERENCES public.events(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  max_redemptions INTEGER NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupons_percent_range CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  CONSTRAINT coupons_nonnegative_amount CHECK (discount_amount_cents IS NULL OR discount_amount_cents >= 0)
);

-- Ensure uniqueness per code and scope (global vs per-event)
CREATE UNIQUE INDEX coupons_code_scope_unique ON public.coupons (upper(code), event_id);

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Coupon redemptions table
CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NULL,
  email TEXT NULL,
  amount_discount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX coupon_redemptions_coupon_idx ON public.coupon_redemptions (coupon_id);
CREATE INDEX coupon_redemptions_event_idx ON public.coupon_redemptions (event_id);

-- 4) RLS policies
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons: admin full" ON public.coupons
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupon_redemptions: admin full" ON public.coupon_redemptions
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 5) Add phone to attendees
ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS phone TEXT;

-- 6) Seed requested 100% global coupon KLSH100 (applies to all, no expiry, unlimited uses)
INSERT INTO public.coupons (code, description, discount_percent, apply_to, event_id, starts_at, ends_at, max_redemptions, active)
VALUES ('KLSH100', '100% OFF en tickets y add-ons (global)', 100, 'both', NULL, NULL, NULL, NULL, true)
ON CONFLICT DO NOTHING;