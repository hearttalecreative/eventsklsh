import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { attendeeId } = await req.json();
    
    if (!attendeeId) {
      throw new Error('Missing attendeeId');
    }

    // Create authenticated client to check admin access
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create service role client for privileged operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    console.log(`[delete-attendee] Deleting attendee: ${attendeeId}`);

    // Get attendee details first
    const { data: attendee, error: fetchError } = await supabase
      .from('attendees')
      .select('id, order_item_id, is_comped, comped_ticket_id')
      .eq('id', attendeeId)
      .single();

    if (fetchError || !attendee) {
      throw new Error('Attendee not found');
    }

    // Delete the attendee
    const { error: deleteError } = await supabase
      .from('attendees')
      .delete()
      .eq('id', attendeeId);

    if (deleteError) {
      console.error('[delete-attendee] Error deleting attendee:', deleteError);
      throw deleteError;
    }

    // If the attendee was part of a paid order, check if we should clean up or update the order_item
    if (attendee.order_item_id && !attendee.is_comped) {
      console.log(`[delete-attendee] Checking order_item ${attendee.order_item_id} for cleanup`);
      
      // Check if there are any remaining attendees for this order_item
      const { count: remainingAttendees } = await supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('order_item_id', attendee.order_item_id);

      console.log(`[delete-attendee] Remaining attendees for order_item: ${remainingAttendees || 0}`);

      const { data: orderItem } = await supabase
        .from('order_items')
        .select('*, ticket:ticket_id (participants_per_ticket)')
        .eq('id', attendee.order_item_id)
        .single();

      if (orderItem) {
        const parts = orderItem.ticket?.participants_per_ticket || 1;
        const newQuantity = Math.ceil((remainingAttendees || 0) / parts);

        if (!remainingAttendees || remainingAttendees === 0) {
          // No more attendees for this order_item, delete the item
          console.log(`[delete-attendee] Deleting empty order_item ${attendee.order_item_id}`);
          
          const { error: deleteItemError } = await supabase
            .from('order_items')
            .delete()
            .eq('id', attendee.order_item_id);

          if (deleteItemError) {
            console.error(`[delete-attendee] Error deleting order_item:`, deleteItemError);
          } else {
            // Check if the order has any remaining items
            const { data: remainingOrderItems } = await supabase
              .from('order_items')
              .select('id, total_amount_cents')
              .eq('order_id', orderItem.order_id);

            if (!remainingOrderItems || remainingOrderItems.length === 0) {
              // Delete the order if it has no more items
              console.log(`[delete-attendee] Deleting empty order ${orderItem.order_id}`);
              
              const { error: deleteOrderError } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderItem.order_id);

              if (deleteOrderError) {
                console.error(`[delete-attendee] Error deleting order:`, deleteOrderError);
              } else {
                console.log(`[delete-attendee] Successfully deleted empty order ${orderItem.order_id}`);
              }
            } else {
              // Recalculate order total amount since order_item was deleted
              const newOrderTotal = remainingOrderItems.reduce((sum, item) => sum + (item.total_amount_cents || 0), 0);
              await supabase
                .from('orders')
                .update({ total_amount_cents: newOrderTotal })
                .eq('id', orderItem.order_id);
            }
          }
        } else {
          // Order item still has attendees, but we should update its quantity to free up availability/revenue counts
          if (newQuantity < orderItem.quantity) {
             console.log(`[delete-attendee] Decrementing order_item quantity from ${orderItem.quantity} to ${newQuantity}`);
             
             // Base ticket unit price without addons
             const ticketUnitCents = orderItem.unit_amount_cents || 0;
             const newTotalCents = newQuantity * ticketUnitCents;

             await supabase
                .from('order_items')
                .update({ 
                  quantity: newQuantity, 
                  total_amount_cents: newTotalCents 
                })
                .eq('id', orderItem.id);

             // Update order's total_amount_cents as well
             const { data: allItems } = await supabase
                .from('order_items')
                .select('id, total_amount_cents')
                .eq('order_id', orderItem.order_id);
             
             if (allItems) {
                const newOrderTotal = allItems.reduce((sum, item) => sum + (item.total_amount_cents || 0), 0);
                await supabase
                  .from('orders')
                  .update({ total_amount_cents: newOrderTotal })
                  .eq('id', orderItem.order_id);
             }
          } else {
             console.log(`[delete-attendee] Order_item still has ${remainingAttendees} attendees (quantity stays ${orderItem.quantity})`);
          }
        }
      }
    }

    console.log(`[delete-attendee] Successfully deleted attendee: ${attendeeId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Attendee deleted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[delete-attendee] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
