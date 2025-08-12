-- Remove latitude/longitude from venues table
ALTER TABLE public.venues
  DROP COLUMN IF EXISTS lat,
  DROP COLUMN IF EXISTS lng;