-- Create a function to atomically check and reserve ticket capacity
-- This prevents race conditions when multiple users purchase tickets simultaneously

CREATE OR REPLACE FUNCTION public.check_and_reserve_ticket_capacity(
  p_ticket_id uuid,
  p_requested_qty integer,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_sold_from_orders integer;
  v_comped_count integer;
  v_total_sold integer;
  v_requested_total integer;
  v_available integer;
BEGIN
  -- Lock the ticket row to prevent concurrent modifications
  SELECT id, capacity_total, participants_per_ticket, event_id
  INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;  -- This creates a row-level lock
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket not found'
    );
  END IF;

  -- Calculate currently sold tickets
  SELECT COALESCE(SUM(oi.quantity * COALESCE(v_ticket.participants_per_ticket, 1)), 0)::integer
  INTO v_sold_from_orders
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.ticket_id = p_ticket_id
    AND o.status = 'paid'
    AND o.id != p_order_id;  -- Exclude current order if checking again

  -- Count comped attendees
  SELECT COUNT(*)::integer
  INTO v_comped_count
  FROM public.attendees
  WHERE comped_ticket_id = p_ticket_id
    AND is_comped = true;

  v_total_sold := v_sold_from_orders + v_comped_count;
  v_requested_total := p_requested_qty * COALESCE(v_ticket.participants_per_ticket, 1);
  v_available := v_ticket.capacity_total - v_total_sold;

  -- Log for debugging
  RAISE NOTICE 'Ticket % capacity check: total=%, sold=%, requested=%, available=%',
    p_ticket_id, v_ticket.capacity_total, v_total_sold, v_requested_total, v_available;

  -- Check if there's enough capacity
  IF v_available < v_requested_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Only %s tickets available (requested %s)', 
        FLOOR(v_available::numeric / COALESCE(v_ticket.participants_per_ticket, 1)),
        p_requested_qty),
      'capacity_total', v_ticket.capacity_total,
      'sold', v_total_sold,
      'available', v_available,
      'requested', v_requested_total
    );
  END IF;

  -- If we get here, capacity is available
  RETURN jsonb_build_object(
    'success', true,
    'capacity_total', v_ticket.capacity_total,
    'sold', v_total_sold,
    'available', v_available,
    'requested', v_requested_total,
    'event_id', v_ticket.event_id
  );
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.check_and_reserve_ticket_capacity(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_reserve_ticket_capacity(uuid, integer, uuid) TO service_role;

COMMENT ON FUNCTION public.check_and_reserve_ticket_capacity IS 
'Atomically checks ticket availability and reserves capacity using row-level locking to prevent overselling';