-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

-- Create new policies using has_role function
CREATE POLICY "Admins can insert app settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app settings" 
ON public.app_settings 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'::app_role));