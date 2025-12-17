-- Update RLS policy to include 'paused' events for public view
DROP POLICY IF EXISTS "Events: public can view published and sold_out" ON public.events;

CREATE POLICY "Events: public can view published sold_out and paused"
ON public.events
FOR SELECT
USING (
  (status = ANY (ARRAY['published'::event_status, 'sold_out'::event_status, 'paused'::event_status]))
  AND (hidden = false)
);