-- Enable RLS on sales summary tables
ALTER TABLE public.event_sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_sales_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies to restrict access to admin users only
CREATE POLICY "Event sales summary: admin only" 
ON public.event_sales_summary 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Venue sales summary: admin only" 
ON public.venue_sales_summary 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));