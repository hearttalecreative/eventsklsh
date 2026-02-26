
-- Add hidden column to tickets table
ALTER TABLE public.tickets ADD COLUMN hidden boolean NOT NULL DEFAULT false;

-- Drop existing public view policy and recreate with hidden filter
DROP POLICY IF EXISTS "Tickets: public view for published events" ON public.tickets;

CREATE POLICY "Tickets: public view for published events"
ON public.tickets
FOR SELECT
USING (
  hidden = false
  AND EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = tickets.event_id AND e.status = 'published'::event_status
  )
);
