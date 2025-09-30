-- Fix RLS visibility so admins can read order items and attendees created by customers
-- Recreate policies as PERMISSIVE for SELECT while keeping strict checks

-- Order Items policies
DROP POLICY IF EXISTS "Order_items: owner can read" ON public.order_items;
CREATE POLICY "Order_items: owner can read"
ON public.order_items
AS PERMISSIVE
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Order_items: admin full" ON public.order_items;
CREATE POLICY "Order_items: admin full"
ON public.order_items
AS PERMISSIVE
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Attendees policies
DROP POLICY IF EXISTS "Attendees: owner can read" ON public.attendees;
CREATE POLICY "Attendees: owner can read"
ON public.attendees
AS PERMISSIVE
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE attendees.order_item_id = oi.id AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Attendees: admin full" ON public.attendees;
CREATE POLICY "Attendees: admin full"
ON public.attendees
AS PERMISSIVE
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
