-- Ensure dashboard analytics includes realistic check-in counts and sold-out events
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
        COALESCE(
          GREATEST(
            COALESCE((
              SELECT COUNT(a.id)
              FROM public.attendees a
              JOIN public.order_items oi ON oi.id = a.order_item_id
              JOIN public.orders o ON o.id = oi.order_id
              WHERE oi.ticket_id = t.id AND o.status = 'paid'
            ), 0),
            COALESCE((
              SELECT SUM(oi.quantity * t.participants_per_ticket)
              FROM public.order_items oi
              JOIN public.orders o ON o.id = oi.order_id
              WHERE oi.ticket_id = t.id AND o.status = 'paid'
            ), 0)
          ), 0
        ) +
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
