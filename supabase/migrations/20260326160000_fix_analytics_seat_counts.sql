-- Fix analytics discrepancy across both event-specific and dashboard-wide views
-- by counting actual registered attendees instead of order quantities for paid orders.

-- 1. Fix Event-Specific Sales View RPC
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
    COALESCE(pa.cnt, 0) + COALESCE(c.cnt, 0) AS tickets_sold,
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

-- 2. Fix Dashboard Overview RPC
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics_detailed(
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  event_id uuid,
  event_title text,
  event_starts_at timestamp with time zone,
  venue_name text,
  capacity_total integer,
  seats_sold bigint,
  attendees_count bigint,
  checked_in_count bigint,
  total_revenue_cents bigint,
  ticket_revenue_cents bigint,
  addon_revenue_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  WITH event_data AS (
    SELECT
      e.id,
      e.title,
      e.starts_at,
      v.name as venue_name,
      e.capacity_total
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.status IN ('published', 'sold_out', 'paused')
      AND (p_start_date IS NULL OR e.starts_at >= p_start_date)
      AND (p_end_date IS NULL OR e.starts_at <= p_end_date)
  ),
  ticket_sales AS (
    SELECT
      t.event_id,
      SUM(
        -- FIX: Always count actual attendees for paid orders, no GREATEST fallback
        COALESCE((
          SELECT COUNT(a.id)
          FROM public.attendees a
          JOIN public.order_items oi ON oi.id = a.order_item_id
          JOIN public.orders o ON o.id = oi.order_id
          WHERE oi.ticket_id = t.id AND o.status = 'paid'
        ), 0) +
        COALESCE((
          SELECT COUNT(*)
          FROM public.attendees a
          WHERE a.comped_ticket_id = t.id AND a.is_comped = true
        ), 0)
      )::bigint as total_seats
    FROM public.tickets t
    GROUP BY t.event_id
  ),
  attendee_stats AS (
    SELECT
      a.event_id,
      COUNT(*)::bigint as total_attendees,
      COUNT(*) FILTER (WHERE a.checked_in_at IS NOT NULL)::bigint as checked_in
    FROM public.attendees a
    GROUP BY a.event_id
  ),
  revenue_by_type AS (
    SELECT
      o.event_id,
      SUM(o.total_amount_cents)::bigint as total_revenue,
      COALESCE(SUM(CASE WHEN oi.ticket_id IS NOT NULL THEN oi.total_amount_cents ELSE 0 END), 0)::bigint as ticket_revenue,
      COALESCE(SUM(CASE WHEN oi.addon_id IS NOT NULL THEN oi.total_amount_cents ELSE 0 END), 0)::bigint as addon_revenue
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.status = 'paid'
    GROUP BY o.event_id
  )
  SELECT
    ed.id,
    ed.title,
    ed.starts_at,
    COALESCE(ed.venue_name, 'Unknown'),
    COALESCE(ed.capacity_total, 0),
    COALESCE(ts.total_seats, 0),
    COALESCE(ast.total_attendees, 0),
    COALESCE(ast.checked_in, 0),
    COALESCE(rbt.total_revenue, 0),
    COALESCE(rbt.ticket_revenue, 0),
    COALESCE(rbt.addon_revenue, 0)
  FROM event_data ed
  LEFT JOIN ticket_sales ts ON ts.event_id = ed.id
  LEFT JOIN attendee_stats ast ON ast.event_id = ed.id
  LEFT JOIN revenue_by_type rbt ON rbt.event_id = ed.id
  ORDER BY ed.starts_at DESC;
END;
$$;
