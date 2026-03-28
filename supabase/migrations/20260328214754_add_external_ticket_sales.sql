-- Add external ticket sales fields to events table
-- This enables events to use external ticketing platforms (Eventbrite, etc.)
-- instead of the internal Stripe-based system

-- Add the new columns for external ticket sales
ALTER TABLE public.events 
ADD COLUMN external_ticket_sales boolean DEFAULT false,
ADD COLUMN external_ticket_url text,
ADD COLUMN external_ticket_button_text text DEFAULT 'Get Tickets';

-- Create table to track external email captures for analytics
CREATE TABLE public.external_email_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_external_email_captures_event_id ON public.external_email_captures(event_id);
CREATE INDEX idx_external_email_captures_email ON public.external_email_captures(email);
CREATE INDEX idx_external_email_captures_captured_at ON public.external_email_captures(captured_at);

-- Add RLS (Row Level Security) policies for external_email_captures
ALTER TABLE public.external_email_captures ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all captures
CREATE POLICY "Admins can read external email captures" ON public.external_email_captures
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.admins));

-- Allow edge functions to insert captures (using service role)
CREATE POLICY "Service role can insert external email captures" ON public.external_email_captures
  FOR INSERT WITH CHECK (true);

-- Update the events table RLS to include the new fields (they inherit existing policies)

-- Add comments for documentation
COMMENT ON COLUMN public.events.external_ticket_sales IS 'When true, use external ticketing platform instead of internal Stripe system';
COMMENT ON COLUMN public.events.external_ticket_url IS 'URL to external ticketing platform (required when external_ticket_sales is true)';
COMMENT ON COLUMN public.events.external_ticket_button_text IS 'Text displayed on the purchase button for external sales';
COMMENT ON TABLE public.external_email_captures IS 'Tracks email addresses captured before redirecting to external ticket sales';