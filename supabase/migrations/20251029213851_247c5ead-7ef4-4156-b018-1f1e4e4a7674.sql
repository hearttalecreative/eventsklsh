-- Drop and recreate the function with updated return type to include participants_per_ticket
DROP FUNCTION IF EXISTS public.get_ticket_sales_for_event_admin(uuid);

CREATE OR REPLACE FUNCTION public.get_ticket_sales_for_event_admin(ev_id uuid)
 RETURNS TABLE(
   ticket_id uuid, 
   ticket_name text, 
   ticket_capacity integer, 
   tickets_sold bigint, 
   unit_price_cents integer, 
   total_revenue_cents bigint,
   participants_per_ticket integer
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Strict admin check
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT id, name, capacity_total, participants_per_ticket, unit_amount_cents
    FROM public.tickets
    WHERE event_id = ev_id
  ),
  paid_ordered AS (
    SELECT 
      oi.ticket_id,
      COALESCE(SUM(oi.quantity * b.participants_per_ticket), 0)::bigint AS qty,
      COALESCE(SUM(oi.total_amount_cents), 0)::bigint AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id AND o.status = 'paid'
    JOIN base b ON b.id = oi.ticket_id
    GROUP BY oi.ticket_id
  ),
  paid_attendees AS (
    SELECT oi.ticket_id,
           COUNT(a.id)::bigint AS cnt
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id AND o.status = 'paid'
    LEFT JOIN public.attendees a ON a.order_item_id = oi.id
    WHERE oi.ticket_id IN (SELECT id FROM base)
    GROUP BY oi.ticket_id
  ),
  comped AS (
    SELECT a.comped_ticket_id AS ticket_id,
           COUNT(*)::bigint AS cnt
    FROM public.attendees a
    WHERE a.event_id = ev_id AND a.is_comped = true AND a.comped_ticket_id IS NOT NULL
    GROUP BY a.comped_ticket_id
  )
  SELECT 
    b.id AS ticket_id,
    b.name AS ticket_name,
    b.capacity_total AS ticket_capacity,
    COALESCE(GREATEST(COALESCE(pa.cnt, 0), COALESCE(po.qty, 0)), 0) + COALESCE(c.cnt, 0) AS tickets_sold,
    b.unit_amount_cents AS unit_price_cents,
    COALESCE(po.revenue, 0) AS total_revenue_cents,
    b.participants_per_ticket AS participants_per_ticket
  FROM base b
  LEFT JOIN paid_ordered po ON po.ticket_id = b.id
  LEFT JOIN paid_attendees pa ON pa.ticket_id = b.id
  LEFT JOIN comped c ON c.ticket_id = b.id

  UNION ALL

  SELECT 
    NULL::uuid,
    'Comped / Credited (Custom)'::text,
    0,
    COUNT(*)::bigint,
    0,
    0::bigint,
    1
  FROM public.attendees a
  WHERE a.event_id = ev_id AND a.is_comped = true AND a.comped_ticket_id IS NULL;
END;
$function$;