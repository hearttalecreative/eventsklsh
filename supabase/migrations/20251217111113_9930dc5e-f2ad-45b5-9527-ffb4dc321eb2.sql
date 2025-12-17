-- Add hidden column to events table for manual visibility control
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.events.hidden IS 'Admin can manually hide/show events regardless of status';