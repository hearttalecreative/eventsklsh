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

    // If attendee was linked to an order_item, decrement quantity
    if (attendee.order_item_id && !attendee.is_comped) {
      // Get the order_item details
      const { data: orderItem, error: itemFetchError } = await supabase
        .from('order_items')
        .select('id, quantity, ticket_id, unit_amount_cents, total_amount_cents')
        .eq('id', attendee.order_item_id)
        .single();

      if (itemFetchError) {
        console.error('[delete-attendee] Error fetching order_item:', itemFetchError);
      } else if (orderItem) {
        // Get ticket info to know participants_per_ticket
        const { data: ticket } = await supabase
          .from('tickets')
          .select('participants_per_ticket')
          .eq('id', orderItem.ticket_id)
          .single();

        const participantsPerTicket = ticket?.participants_per_ticket || 1;
        const newQuantity = orderItem.quantity - (1 / participantsPerTicket);

        if (newQuantity > 0) {
          // Update the order_item with decremented quantity
          const newTotalAmount = Math.round(newQuantity * orderItem.unit_amount_cents);
          
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              quantity: newQuantity,
              total_amount_cents: newTotalAmount
            })
            .eq('id', attendee.order_item_id);

          if (updateError) {
            console.error('[delete-attendee] Error updating order_item:', updateError);
          } else {
            console.log(`[delete-attendee] Decremented order_item quantity to ${newQuantity}`);
            
            // Update the order total as well
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('total_amount_cents')
              .eq('order_id', (await supabase
                .from('order_items')
                .select('order_id')
                .eq('id', attendee.order_item_id)
                .single()).data?.order_id);

            if (orderItems) {
              const newOrderTotal = orderItems.reduce((sum, item) => sum + item.total_amount_cents, 0);
              
              const { error: orderUpdateError } = await supabase
                .from('orders')
                .update({ total_amount_cents: newOrderTotal })
                .eq('id', (await supabase
                  .from('order_items')
                  .select('order_id')
                  .eq('id', attendee.order_item_id)
                  .single()).data?.order_id);

              if (orderUpdateError) {
                console.error('[delete-attendee] Error updating order total:', orderUpdateError);
              }
            }
          }
        } else {
          // If quantity would be 0 or less, delete the order_item
          const { data: orderData } = await supabase
            .from('order_items')
            .select('order_id')
            .eq('id', attendee.order_item_id)
            .single();

          const { error: deleteItemError } = await supabase
            .from('order_items')
            .delete()
            .eq('id', attendee.order_item_id);

          if (deleteItemError) {
            console.error('[delete-attendee] Error deleting order_item:', deleteItemError);
          } else {
            console.log(`[delete-attendee] Deleted order_item as quantity reached 0`);
            
            // Check if order has any remaining items
            if (orderData?.order_id) {
              const { data: remainingItems } = await supabase
                .from('order_items')
                .select('id')
                .eq('order_id', orderData.order_id);

              if (!remainingItems || remainingItems.length === 0) {
                // Delete the order if no items remain
                await supabase
                  .from('orders')
                  .delete()
                  .eq('id', orderData.order_id);
                
                console.log(`[delete-attendee] Deleted empty order`);
              }
            }
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
