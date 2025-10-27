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

    // 1) Retrieve session and ensure paid or processing (for Klarna)
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log(`[verify-payment] Session ${sessionId} has payment_status: ${session.payment_status}, payment_method_types: ${session.payment_method_types?.join(', ')}`);
    
    // Accept both 'paid' and 'processing' status (Klarna uses 'processing')
    if (session.payment_status !== "paid" && session.payment_status !== "processing") {
      throw new Error(`Payment not completed. Status: ${session.payment_status}`);
    }
    
    // For processing payments, verify it's a valid payment method like Klarna
    if (session.payment_status === "processing") {
      const validProcessingMethods = ['klarna', 'affirm', 'afterpay_clearpay'];
      const hasValidMethod = session.payment_method_types?.some(method => 
        validProcessingMethods.includes(method)
      );
      
      if (!hasValidMethod) {
        throw new Error(`Payment is processing but payment method not recognized: ${session.payment_method_types?.join(', ')}`);
      }
      
      console.log(`[verify-payment] Accepting processing payment for method: ${session.payment_method_types?.join(', ')}`);
    }

    // Idempotency: if an order already exists for this Stripe session, return early
    const { data: existingBySession } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    if (existingBySession) {
      console.log(`[verify-payment] Order already exists for session ${sessionId}: ${existingBySession.id}`);
      return new Response(JSON.stringify({ ok: true, orderId: existingBySession.id }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2) Load authoritative data from DB
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, name, zone, unit_amount_cents, early_bird_amount_cents, early_bird_start, early_bird_end, participants_per_ticket, capacity_total")
      .eq("id", cart.ticketId)
      .maybeSingle();
    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.event_id !== cart.eventId) throw new Error("Ticket not for event");

    // Use atomic capacity check with row-level locking to prevent race conditions
    const { data: capacityCheck, error: capacityErr } = await supabase
      .rpc('check_and_reserve_ticket_capacity', {
        p_ticket_id: cart.ticketId,
        p_requested_qty: cart.ticketQty,
        p_order_id: '00000000-0000-0000-0000-000000000000' // Temporary placeholder for new order
      });

    if (capacityErr) {
      console.error(`[verify-payment] Capacity check failed:`, capacityErr);
      throw new Error(`Failed to verify ticket availability: ${capacityErr.message}`);
    }

    if (!capacityCheck?.success) {
      console.log(`[verify-payment] Insufficient capacity: ${capacityCheck?.error}`);
      throw new Error(capacityCheck?.error || 'Ticket sold out or insufficient capacity');
    }

    console.log(`[verify-payment] Capacity reserved: capacity=${capacityCheck.capacity_total}, sold=${capacityCheck.sold}, requested=${capacityCheck.requested}, available=${capacityCheck.available}`);

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, slug, title, starts_at, ends_at, short_description, instructions, venue_id, timezone, image_url, status")
      .eq("id", cart.eventId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!event) throw new Error("Event not found");
    if ((event as any).status !== "published") {
      if ((event as any).status === "sold_out") throw new Error("This event is sold out");
      if ((event as any).status === "paused") throw new Error("Ticket sales are temporarily paused");
      throw new Error("Event not available for purchase");
    }

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
      const row = addonsRows.find((r: any) => r.id === a.id);
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

    // Validate participants count matches ticket configuration
    const expectedParticipants = (ticket.participants_per_ticket || 1) * cart.ticketQty;
    if (!Array.isArray(cart.participants) || cart.participants.length !== expectedParticipants) {
      const errorMsg = `Participants count mismatch: expected ${expectedParticipants} (${cart.ticketQty} tickets × ${ticket.participants_per_ticket || 1} participants each), got ${cart.participants?.length || 0}`;
      console.error(`[verify-payment] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (typeof session.amount_total === "number" && session.amount_total !== total) {
      console.warn("Amount mismatch:", { session: session.amount_total, computed: total });
      // Still proceed, but log warning; depending on policy, you could reject here.
    }

    // 4) Insert Order, Items, and Attendees
    const orderCurrency = (session.currency || 'usd').toLowerCase();
    // Insert order (idempotency already checked at line 91-102)
    const { data: createdOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        event_id: cart.eventId,
        email: (session.customer_details?.email as string) || undefined,
        total_amount_cents: total,
        currency: orderCurrency,
        status: "paid",
        stripe_session_id: sessionId,
      })
      .select("id")
      .single();
    
    // If duplicate key error, fetch existing order
    if (orderErr) {
      if (orderErr.code === '23505') { // Unique violation
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_session_id', sessionId)
          .single();
        if (existingOrder) {
          console.log(`[verify-payment] Order already exists for session ${sessionId}: ${existingOrder.id}`);
          return new Response(JSON.stringify({ ok: true, orderId: existingOrder.id }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }
      throw orderErr;
    }
    const order = createdOrder;

    // If order_items already exist (duplicate call), skip further processing
    const { data: existingItems, error: itemsSelErr } = await supabase
      .from("order_items")
      .select("id")
      .eq("order_id", order.id);
    if (itemsSelErr) throw itemsSelErr;
    if (existingItems && existingItems.length > 0) {
      console.log(`[verify-payment] Order items already exist for ${order.id}, skipping duplicate processing`);
      return new Response(JSON.stringify({ ok: true, orderId: order.id }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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
      const addonItems = addonsRows.map((row: any) => {
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

    // Create attendees for paid orders
    const attendees = cart.participants.map((p) => ({
      event_id: cart.eventId,
      order_item_id: ticketItem.id,
      name: p.fullName,
      email: p.email,
      phone: p.phone || null,
      zone: ticket.zone || null,
      seat: null,
    }));
    
    const { data: insertedAttendees, error: attendeesErr } = await supabase
      .from('attendees')
      .insert(attendees)
      .select('id, confirmation_code, qr_code, name, email, phone');
    if (attendeesErr) throw attendeesErr;

    // Record coupon redemption if applicable
    if (meta.coupon_id) {
      const { error: redemptionErr } = await supabase.from('coupon_redemptions').insert({
        coupon_id: meta.coupon_id,
        order_id: order.id,
        event_id: cart.eventId,
        user_id: null,
        amount_discount_cents: discount,
        email: session.customer_details?.email || cart.participants[0]?.email,
      });
      if (redemptionErr) console.error('Failed to record coupon redemption:', redemptionErr);
    }

    // Send confirmation emails
    await Promise.allSettled(
      cart.participants.map(async (p: any, index: number) => {
        try {
          const attendee = insertedAttendees[index];
          
          await supabase.functions.invoke('send-confirmation', {
            body: {
              name: p.fullName || 'Guest',
              email: p.email,
              phone: p.phone,
              eventTitle: event.title,
              eventDescription: event.short_description,
              eventDate: event.starts_at,
              eventVenue: venue ? `${venue.name}${venue.address ? ` — ${venue.address}` : ''}` : 'Location TBD',
              instructions: event.instructions,
              confirmationCode: attendee?.confirmation_code,
              eventImageUrl: event.image_url,
              eventSlug: event.slug,
              qrCode: attendee?.qr_code,
              orderDetails: {
                orderId: order.id,
                totalAmount: total,
                currency: orderCurrency,
                tickets: [{
                  name: ticket.name,
                  quantity: cart.ticketQty || 1,
                  unitPrice: ticket.unit_amount_cents
                }],
                addons: (cart.addons || []).filter((a: any) => (a.qty || 0) > 0).map((a: any) => {
                  const addon = addonsRows.find((row: any) => row.id === a.id);
                  return {
                    name: addon?.name || 'Add-on',
                    quantity: a.qty,
                    unitPrice: addon?.unit_amount_cents || 0
                  };
                }),
                discountInfo: discount > 0 ? {
                  couponCode: meta.coupon_code || 'Discount Applied',
                  discountAmount: discount,
                  originalAmount: ticketsSubtotal + addonsSubtotal,
                  finalAmount: subtotalAfterDiscount
                } : null
              }
            }
          });
        } catch (e) {
          console.error('[verify-payment send-confirmation] failed for', p.email, e);
        }
      })
    );

    console.log(`[verify-payment] Created paid order ${order.id} for ${cart.participants.length} attendees`);

    // 5) Send personalized emails to each participant
    const eventDate = new Date(event.starts_at);
    const purchaseDate = new Date();

    const addOnsSummary = addonsRows
      .map((row: any) => {
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
