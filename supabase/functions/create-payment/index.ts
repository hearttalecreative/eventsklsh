import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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

interface CreatePaymentRequest {
  currency?: string;
  buyer: { name: string; email: string };
  cart: CartPayload;
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

  try {
    const { buyer, cart, currency }: CreatePaymentRequest = await req.json();
    const curr = (currency || 'mxn').toLowerCase();
    if (!buyer?.email || !buyer?.name) throw new Error("Missing buyer info");
    if (!cart?.eventId || !cart?.ticketId || !cart?.ticketQty || cart.ticketQty < 1)
      throw new Error("Invalid cart");

    // 1) Load event + ticket + addons from DB to compute authoritative totals
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, name, zone, unit_amount_cents, early_bird_amount_cents, early_bird_start, early_bird_end, participants_per_ticket")
      .eq("id", cart.ticketId)
      .maybeSingle();
    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.event_id !== cart.eventId) throw new Error("Ticket does not belong to event");

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, title, status, starts_at")
      .eq("id", cart.eventId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!event) throw new Error("Event not found");
    if (event.status !== "published") throw new Error("Event not available");

    const addonIds = cart.addons?.filter(a => (a.qty ?? 0) > 0).map(a => a.id) ?? [];
    const { data: addonsRows, error: addonsErr } = addonIds.length > 0
      ? await supabase.from("addons").select("id, event_id, name, unit_amount_cents").in("id", addonIds)
      : { data: [], error: null } as any;
    if (addonsErr) throw addonsErr;
    for (const a of addonsRows) {
      if (a.event_id !== cart.eventId) throw new Error("Add-on does not belong to event");
    }

    // 2) Compute pricing
    const unit = effectiveUnitAmount(ticket);
    const ticketsSubtotal = unit * cart.ticketQty;
    const addonsSubtotal = (cart.addons || []).reduce((sum, a) => {
      const row = addonsRows.find(r => r.id === a.id);
      return sum + (row ? row.unit_amount_cents * (a.qty || 0) : 0);
    }, 0);

    let discount = 0;
    if (cart.coupon) {
      // Simple validation: match event.coupon_code then apply 50% off tickets as in UI
      const { data: ev2 } = await supabase.from("events").select("coupon_code").eq("id", cart.eventId).maybeSingle();
      if (ev2?.coupon_code && ev2.coupon_code.trim().toLowerCase() === cart.coupon.trim().toLowerCase()) {
        discount = Math.round(ticketsSubtotal * 0.5);
      }
    }

    const total = ticketsSubtotal + addonsSubtotal - discount;
    if (total <= 0) throw new Error("Invalid total amount");

    // Validate participants count
    const expectedParticipants = (ticket.participants_per_ticket || 1) * cart.ticketQty;
    if (!Array.isArray(cart.participants) || cart.participants.length !== expectedParticipants) {
      throw new Error("Participants count mismatch");
    }

    // 3) Build Stripe Checkout Session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Adjust ticket unit for discount on tickets only
    const effectiveTicketUnit = discount > 0
      ? Math.max(0, Math.floor((ticketsSubtotal - discount) / cart.ticketQty))
      : unit;

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: cart.ticketQty,
        price_data: {
          currency: curr,
          product_data: { name: `${event.title} — ${ticket.name}` },
          unit_amount: effectiveTicketUnit,
        },
      },
      ...addonsRows.map((row) => {
        const qty = cart.addons.find((a) => a.id === row.id)?.qty || 0;
        return {
          quantity: qty,
          price_data: {
            currency: curr,
            product_data: { name: `${row.name} (Add-on)` },
            unit_amount: row.unit_amount_cents,
          },
        } as Stripe.Checkout.SessionCreateParams.LineItem;
      }).filter((li) => (li.quantity || 0) > 0),
    ];

    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      customer_email: buyer.email,
      line_items,
      mode: "payment",
      currency: curr,
      success_url: `${origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelar`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[create-payment] error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
