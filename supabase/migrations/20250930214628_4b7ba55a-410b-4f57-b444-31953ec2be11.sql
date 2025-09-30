-- Add comped_ticket_id to attendees to track which ticket a comped attendee belongs to
ALTER TABLE public.attendees
ADD COLUMN IF NOT EXISTS comped_ticket_id uuid;

-- Optional FK for data integrity (nullable to allow unassigned comped)
ALTER TABLE public.attendees
ADD CONSTRAINT attendees_comped_ticket_id_fkey
FOREIGN KEY (comped_ticket_id) REFERENCES public.tickets(id)
ON DELETE SET NULL;

-- Index to speed up analytics queries
CREATE INDEX IF NOT EXISTS idx_attendees_comped_ticket_id ON public.attendees(comped_ticket_id);
