-- Add related_training_ids column to training_programs for linking related trainings
ALTER TABLE public.training_programs
ADD COLUMN related_training_ids uuid[] DEFAULT '{}';