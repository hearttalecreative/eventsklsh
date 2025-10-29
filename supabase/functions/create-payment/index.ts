import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateCart, validateEmail } from "../_shared/validation.ts";

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

  // Brevo email helper
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
  async function sendBrevoEmail(toEmail: string, toName: string, subject: string, html: string) {
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "no-reply@example.com";
    const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Notifications";
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent: html,
      }),
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`Brevo error ${resp.status}: ${text}`);
    try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
  }

  try {
    let payload;
    try {
      payload = await req.json();
    } catch (parseErr: any) {
      console.error("[create-payment] JSON parse error:", parseErr);
      throw new Error("Invalid request format");
    }

    // Validate payload structure
    if (!payload || typeof payload !== 'object') {
      throw new Error("Invalid request payload");
    }
    if (!payload.cart) {
      throw new Error("Cart is required");
    }
    if (!payload.buyer) {
      throw new Error("Buyer information is required");
    }
    
    // Validate and sanitize inputs
    let validatedCart;
    try {
      validatedCart = validateCart(payload.cart);
    } catch (validationErr: any) {
      console.error("[create-payment] Cart validation error:", validationErr);
      throw new Error(`Cart validation failed: ${validationErr.message}`);
    }

    const buyerEmail = validateEmail(payload.buyer?.email);
    const buyerName = payload.buyer?.name?.trim() || '';
    if (!buyerName) throw new Error("Buyer name is required");
    
    const curr = 'usd';
    
    // Reconstruct validated objects
    const cart = validatedCart;
    const buyer = { email: buyerEmail, name: buyerName };

    // Log checkout initiation (before any payment processing)
    const firstParticipant = cart.participants?.[0];
    const nameParts = buyer.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 1) Load event + ticket + addons from DB to compute authoritative totals
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, event_id, name, zone, unit_amount_cents, early_bird_amount_cents, early_bird_start, early_bird_end, participants_per_ticket, capacity_total")
      .eq("id", cart.ticketId)
      .maybeSingle();
    if (ticketErr) throw ticketErr;
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.event_id !== cart.eventId) throw new Error("Ticket does not belong to event");

    // Check ticket availability
    const { data: paidOrders } = await supabase
      .from("order_items")
      .select("quantity, orders!inner(status)")
      .eq("ticket_id", cart.ticketId)
      .eq("orders.status", "paid");

    const soldFromOrders = (paidOrders || []).reduce((sum: number, item: any) => {
      return sum + (item.quantity * (ticket.participants_per_ticket || 1));
    }, 0);

    const { count: compedCount } = await supabase
      .from("attendees")
      .select("id", { count: "exact", head: true })
      .eq("comped_ticket_id", cart.ticketId)
      .eq("is_comped", true);

    const totalSold = soldFromOrders + (compedCount || 0);
    const requestedTotal = cart.ticketQty * (ticket.participants_per_ticket || 1);
    const available = ticket.capacity_total - totalSold;

    console.log(`[create-payment] Ticket availability check: capacity=${ticket.capacity_total}, sold=${totalSold}, requested=${requestedTotal}, available=${available}`);

    if (available < requestedTotal) {
      throw new Error(`Only ${Math.floor(available / (ticket.participants_per_ticket || 1))} tickets available. This ticket is sold out or has limited capacity.`);
    }

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, title, status, starts_at")
      .eq("id", cart.eventId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!event) throw new Error("Event not found");
    if (event.status !== "published") {
      if (event.status === "sold_out") throw new Error("This event is sold out");
      if (event.status === "paused") throw new Error("Ticket sales are temporarily paused");
      throw new Error("Event not available");
    }

    const addonIds = cart.addons?.filter(a => (a.qty ?? 0) > 0).map(a => a.id) ?? [];
    const { data: addonsRows, error: addonsErr } = addonIds.length > 0
      ? await supabase.from("addons").select("id, event_id, name, unit_amount_cents").in("id", addonIds)
      : { data: [], error: null };
    
    console.log('[create-payment] Debug - addonsRows:', addonsRows, 'addonIds:', addonIds);
    if (addonsErr) throw addonsErr;
    if (addonsRows) {
      for (const a of addonsRows) {
        if (a.event_id !== cart.eventId) throw new Error("Add-on does not belong to event");
      }
    }

    // 2) Compute pricing
    const unit = effectiveUnitAmount(ticket);
    const ticketsSubtotal = unit * cart.ticketQty;
    const addonsSubtotal = (cart.addons || []).reduce((sum, a) => {
      const row = (addonsRows || []).find((r: any) => r.id === a.id);
      return sum + (row ? row.unit_amount_cents * (a.qty || 0) : 0);
    }, 0);

    // 2.1) Validate coupon (event-specific preferred over global)
    type Coupon = {
      id: string;
      code: string;
      discount_percent: number | null;
      discount_amount_cents: number | null;
      apply_to: 'tickets' | 'addons' | 'both';
      event_id: string | null;
      starts_at: string | null;
      ends_at: string | null;
      max_redemptions: number | null;
      active: boolean;
    };

    let chosen: Coupon | null = null;
    if (cart.coupon && cart.coupon.trim()) {
      const codeUpper = cart.coupon.trim().toUpperCase();
      const { data: coupons, error: coupErr } = await supabase
        .from('coupons')
        .select('id, code, discount_percent, discount_amount_cents, apply_to, event_id, starts_at, ends_at, max_redemptions, active')
        .or(`event_id.eq.${cart.eventId},event_id.is.null`)
        .ilike('code', codeUpper)
        .eq('active', true)
        .order('event_id', { ascending: false, nullsFirst: false });
      if (coupErr) throw coupErr;
      const now = new Date();
      let candidate = (coupons || []).find(c => c.event_id === cart.eventId) || (coupons || []).find(c => c.event_id === null);
      if (candidate) {
        if (candidate.starts_at && new Date(candidate.starts_at) > now) candidate = null as any;
        if (candidate && candidate.ends_at && new Date(candidate.ends_at) < now) candidate = null as any;
        if (candidate && candidate.max_redemptions != null) {
          const { count, error: cntErr } = await supabase
            .from('coupon_redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', candidate.id);
          if (cntErr) throw cntErr;
          if ((count ?? 0) >= candidate.max_redemptions) candidate = null as any;
        }
      }
      chosen = candidate || null;
    }

    // 2.2) Calculate discount amount (in cents)
    const subtotalBeforeDiscount = ticketsSubtotal + addonsSubtotal;
    const pct = chosen?.discount_percent ?? null;
    const amt = chosen?.discount_amount_cents ?? null;

    let discount = 0;
    if (chosen) {
      const scope = chosen.apply_to;
      const baseTickets = ticketsSubtotal;
      const baseAddons = addonsSubtotal;
      const baseBoth = baseTickets + baseAddons;
      if (pct != null) {
        if (scope === 'tickets') discount = Math.floor(baseTickets * (pct / 100));
        else if (scope === 'addons') discount = Math.floor(baseAddons * (pct / 100));
        else discount = Math.floor(baseBoth * (pct / 100));
      } else if (amt != null) {
        if (scope === 'tickets') discount = Math.min(amt, baseTickets);
        else if (scope === 'addons') discount = Math.min(amt, baseAddons);
        else discount = Math.min(amt, baseBoth);
      }
    }

    const subtotalAfterDiscount = subtotalBeforeDiscount - discount;
    const processingFee = Math.round(subtotalAfterDiscount * 0.035);
    let total = subtotalAfterDiscount + processingFee;

    // Validate participants count
    const expectedParticipants = (ticket.participants_per_ticket || 1) * cart.ticketQty;
    if (!Array.isArray(cart.participants) || cart.participants.length !== expectedParticipants) {
      throw new Error('Participants count mismatch');
    }

    // Log anonymized checkout metrics (no PII)
    try {
      await supabase.from('checkout_logs').insert({
        total_amount_cents: total,
        event_id: cart.eventId,
        event_title: event.title
      });
      console.log(`[create-payment] Logged checkout attempt for event ${event.title}, total: ${total}`);
    } catch (logErr) {
      console.error('[create-payment] Failed to log checkout:', logErr);
      // Continue with payment creation even if logging fails
    }

    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'http://localhost:5173';

    // 2.3) Bypass Stripe if total <= 0 (free order)
    if (total <= 0) {
      // Create order directly
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          event_id: cart.eventId,
          email: buyer.email,
          total_amount_cents: processingFee,
          currency: 'usd',
          status: 'paid',
        })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      // Ticket item
      const { data: ticketItem, error: oiErr } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          ticket_id: ticket.id,
          quantity: cart.ticketQty,
          unit_amount_cents: unit,
          total_amount_cents: unit * cart.ticketQty,
        })
        .select('id')
        .single();
      if (oiErr) throw oiErr;

      // Add-on items
      if (addonsRows && addonsRows.length > 0) {
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
          const { error } = await supabase.from('order_items').insert(addonItems);
          if (error) throw error;
        }
      }

      // Don't create attendees here for free orders - process-free-order handles them
      // Just record the coupon redemption if applicable
      if (chosen) {
        const { error } = await supabase.from('coupon_redemptions').insert({
          coupon_id: chosen.id,
          order_id: order.id,
          event_id: cart.eventId,
          user_id: null,
          amount_discount_cents: discount,
          email: buyer.email,
        });
        if (error) throw error;
      }

      console.log(`[create-payment] Created free order ${order.id} - attendees will be created by process-free-order`);

      return new Response(JSON.stringify({ url: `${origin}/checkout/success?free=1` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 3) Build Stripe Checkout Session
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Base line items (before discounts)
    let line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: cart.ticketQty,
        price_data: {
          currency: curr,
          product_data: { name: `${event.title} — ${ticket.name}` },
          unit_amount: unit,
        },
      },
      ...(addonsRows || []).map((row: any) => {
        const qty = cart.addons.find((a) => a.id === row.id)?.qty || 0;
        return {
          quantity: qty,
          price_data: {
            currency: curr,
            product_data: { name: `${row.name} (Add-on)` },
            unit_amount: row.unit_amount_cents,
          },
        } as Stripe.Checkout.SessionCreateParams.LineItem;
      }).filter((li: any) => (li.quantity || 0) > 0),
      // Add processing fee as separate line item
      {
        quantity: 1,
        price_data: {
          currency: curr,
          product_data: { name: 'Processing Fee (3.5%)' },
          unit_amount: processingFee,
        },
      },
    ];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer_email: buyer.email,
      line_items,
      mode: 'payment',
      currency: curr,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: {
        ...(chosen ? {
          coupon_id: chosen.id,
          coupon_code: chosen.code,
          coupon_apply_to: chosen.apply_to,
          coupon_discount_cents: String(discount),
        } : {}),
        // Include cart data so webhook can process the order
        cart_data: JSON.stringify(cart),
      },
      // Disable automatic emails from Stripe since we handle them ourselves
      automatic_tax: { enabled: false },
      invoice_creation: { enabled: false },
    };

    // Apply discounts either by adjusting items or via Stripe coupon (for 'both')
    if (chosen) {
      const scope = chosen.apply_to;
      if (chosen.discount_percent != null || scope === 'both') {
        // For 'both' we can safely use a Stripe coupon to apply across all items
        if (scope === 'both') {
          if (discount > 0) {
            if (chosen.discount_percent != null) {
              const stripeCoupon = await stripe.coupons.create({
                percent_off: chosen.discount_percent,
                duration: 'once',
              });
              (sessionParams as any).discounts = [{ coupon: stripeCoupon.id }];
            } else if (chosen.discount_amount_cents != null) {
              const stripeCoupon = await stripe.coupons.create({
                amount_off: discount,
                currency: curr,
                duration: 'once',
              });
              (sessionParams as any).discounts = [{ coupon: stripeCoupon.id }];
            }
          }
        } else if (scope === 'tickets') {
          // Adjust ticket unit when scope is tickets
          const discountedUnit = Math.max(0, Math.floor(
            chosen.discount_percent != null
              ? unit * (1 - chosen.discount_percent / 100)
              : unit - Math.min(chosen.discount_amount_cents || 0, unit)
          ));
          sessionParams.line_items![0].price_data!.unit_amount = discountedUnit;
        } else if (scope === 'addons') {
          // Adjust each addon line
          sessionParams.line_items = sessionParams.line_items!.map((li: any, idx: number) => {
            if (idx === 0) return li; // ticket line
            const unitAmt = li.price_data!.unit_amount as number;
            const newUnit = Math.max(0, Math.floor(
              chosen.discount_percent != null
                ? unitAmt * (1 - chosen.discount_percent / 100)
                : unitAmt - Math.min(chosen.discount_amount_cents || 0, unitAmt)
            ));
            return { ...li, price_data: { ...li.price_data!, unit_amount: newUnit } };
          });
        }
      } else if (chosen.discount_amount_cents != null) {
        // Amount-only discounts: handle like above
        if (chosen.apply_to === 'tickets') {
          const discountedUnit = Math.max(0, Math.floor(unit - Math.min(chosen.discount_amount_cents, unit)));
          sessionParams.line_items![0].price_data!.unit_amount = discountedUnit;
        } else if (chosen.apply_to === 'addons') {
          sessionParams.line_items = sessionParams.line_items!.map((li: any, idx: number) => {
            if (idx === 0) return li;
            const unitAmt = li.price_data!.unit_amount as number;
            const newUnit = Math.max(0, Math.floor(unitAmt - Math.min(chosen!.discount_amount_cents!, unitAmt)));
            return { ...li, price_data: { ...li.price_data!, unit_amount: newUnit } };
          });
        } else {
          const stripeCoupon = await stripe.coupons.create({ amount_off: discount, currency: curr, duration: 'once' });
          (sessionParams as any).discounts = [{ coupon: stripeCoupon.id }];
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || '';
    
    console.error("[create-payment] ERROR:", {
      message: errorMessage,
      stack: errorStack,
      name: error?.name,
      type: typeof error,
    });
    
    // Return user-friendly error message
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.name || 'PaymentError'
      }), 
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
