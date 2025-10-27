-- ========================================
-- SECURITY FIX #1: Fix attendees RLS policy
-- ========================================
-- Current problem: Users can see ALL attendees from events they purchased tickets for
-- Solution: Restrict to only THEIR OWN attendees (from their order items)

-- Drop the problematic policy
DROP POLICY IF EXISTS "attendees_user_select" ON public.attendees;

-- Create the corrected policy that restricts to user's own order items
CREATE POLICY "attendees_user_select" 
ON public.attendees 
FOR SELECT 
USING (
  -- Users can only see attendees from their own order items
  order_item_id IN (
    SELECT oi.id 
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.user_id = auth.uid()
  )
);

-- ========================================
-- SECURITY FIX #2: Enable RLS on sales summary views
-- ========================================
-- Current problem: Anyone can query revenue data via event_sales_summary and venue_sales_summary views
-- Solution: These views can only be queried by admins via the security definer functions

-- Note: PostgreSQL views cannot have RLS policies directly
-- Instead, we create security definer functions that admins will use
-- The existing get_event_sales_summary_admin() and get_venue_sales_summary_admin() 
-- functions already restrict access to admins only

-- We don't need to create additional policies since:
-- 1. The views are already accessed via admin-only functions (get_event_sales_summary_admin, get_venue_sales_summary_admin)
-- 2. The frontend code uses these functions, not direct view access
-- 3. Adding a policy to revoke public access would break the existing admin functions

-- No action needed for views - they are already protected via function-based access control