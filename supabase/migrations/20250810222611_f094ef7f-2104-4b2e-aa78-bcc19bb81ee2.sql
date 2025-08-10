-- Make events.sku auto-generated, unique, and immutable
-- 1) Backfill missing SKUs for existing rows
UPDATE public.events
SET sku = 'ev-' || encode(gen_random_bytes(6), 'hex')
WHERE sku IS NULL;

-- 2) Ensure NOT NULL and default value for new rows
ALTER TABLE public.events
  ALTER COLUMN sku SET DEFAULT ('ev-' || encode(gen_random_bytes(6), 'hex')),
  ALTER COLUMN sku SET NOT NULL;

-- 3) Add uniqueness constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_sku_unique'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_sku_unique UNIQUE (sku);
  END IF;
END $$;

-- 4) Prevent SKU updates after insert
CREATE OR REPLACE FUNCTION public.prevent_sku_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sku <> OLD.sku THEN
    RAISE EXCEPTION 'SKU is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_sku_update ON public.events;
CREATE TRIGGER trg_prevent_sku_update
BEFORE UPDATE OF sku ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sku_update();