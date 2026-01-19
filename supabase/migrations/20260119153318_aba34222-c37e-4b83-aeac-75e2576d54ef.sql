-- Add original price and date range columns to training_programs
ALTER TABLE public.training_programs
ADD COLUMN original_price_cents integer,
ADD COLUMN available_from date,
ADD COLUMN available_to date;

-- Add comment to explain the columns
COMMENT ON COLUMN public.training_programs.original_price_cents IS 'Original price before discount. If set, price_cents is the sale price.';
COMMENT ON COLUMN public.training_programs.available_from IS 'Start date for when this training is available for booking.';
COMMENT ON COLUMN public.training_programs.available_to IS 'End date for when this training is available for booking.';