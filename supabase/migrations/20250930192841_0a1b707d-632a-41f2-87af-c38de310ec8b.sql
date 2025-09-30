-- Add is_comped column to attendees table
ALTER TABLE public.attendees 
ADD COLUMN IF NOT EXISTS is_comped boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendees_is_comped ON public.attendees(is_comped);