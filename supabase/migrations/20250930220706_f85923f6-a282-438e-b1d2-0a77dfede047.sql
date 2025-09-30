-- Function: get_ticket_sales_for_event_admin(ev_id)
-- Returns per-ticket sales (paid + comped mapped to that ticket) and a row for unassigned comped
CREATE OR REPLACE FUNCTION public.get_ticket_sales_for_event_admin(ev_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  ticket_name text,
  ticket_capacity integer,
  tickets_sold bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict admin check
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  WITH paid AS (
    SELECT oi.ticket_id, COUNT(a.id)::bigint AS cnt
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id AND o.status = 'paid'
    LEFT JOIN public.attendees a ON a.order_item_id = oi.id
    WHERE oi.ticket_id IN (SELECT id FROM public.tickets WHERE event_id = ev_id)
    GROUP BY oi.ticket_id
  ),
  comped AS (
    SELECT a.comped_ticket_id AS ticket_id, COUNT(*)::bigint AS cnt
    FROM public.attendees a
    WHERE a.event_id = ev_id AND a.is_comped = true AND a.comped_ticket_id IS NOT NULL
    GROUP BY a.comped_ticket_id
  ),
  base AS (
    SELECT t.id AS ticket_id, t.name AS ticket_name, t.capacity_total AS ticket_capacity
    FROM public.tickets t
    WHERE t.event_id = ev_id
  )
  SELECT b.ticket_id, b.ticket_name, b.ticket_capacity, COALESCE(p.cnt,0) + COALESCE(c.cnt,0) AS tickets_sold
  FROM base b
  LEFT JOIN paid p ON p.ticket_id = b.ticket_id
  LEFT JOIN comped c ON c.ticket_id = b.ticket_id

  UNION ALL

  SELECT NULL::uuid, 'Comped / Credited (Custom)'::text, 0, COUNT(*)::bigint
  FROM public.attendees a
  WHERE a.event_id = ev_id AND a.is_comped = true AND a.comped_ticket_id IS NULL;
END;
$$;