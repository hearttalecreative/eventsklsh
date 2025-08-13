-- Add ticket description and event timezone
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Los_Angeles';
