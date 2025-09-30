-- Add internal_notes column to attendees table
ALTER TABLE public.attendees 
ADD COLUMN internal_notes text;

COMMENT ON COLUMN public.attendees.internal_notes IS 'Internal admin notes for manually created attendees';