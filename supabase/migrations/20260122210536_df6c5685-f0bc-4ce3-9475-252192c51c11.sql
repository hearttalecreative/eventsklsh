-- Create a table for global app settings
CREATE TABLE public.app_settings (
  id text PRIMARY KEY,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings
CREATE POLICY "Anyone can read app settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

-- Allow authenticated admins to update settings
CREATE POLICY "Admins can update app settings" 
ON public.app_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE admin_allowlist.email = auth.jwt()->>'email'
  )
);

CREATE POLICY "Admins can insert app settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_allowlist 
    WHERE admin_allowlist.email = auth.jwt()->>'email'
  )
);

-- Insert default savings message template
-- Use {amount} as placeholder for the savings amount
INSERT INTO public.app_settings (id, value, description)
VALUES (
  'training_savings_message',
  'Save {amount} with our special sale now.',
  'Message shown below training/bundle prices when there is a discount. Use {amount} as placeholder for the savings amount.'
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();