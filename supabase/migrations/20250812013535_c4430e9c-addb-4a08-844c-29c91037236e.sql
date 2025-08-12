-- Update functions to set search_path for security linter compliance

CREATE OR REPLACE FUNCTION public.generate_confirmation_code(_len int DEFAULT 10)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
    v_code := substr(v_code, 1, GREATEST(6, _len));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.attendees WHERE confirmation_code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.attendees_before_ins_upd()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := initcap(NEW.name);
  END IF;

  IF NEW.confirmation_code IS NULL OR length(trim(NEW.confirmation_code)) = 0 THEN
    NEW.confirmation_code := public.generate_confirmation_code(10);
  ELSE
    NEW.confirmation_code := upper(NEW.confirmation_code);
  END IF;
  RETURN NEW;
END;
$$;