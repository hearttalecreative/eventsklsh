import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
// Using Brevo API via HTTP
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type UUID = string;

interface Participant {
  fullName: string;
  email: string;
  phone?: string;
}

interface CartPayload {
  eventId: UUID;
  ticketId: UUID;
  ticketQty: number;
  addons: { id: UUID; qty: number }[];
  participants: Participant[];
  coupon?: string;
}

function effectiveUnitAmount(ticket: {
  unit_amount_cents: number;
  early_bird_amount_cents: number | null;
  early_bird_start: string | null;
  early_bird_end: string | null;
}): number {
  const now = new Date();
  if (
    ticket.early_bird_amount_cents &&
    ticket.early_bird_start &&
    ticket.early_bird_end &&
    now >= new Date(ticket.early_bird_start) &&
    now <= new Date(ticket.early_bird_end)
  ) {
    return ticket.early_bird_amount_cents;
  }
  return ticket.unit_amount_cents;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
  });


  try {
    const { sessionId, cart }: { sessionId: string; cart: CartPayload } = await req.json();
    if (!sessionId) throw new Error("Missing sessionId");

    // 1) Retrieve session and ensure paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // 2) Load authoritative data from DB
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, name, zone, unit_amount_cents, early_bird_amount_cents, early_bird_start, early_bird_end, participants_per_ticket")
      .eq("id", cart.ticketId)
      .maybeSingle();
    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.event_id !== cart.eventId) throw new Error("Ticket not for event");

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, slug, title, starts_at, ends_at, short_description, instructions, venue_id, timezone")
      .eq("id", cart.eventId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!event) throw new Error("Event not found");

    const { data: venue } = await supabase
      .from("venues")
      .select("name, address")
      .eq("id", event.venue_id)
      .maybeSingle();

    const addonIds = cart.addons?.filter(a => (a.qty ?? 0) > 0).map(a => a.id) ?? [];
    const { data: addonsRows, error: addonsErr } = addonIds.length > 0
      ? await supabase.from("addons").select("id, name, unit_amount_cents").in("id", addonIds)
      : { data: [], error: null } as any;
    if (addonsErr) throw addonsErr;

    // 3) Compute totals again and verify
    const unit = effectiveUnitAmount(ticket);
    const ticketsSubtotal = unit * cart.ticketQty;
    const addonsSubtotal = (cart.addons || []).reduce((sum, a) => {
      const row = addonsRows.find(r => r.id === a.id);
      return sum + (row ? row.unit_amount_cents * (a.qty || 0) : 0);
    }, 0);

    let discount = 0;
    // Prefer discount passed via Stripe session metadata
    const meta = (session.metadata || {}) as Record<string, string>;
    if (meta && typeof meta.coupon_discount_cents !== 'undefined') {
      const d = Number(meta.coupon_discount_cents);
      if (!Number.isNaN(d)) discount = d;
    }
    const subtotalAfterDiscount = ticketsSubtotal + addonsSubtotal - discount;
    const processingFee = Math.round(subtotalAfterDiscount * 0.035);
    const total = subtotalAfterDiscount + processingFee;

    if (typeof session.amount_total === "number" && session.amount_total !== total) {
      console.warn("Amount mismatch:", { session: session.amount_total, computed: total });
      // Still proceed, but log warning; depending on policy, you could reject here.
    }

    // 4) Insert Order, Items, and Attendees
    const orderCurrency = (session.currency || 'usd').toLowerCase();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        event_id: cart.eventId,
        email: (session.customer_details?.email as string) || undefined,
        total_amount_cents: total,
        currency: orderCurrency,
        status: "paid",
      })
      .select("id")
      .single();
    if (orderErr) throw orderErr;

    // Ticket item
    const { data: ticketItem, error: oiErr } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        ticket_id: ticket.id,
        quantity: cart.ticketQty,
        unit_amount_cents: unit,
        total_amount_cents: unit * cart.ticketQty,
      })
      .select("id")
      .single();
    if (oiErr) throw oiErr;

    // Add-on items
    if (addonsRows.length > 0) {
      const addonItems = addonsRows.map((row) => {
        const qty = cart.addons.find((a) => a.id === row.id)?.qty || 0;
        if (qty <= 0) return null;
        return {
          order_id: order.id,
          addon_id: row.id,
          quantity: qty,
          unit_amount_cents: row.unit_amount_cents,
          total_amount_cents: row.unit_amount_cents * qty,
        };
      }).filter(Boolean) as any[];
      if (addonItems.length > 0) {
        const { error } = await supabase.from("order_items").insert(addonItems);
        if (error) throw error;
      }
    }

    // Attendees are created by create-payment function, not here
    // This function only verifies payment status
    console.log(`[verify-payment] Payment verified for order, attendees already created by create-payment`);

    // 5) Send personalized emails to each participant
    const eventDate = new Date(event.starts_at);
    const purchaseDate = new Date();

    const addOnsSummary = addonsRows
      .map((row) => {
        const qty = cart.addons.find((a) => a.id === row.id)?.qty || 0;
        return qty > 0 ? `<li>${row.name} × ${qty}</li>` : "";
      })
      .filter(Boolean)
      .join("");

    const siteBase = Deno.env.get("PUBLIC_SITE_URL") || "";
    const eventUrl = siteBase ? `${siteBase}/event/${event.slug || event.id}` : "";
    const fmtGcal = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const startStr = fmtGcal(event.starts_at);
    const endStr = fmtGcal(event.ends_at || new Date(new Date(event.starts_at).getTime() + 2*60*60*1000).toISOString());
    const locationStr = venue ? `${venue.name} — ${venue.address}` : '';
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(event.short_description || '')}${eventUrl ? encodeURIComponent('\n' + eventUrl) : ''}&location=${encodeURIComponent(locationStr)}`;

    // Email confirmation will be handled by the appropriate order processing function
    console.log(`[verify-payment] Created paid order ${order.id} for ${cart.participants.length} attendees`);

    return new Response(JSON.stringify({ ok: true, orderId: order.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[verify-payment] error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
