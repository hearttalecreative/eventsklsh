
-- Drop ALL existing policies on training_categories
DROP POLICY IF EXISTS "Training categories: admin full" ON public.training_categories;
DROP POLICY IF EXISTS "Training categories: public can view active" ON public.training_categories;
DROP POLICY IF EXISTS "training_categories_admin_full" ON public.training_categories;
DROP POLICY IF EXISTS "training_categories_public_select" ON public.training_categories;

-- Recreate as PERMISSIVE (default) — admin OR public condition, not AND
CREATE POLICY "training_categories_admin_all"
  ON public.training_categories
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "training_categories_public_read"
  ON public.training_categories
  FOR SELECT
  TO anon, authenticated
  USING (active = true);
