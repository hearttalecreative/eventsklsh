-- Add is_primary column to user_roles table
ALTER TABLE public.user_roles
ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_roles.is_primary IS 'Indicates if this is the primary administrator with full privileges';

-- Mark the first admin as primary
UPDATE public.user_roles
SET is_primary = true
WHERE role = 'admin'::app_role
AND created_at = (
  SELECT MIN(created_at)
  FROM public.user_roles
  WHERE role = 'admin'::app_role
);

-- Create function to check if user is primary admin
CREATE OR REPLACE FUNCTION public.is_primary_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
      AND is_primary = true
  )
$$;