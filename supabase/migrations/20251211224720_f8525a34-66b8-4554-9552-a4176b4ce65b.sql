-- Add processing fee percentage column to training_programs
ALTER TABLE public.training_programs 
ADD COLUMN processing_fee_percent numeric(5,2) NOT NULL DEFAULT 3.5;

-- Remove the old stripe_fee_cents column since we'll calculate dynamically
ALTER TABLE public.training_programs 
DROP COLUMN stripe_fee_cents;