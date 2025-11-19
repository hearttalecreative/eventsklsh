import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { ticketId, requestedQty } = await req.json();

    if (!ticketId || !requestedQty || requestedQty < 1) {
      throw new Error("Invalid request: ticketId and requestedQty required");
    }

    // Fetch ticket info
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, capacity_total, participants_per_ticket")
      .eq("id", ticketId)
      .single();

    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");

    // Count actual attendees from paid orders instead of using order_item quantities
    // This ensures accurate counting when individual attendees are deleted
    const { data: paidOrderItems } = await supabase
      .from("order_items")
      .select("id, orders!inner(status)")
      .eq("ticket_id", ticketId)
      .eq("orders.status", "paid");

    const orderItemIds = (paidOrderItems || []).map(item => item.id);
    
    let paidAttendeesCount = 0;
    if (orderItemIds.length > 0) {
      const { count } = await supabase
        .from("attendees")
        .select("id", { count: "exact", head: true })
        .in("order_item_id", orderItemIds);
      
      paidAttendeesCount = count || 0;
    }

    // Count comped attendees for this specific ticket
    const { count: compedCount } = await supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .eq("comped_ticket_id", ticketId)
      .eq("is_comped", true);

    const totalSold = paidAttendeesCount + (compedCount || 0);
    const available = ticket.capacity_total - totalSold;
    const requestedTotal = requestedQty * (ticket.participants_per_ticket || 1);

    console.log(`[check-ticket-availability] Ticket ${ticketId}: capacity=${ticket.capacity_total}, sold=${totalSold}, available=${available}, requested=${requestedTotal}`);

    return new Response(JSON.stringify({
      available: available >= requestedTotal,
      capacityTotal: ticket.capacity_total,
      sold: totalSold,
      remaining: Math.max(0, available),
      requestedQty,
      participantsPerTicket: ticket.participants_per_ticket || 1
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[check-ticket-availability] error:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || String(error),
      available: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
