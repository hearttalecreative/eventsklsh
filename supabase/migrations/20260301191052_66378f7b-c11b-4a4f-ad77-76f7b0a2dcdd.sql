-- Auto-set display_order on insert if not provided or null
CREATE OR REPLACE FUNCTION public.set_training_category_display_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.display_order IS NULL OR NEW.display_order = 0 THEN
    SELECT COALESCE(MAX(display_order), -1) + 1 INTO NEW.display_order
    FROM public.training_categories;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_training_category_display_order
  BEFORE INSERT ON public.training_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_training_category_display_order();

-- Also set a proper default so inserts never fail on null
ALTER TABLE public.training_categories ALTER COLUMN display_order SET DEFAULT 0;