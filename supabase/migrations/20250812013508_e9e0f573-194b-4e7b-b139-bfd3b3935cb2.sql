-- Add confirmation_code to attendees and auto-generate unique codes; also ensure names are capitalized

-- 1) Add column
ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS confirmation_code text;

-- 2) Generator function for confirmation codes (uppercase hex, length >= 6, default 10)
CREATE OR REPLACE FUNCTION public.generate_confirmation_code(_len int DEFAULT 10)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := upper(encode(extensions.gen_random_bytes(8), 'hex')); -- 16 hex chars
    v_code := substr(v_code, 1, GREATEST(6, _len));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.attendees WHERE confirmation_code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

-- 3) Trigger function to set confirmation_code and capitalize name
CREATE OR REPLACE FUNCTION public.attendees_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Capitalize attendee name consistently
  IF NEW.name IS NOT NULL THEN
    NEW.name := initcap(NEW.name);
  END IF;

  -- Ensure uppercase and presence of confirmation_code
  IF NEW.confirmation_code IS NULL OR length(trim(NEW.confirmation_code)) = 0 THEN
    NEW.confirmation_code := public.generate_confirmation_code(10);
  ELSE
    NEW.confirmation_code := upper(NEW.confirmation_code);
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Create trigger (drop if exists to avoid duplicates)
DROP TRIGGER IF EXISTS trg_attendees_before_ins_upd ON public.attendees;
CREATE TRIGGER trg_attendees_before_ins_upd
BEFORE INSERT OR UPDATE ON public.attendees
FOR EACH ROW
EXECUTE FUNCTION public.attendees_before_ins_upd();

-- 5) Backfill existing rows
UPDATE public.attendees
SET confirmation_code = public.generate_confirmation_code(10)
WHERE confirmation_code IS NULL;

UPDATE public.attendees
SET name = initcap(name)
WHERE name IS NOT NULL;

-- 6) Enforce uniqueness and NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendees_confirmation_code_key'
      AND conrelid = 'public.attendees'::regclass
  ) THEN
    ALTER TABLE public.attendees
      ADD CONSTRAINT attendees_confirmation_code_key UNIQUE (confirmation_code);
  END IF;
END $$;

ALTER TABLE public.attendees
  ALTER COLUMN confirmation_code SET NOT NULL;