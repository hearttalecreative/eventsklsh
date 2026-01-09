-- Add one_per_customer column to coupons table
ALTER TABLE public.coupons
ADD COLUMN one_per_customer boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.coupons.one_per_customer IS 'If true, each email can only use this coupon once';