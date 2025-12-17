-- Drop existing public view policy
DROP POLICY IF EXISTS "Events: public can view published" ON public.events;

-- Create new policy that allows viewing published AND sold_out events (that are not hidden)
CREATE POLICY "Events: public can view published and sold_out" 
ON public.events 
FOR SELECT 
USING (status IN ('published', 'sold_out') AND hidden = false);