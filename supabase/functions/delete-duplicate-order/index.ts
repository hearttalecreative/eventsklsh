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
    const { orderId } = await req.json();
    
    if (!orderId) {
      throw new Error('Missing orderId');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log(`[delete-duplicate-order] Deleting order: ${orderId}`);

    // Delete in correct order to respect foreign keys
    // 1. Delete attendees first
    const { error: attendeesError } = await supabase
      .from('attendees')
      .delete()
      .in('order_item_id', 
        supabase.from('order_items').select('id').eq('order_id', orderId)
      );
    
    if (attendeesError) {
      console.error('[delete-duplicate-order] Error deleting attendees:', attendeesError);
      throw attendeesError;
    }

    // 2. Delete order items
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
    
    if (itemsError) {
      console.error('[delete-duplicate-order] Error deleting order items:', itemsError);
      throw itemsError;
    }

    // 3. Delete the order
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);
    
    if (orderError) {
      console.error('[delete-duplicate-order] Error deleting order:', orderError);
      throw orderError;
    }

    console.log(`[delete-duplicate-order] Successfully deleted order: ${orderId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Order deleted successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[delete-duplicate-order] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
