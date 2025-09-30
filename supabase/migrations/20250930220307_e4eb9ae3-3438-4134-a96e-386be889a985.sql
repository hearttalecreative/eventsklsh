-- Recreate policies with different names to avoid deadlock
-- First drop all existing policies
DO $$ 
BEGIN
  -- Drop attendees policies
  DROP POLICY IF EXISTS "Attendees: owner can read" ON public.attendees;
  DROP POLICY IF EXISTS "Attendees: admin full" ON public.attendees;
  DROP POLICY IF EXISTS "Attendees: admins can do everything" ON public.attendees;
  DROP POLICY IF EXISTS "Attendees: users can view their own" ON public.attendees;
  
  -- Drop order_items policies  
  DROP POLICY IF EXISTS "Order_items: owner can read" ON public.order_items;
  DROP POLICY IF EXISTS "Order_items: admin full" ON public.order_items;
  DROP POLICY IF EXISTS "Order_items: owner can write" ON public.order_items;
  DROP POLICY IF EXISTS "Order_items: admins can do everything" ON public.order_items;
  DROP POLICY IF EXISTS "Order_items: users can view their own" ON public.order_items;
  DROP POLICY IF EXISTS "Order_items: users can insert their own" ON public.order_items;
END $$;

-- Create simple, working policies for attendees
CREATE POLICY "attendees_admin_all"
ON public.attendees
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "attendees_user_select"
ON public.attendees
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE attendees.order_item_id = oi.id 
    AND o.user_id = auth.uid()
  )
);

-- Create simple, working policies for order_items
CREATE POLICY "order_items_admin_all"
ON public.order_items
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "order_items_user_select"
ON public.order_items
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  )
);

CREATE POLICY "order_items_user_insert"
ON public.order_items
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  )
);
