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

    // Fetch ticket info including sale window columns
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, capacity_total, participants_per_ticket, sale_start_at, sale_end_at")
      .eq("id", ticketId)
      .single();

    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");

    // ── Sale window check ──────────────────────────────────────────────────
    const now = new Date();
    if (ticket.sale_start_at && now < new Date(ticket.sale_start_at)) {
      console.log(`[check-ticket-availability] Ticket ${ticketId} sale has not started yet (starts ${ticket.sale_start_at})`);
      return new Response(JSON.stringify({
        available: false,
        remaining: 0,
        requestedQty,
        reason: "sale_not_started",
        message: "Ticket sales have not started yet.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (ticket.sale_end_at && now > new Date(ticket.sale_end_at)) {
      console.log(`[check-ticket-availability] Ticket ${ticketId} sale has ended (ended ${ticket.sale_end_at})`);
      return new Response(JSON.stringify({
        available: false,
        remaining: 0,
        requestedQty,
        reason: "sale_ended",
        message: "Ticket sales for this ticket type have ended.",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    // Count sold UNITS from paid orders (capacity_total is in units, not attendees)
    const { data: paidOrders } = await supabase
      .from("order_items")
      .select("quantity, orders!inner(status)")
      .eq("ticket_id", ticketId)
      .eq("orders.status", "paid");

    const soldUnitsFromOrders = (paidOrders || []).reduce((sum: number, item: any) => {
      return sum + item.quantity;
    }, 0);

    // Count comped attendees and convert to units
    const { count: compedCount } = await supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .eq("comped_ticket_id", ticketId)
      .eq("is_comped", true);

    const compedUnits = Math.ceil((compedCount || 0) / (ticket.participants_per_ticket || 1));
    const totalSoldUnits = soldUnitsFromOrders + compedUnits;
    const availableUnits = ticket.capacity_total - totalSoldUnits;

    console.log(`[check-ticket-availability] Ticket ${ticketId}: capacity=${ticket.capacity_total} units, sold=${totalSoldUnits} units, available=${availableUnits} units, requested=${requestedQty} units`);

    return new Response(JSON.stringify({
      available: availableUnits >= requestedQty,
      capacityTotal: ticket.capacity_total,
      sold: totalSoldUnits,
      remaining: Math.max(0, availableUnits),
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

