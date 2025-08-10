-- Set explicit search_path for helper functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.validate_ticket_early_bird()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.early_bird_start IS NOT NULL AND NEW.early_bird_end IS NOT NULL THEN
    IF NEW.early_bird_start > NEW.early_bird_end THEN
      RAISE EXCEPTION 'early_bird_start must be before early_bird_end';
    END IF;
  END IF;
  RETURN NEW;
END; $$;