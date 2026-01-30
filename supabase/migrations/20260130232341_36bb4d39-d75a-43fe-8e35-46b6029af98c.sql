-- Add excerpt column for short summaries on listing page
ALTER TABLE public.training_programs 
ADD COLUMN excerpt text;