-- Fix search path for existing functions
CREATE OR REPLACE FUNCTION public.generate_qr_code()
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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