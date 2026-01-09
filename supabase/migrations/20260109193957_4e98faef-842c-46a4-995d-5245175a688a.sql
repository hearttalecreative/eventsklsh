-- Add one_per_customer_per_event column to coupons table
-- This allows each customer to use the coupon once per event (instead of once globally)
ALTER TABLE public.coupons 
ADD COLUMN one_per_customer_per_event boolean NOT NULL DEFAULT false;