-- Add QR code functionality to attendees table
ALTER TABLE public.attendees 
ADD COLUMN qr_code TEXT UNIQUE;

-- Generate QR codes for existing attendees  
UPDATE public.attendees 
SET qr_code = 'QR-' || upper(encode(extensions.gen_random_bytes(8), 'hex'))
WHERE qr_code IS NULL;

-- Create function to generate QR codes for new attendees
CREATE OR REPLACE FUNCTION public.generate_qr_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := 'QR-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.attendees WHERE qr_code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

-- Update attendees trigger to generate QR codes
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

  -- Generate QR code if not provided
  IF NEW.qr_code IS NULL OR length(trim(NEW.qr_code)) = 0 THEN
    NEW.qr_code := public.generate_qr_code();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for attendees
DROP TRIGGER IF EXISTS attendees_before_ins_upd_trigger ON public.attendees;
CREATE TRIGGER attendees_before_ins_upd_trigger
  BEFORE INSERT OR UPDATE ON public.attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.attendees_before_ins_upd();