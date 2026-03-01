
-- Create training_categories table
CREATE TABLE public.training_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Training categories: admin full"
  ON public.training_categories
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public can view active categories
CREATE POLICY "Training categories: public can view active"
  ON public.training_categories
  FOR SELECT
  USING (active = true);

-- Add category_id to training_programs
ALTER TABLE public.training_programs
  ADD COLUMN category_id uuid REFERENCES public.training_categories(id) ON DELETE SET NULL;

-- Auto-update updated_at
CREATE TRIGGER training_categories_updated_at
  BEFORE UPDATE ON public.training_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
