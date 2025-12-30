-- Fix check_and_reserve_ticket_capacity to use consistent UNIT-based calculations
-- capacity_total represents purchasable UNITS, not attendees
-- Example: 4-pack with capacity_total=10 means 10 purchasable units (40 attendees max)

CREATE OR REPLACE FUNCTION public.check_and_reserve_ticket_capacity(p_ticket_id uuid, p_requested_qty integer, p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_sold_units_from_orders integer;
  v_comped_attendees integer;
  v_comped_units integer;
  v_total_sold_units integer;
  v_available_units integer;
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

  -- Calculate currently sold UNITS (not attendees)
  -- order_items.quantity represents units purchased
  SELECT COALESCE(SUM(oi.quantity), 0)::integer
  INTO v_sold_units_from_orders
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.ticket_id = p_ticket_id
    AND o.status = 'paid'
    AND o.id != p_order_id;  -- Exclude current order if checking again

  -- Count comped ATTENDEES and convert to UNITS
  SELECT COUNT(*)::integer
  INTO v_comped_attendees
  FROM public.attendees
  WHERE comped_ticket_id = p_ticket_id
    AND is_comped = true;

  -- Convert comped attendees to units (round up to be conservative)
  v_comped_units := CEIL(v_comped_attendees::numeric / COALESCE(v_ticket.participants_per_ticket, 1));
  
  -- Total sold units
  v_total_sold_units := v_sold_units_from_orders + v_comped_units;
  
  -- Available units (capacity_total is in units)
  v_available_units := v_ticket.capacity_total - v_total_sold_units;

  -- Log for debugging
  RAISE NOTICE 'Ticket % capacity check: capacity=% units, sold_from_orders=% units, comped=% attendees (% units), total_sold=% units, requested=% units, available=% units',
    p_ticket_id, v_ticket.capacity_total, v_sold_units_from_orders, v_comped_attendees, v_comped_units, v_total_sold_units, p_requested_qty, v_available_units;

  -- Check if there's enough capacity (compare units to units)
  IF v_available_units < p_requested_qty THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Only %s tickets available (requested %s)', v_available_units, p_requested_qty),
      'capacity_total', v_ticket.capacity_total,
      'sold', v_total_sold_units,
      'available', v_available_units,
      'requested', p_requested_qty
    );
  END IF;

  -- If we get here, capacity is available
  RETURN jsonb_build_object(
    'success', true,
    'capacity_total', v_ticket.capacity_total,
    'sold', v_total_sold_units,
    'available', v_available_units,
    'requested', p_requested_qty,
    'event_id', v_ticket.event_id
  );
END;
$function$;