-- Add slug column to events and ensure unique, friendly URLs
BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs for existing rows (friendly + short id suffix for uniqueness)
UPDATE public.events e
SET slug = lower(regexp_replace(coalesce(e.title,''), '[^a-z0-9]+', '-', 'gi')) || '-' || substr(e.id::text, 1, 6)
WHERE e.slug IS NULL;

-- Enforce uniqueness (case-insensitive) and NOT NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'events_slug_key'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX events_slug_key ON public.events (lower(slug))';
  END IF;
END $$;

ALTER TABLE public.events ALTER COLUMN slug SET NOT NULL;

-- Helper to compute slug consistently
CREATE OR REPLACE FUNCTION public.compute_event_slug(_title text, _id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT lower(regexp_replace(coalesce(_title,''), '[^a-z0-9]+', '-', 'gi')) || '-' || substr(_id::text, 1, 6)
$$;

-- Trigger to set/update slug on insert/update
CREATE OR REPLACE FUNCTION public.set_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.slug := COALESCE(NEW.slug, public.compute_event_slug(NEW.title, NEW.id));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Recompute if title changes or slug cleared
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.slug IS NULL THEN
      NEW.slug := public.compute_event_slug(NEW.title, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_event_slug ON public.events;
CREATE TRIGGER trg_set_event_slug
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_event_slug();

COMMIT;