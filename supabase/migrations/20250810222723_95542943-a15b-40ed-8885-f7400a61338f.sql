-- Harden function created in previous migration by setting search_path
CREATE OR REPLACE FUNCTION public.prevent_sku_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sku <> OLD.sku THEN
    RAISE EXCEPTION 'SKU is immutable';
  END IF;
  RETURN NEW;
END;
$$;