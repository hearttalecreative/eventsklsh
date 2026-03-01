-- Drop the RESTRICTIVE policies
DROP POLICY IF EXISTS "Training categories: admin full" ON public.training_categories;
DROP POLICY IF EXISTS "Training categories: public can view active" ON public.training_categories;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Training categories: admin full"
  ON public.training_categories
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Training categories: public can view active"
  ON public.training_categories
  FOR SELECT
  TO anon, authenticated
  USING (active = true);