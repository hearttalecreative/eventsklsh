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
      "accept": "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent: html,
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Brevo error ${resp.status}: ${text}`);
  }
  try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
}

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
    const total = ticketsSubtotal + addonsSubtotal - discount;

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

    // Attendees
    const attendees = cart.participants.map((p) => ({
      event_id: cart.eventId,
      order_item_id: ticketItem.id,
      name: p.fullName,
      email: p.email,
      zone: ticket.zone || null,
      seat: null,
    }));
    let insertedAttendees: { id: string; confirmation_code: string; name: string | null; email: string | null }[] = [];
    if (attendees.length > 0) {
      const { data: ins, error } = await supabase
        .from("attendees")
        .insert(attendees)
        .select("id, confirmation_code, name, email");
      if (error) throw error;
      insertedAttendees = ins || [];
    }

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

    await Promise.allSettled(
      cart.participants.map(async (p, idx) => {
        const currencyUpper = (session.currency || 'usd').toUpperCase();
        const attendeeRow = insertedAttendees[idx];
        const confCode = attendeeRow?.confirmation_code || '';
        const displayName = attendeeRow?.name || p.fullName;
        const html = `
          <div style="background:#f6f7fb;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
              <div style="padding:24px 24px 0 24px;text-align:center;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;">Thank you, ${displayName}!</h1>
                <p style="margin:8px 0 0 0;color:#6b7280;">Your tickets for <strong>${event.title}</strong> are confirmed.</p>
                <p style="margin:8px 0 0 0;color:#6b7280;">Confirmation code: <strong style="letter-spacing:0.5px;">${confCode}</strong></p>
              </div>
              <div style="padding:24px;">
                <h2 style="margin:0 0 8px 0;font-size:16px;color:#111827;">Event details</h2>
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:14px;color:#374151;">
                  <tr><td style="padding:4px 0;width:140px;color:#6b7280;">Title</td><td style="padding:4px 0;">${event.title}</td></tr>
                  <tr><td style="padding:4px 0;width:140px;color:#6b7280;">Date & time</td><td style="padding:4px 0;">${new Intl.DateTimeFormat('en-US',{ timeZone: event.timezone || 'America/Los_Angeles', dateStyle:'medium', timeStyle:'short'}).format(eventDate)}</td></tr>
                  ${venue ? `<tr><td style='padding:4px 0;width:140px;color:#6b7280;'>Location</td><td style='padding:4px 0;'>${venue.name} — ${venue.address}</td></tr>` : ''}
                  ${eventUrl ? `<tr><td style='padding:4px 0;width:140px;color:#6b7280;'>Event page</td><td style='padding:4px 0;'><a href='${eventUrl}' style='color:#2563eb;text-decoration:none;'>${eventUrl}</a></td></tr>` : ''}
                </table>
                ${event.short_description ? `<p style="margin:12px 0 0 0;color:#374151">${event.short_description}</p>` : ''}
                ${event.instructions ? `<p style="margin:8px 0 0 0;color:#374151"><strong>Instructions:</strong> ${event.instructions}</p>` : ''}
                <p style="margin:16px 0 0 0;">
                  <a href="${gcalUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#1a73e8;color:#ffffff;text-decoration:none;font-weight:600;">Add to Google Calendar</a>
                </p>
                ${addOnsSummary ? `<div style='margin-top:16px;'><h3 style='margin:0 0 6px 0;font-size:15px;color:#111827;'>Purchased add-ons</h3><ul style='margin:0 0 0 18px;color:#374151;'>${addOnsSummary}</ul></div>` : ''}
                <div style="margin-top:16px;">
                  <h2 style="margin:0 0 8px 0;font-size:16px;color:#111827;">Order summary</h2>
                  <ul style="margin:0 0 0 18px;color:#374151;">
                    <li>${ticket.name} × ${cart.ticketQty} — ${(unit/100).toLocaleString('en-US',{style:'currency',currency:currencyUpper})}</li>
                    ${addonsRows.map(row=>{
                      const qty = cart.addons.find(a=>a.id===row.id)?.qty || 0;
                      return qty>0 ? `<li>${row.name} × ${qty} — ${(row.unit_amount_cents/100).toLocaleString('en-US',{style:'currency',currency:currencyUpper})}</li>` : ''
                    }).join('')}
                    ${discount>0 ? `<li><strong>Discount:</strong> -${(discount/100).toLocaleString('en-US',{style:'currency',currency:currencyUpper})}</li>` : ''}
                    <li><strong>Total:</strong> ${(total/100).toLocaleString('en-US',{style:'currency',currency:currencyUpper})}</li>
                    <li><strong>Purchase date:</strong> ${purchaseDate.toLocaleString('en-US')}</li>
                  </ul>
                </div>
                <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">If you have any questions, just reply to this email.</p>
              </div>
            </div>
          </div>
        `;
        try {
          await sendBrevoEmail(p.email, displayName, `Order confirmation: ${event.title}`, html);
        } catch (e) {
          console.error('[verify-payment email] failed for', p.email, e);
        }
      })
    );

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
