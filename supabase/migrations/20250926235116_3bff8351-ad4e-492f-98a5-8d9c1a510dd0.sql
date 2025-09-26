-- Add internal notes and display order for tickets
ALTER TABLE public.tickets 
ADD COLUMN internal_notes TEXT,
ADD COLUMN display_order INTEGER DEFAULT 0;

-- Create index for display order
CREATE INDEX idx_tickets_display_order ON public.tickets(event_id, display_order);

-- Update existing tickets to have sequential display orders
WITH ordered_tickets AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at) as row_num
  FROM public.tickets
)
UPDATE public.tickets 
SET display_order = ordered_tickets.row_num
FROM ordered_tickets 
WHERE public.tickets.id = ordered_tickets.id;