-- Add availability_info column for custom text to display below preferred dates field
ALTER TABLE public.training_programs
ADD COLUMN availability_info text;

-- Add a comment for clarity
COMMENT ON COLUMN public.training_programs.availability_info IS 'Custom text displayed below the Preferred Date field in registration form. Supports HTML line breaks.';