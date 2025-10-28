-- Create a comprehensive dashboard analytics function for admins
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics_admin()
RETURNS TABLE(
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  venue_name text,
  capacity_total integer,
  seats_sold bigint,
  attendees_count bigint,
  checked_in_count bigint,
  total_revenue_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict admin check
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
    WHERE e.status = 'published'
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
      COUNT(a.checked_in_at)::bigint as checked_in
    FROM public.attendees a
    GROUP BY a.event_id
  ),
  revenue_stats AS (
    SELECT 
      o.event_id,
      SUM(o.total_amount_cents)::bigint as revenue
    FROM public.orders o
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
    COALESCE(rs.revenue, 0)
  FROM event_data ed
  LEFT JOIN ticket_sales ts ON ts.event_id = ed.id
  LEFT JOIN attendee_stats ast ON ast.event_id = ed.id
  LEFT JOIN revenue_stats rs ON rs.event_id = ed.id
  ORDER BY ed.starts_at DESC;
END;
$$;