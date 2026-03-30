DO $$ 
DECLARE
    item RECORD;
    new_qty INT;
    new_amount INT;
    remaining INT;
BEGIN
    -- For each ticket order_item (ignoring addons)
    FOR item IN (
        SELECT oi.id, oi.order_id, oi.quantity, oi.unit_amount_cents, oi.total_amount_cents, t.participants_per_ticket
        FROM public.order_items oi
        JOIN public.tickets t ON t.id = oi.ticket_id
    ) LOOP
        -- count remaining attendees for this order_item
        SELECT COUNT(*) INTO remaining
        FROM public.attendees
        WHERE order_item_id = item.id;
        
        -- calculate what the quantity should be based on remaining attendees
        new_qty := CEIL(remaining::numeric / COALESCE(item.participants_per_ticket, 1));
        
        IF new_qty < item.quantity THEN
            IF new_qty = 0 THEN
               -- Delete the item entirely if no attendees are left
               DELETE FROM public.order_items WHERE id = item.id;
            ELSE
               -- Decrement quantity to match actual seats
               new_amount := new_qty * item.unit_amount_cents;
               UPDATE public.order_items 
               SET quantity = new_qty, total_amount_cents = new_amount 
               WHERE id = item.id;
            END IF;
        END IF;
    END LOOP;

    -- Clean up any orders that are now empty
    DELETE FROM public.orders o
    WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);

    -- Recalculate everything else
    UPDATE public.orders o
    SET total_amount_cents = COALESCE((
        SELECT SUM(oi.total_amount_cents) 
        FROM public.order_items oi 
        WHERE oi.order_id = o.id
    ), 0);
END $$;
