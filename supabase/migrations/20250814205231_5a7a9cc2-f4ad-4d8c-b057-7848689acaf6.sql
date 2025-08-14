-- Add max_quantity_per_person column to addons table
ALTER TABLE public.addons 
ADD COLUMN max_quantity_per_person INTEGER DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.addons.max_quantity_per_person IS 'Maximum quantity of this addon that can be selected per person. NULL means unlimited.';