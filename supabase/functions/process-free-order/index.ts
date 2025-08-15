import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { cart } = await req.json();
    console.log("[process-free-order] Processing cart:", cart);

    if (!cart || !cart.eventId) {
      throw new Error("Invalid cart data");
    }

    // 1) Fetch event and related data
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", cart.eventId)
      .single();
    if (eventErr) throw eventErr;

    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", cart.ticketId)
      .single();
    if (ticketErr) throw ticketErr;

    const { data: venue } = await supabase
      .from("venues")
      .select("*")
      .eq("id", event.venue_id)
      .maybeSingle();

    const { data: addons } = await supabase
      .from("addons")
      .select("*")
      .in("id", cart.addons.map((a: any) => a.id));

    // 2) Calculate processing fee (3% of original total before 100% discount)
    // For 100% discount events, we still track the processing fee in the order for transparency
    const unit = ticket.unit_amount_cents;
    const ticketsSubtotal = unit * (cart.ticketQty || 1);
    const addonsSubtotal = (cart.addons || []).reduce((sum: number, a: any) => {
      const addon = (addons || []).find((row: any) => row.id === a.id);
      return sum + (addon ? addon.unit_amount_cents * (a.qty || 0) : 0);
    }, 0);
    const originalTotal = ticketsSubtotal + addonsSubtotal;
    const processingFee = Math.round(originalTotal * 0.03);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        event_id: cart.eventId,
        user_id: null, // Free orders are typically guest orders
        email: cart.participants[0]?.email || "guest@example.com",
        status: "paid",
        currency: "usd",
        total_amount_cents: processingFee,
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    // 3) Create order items
    const { data: ticketItem, error: ticketItemError } = await supabase
      .from("order_items")
      .insert({
        order_id: order.id,
        ticket_id: cart.ticketId,
        quantity: cart.ticketQty || 1,
        unit_amount_cents: 0,
        total_amount_cents: 0,
      })
      .select("id")
      .single();
    if (ticketItemError) throw ticketItemError;

    // 4) Add addon items if any
    if (cart.addons?.length > 0) {
      const addonItems = cart.addons.map((a: any) => ({
        order_id: order.id,
        addon_id: a.id,
        quantity: a.qty || 1,
        unit_amount_cents: 0,
        total_amount_cents: 0,
      }));
      const { error } = await supabase.from("order_items").insert(addonItems);
      if (error) throw error;
    }

    // 5) Create attendees
    const attendees = cart.participants.map((p: any) => ({
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

    // 6) Send confirmation emails
    const eventDate = new Date(event.starts_at);
    const purchaseDate = new Date();

    const addOnsSummary = (addons || [])
      .map((row: any) => {
        const qty = cart.addons.find((a: any) => a.id === row.id)?.qty || 0;
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
      cart.participants.map(async (p: any, idx: number) => {
        const attendeeRow = insertedAttendees[idx];
        const confCode = attendeeRow?.confirmation_code || '';
        const displayName = attendeeRow?.name || p.fullName;
        const html = `
          <div style="background:#f6f7fb;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
              <!-- Header with Logo -->
              <div style="background:linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);padding:32px 24px;text-align:center;">
                <div style="background:#ffffff;width:120px;height:36px;margin:0 auto 16px auto;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                  <div style="width:20px;height:20px;background:linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);border-radius:4px;margin-right:8px;"></div>
                  <span style="font-weight:700;color:#1f2937;font-size:18px;">Events</span>
                </div>
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:700;">Thank you, ${displayName}!</h1>
                <p style="margin:12px 0 0 0;color:#e0e7ff;font-size:16px;">Your tickets have been confirmed</p>
              </div>
              
              <!-- Confirmation Code Highlight -->
              <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:20px 24px;text-align:center;">
                <p style="margin:0 0 8px 0;color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">Confirmation Code</p>
                <div style="background:#ffffff;border:2px solid #3b82f6;border-radius:8px;padding:12px 16px;display:inline-block;">
                  <span style="font-size:24px;font-weight:700;color:#1e293b;letter-spacing:2px;">${confCode}</span>
                </div>
                <p style="margin:8px 0 0 0;color:#64748b;font-size:13px;">Present this code at the event</p>
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
                  <div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;">
                    <p style="margin:0;color:#166534;font-weight:600;">🎉 FREE Event - No Payment Required</p>
                    <p style="margin:8px 0 0 0;color:#15803d;font-size:14px;">You received a 100% discount coupon!</p>
                  </div>
                  <ul style="margin:16px 0 0 18px;color:#374151;">
                    <li>${ticket.name} × ${cart.ticketQty} — $${(ticketsSubtotal/100).toFixed(2)}</li>
                    ${(addons || []).map((row: any) => {
                      const qty = cart.addons.find((a: any) => a.id === row.id)?.qty || 0;
                      return qty > 0 ? `<li>${row.name} × ${qty} — $${((row.unit_amount_cents * qty)/100).toFixed(2)}</li>` : ''
                    }).join('')}
                    <li><strong>Subtotal:</strong> $${(originalTotal/100).toFixed(2)}</li>
                    <li><strong>Discount (100%):</strong> -$${(originalTotal/100).toFixed(2)}</li>
                    <li>Processing Fee (3%) — $${(processingFee/100).toFixed(2)}</li>
                    <li><strong>Total:</strong> $${(processingFee/100).toFixed(2)}</li>
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
          console.error('[process-free-order email] failed for', p.email, e);
        }
      })
    );

    return new Response(JSON.stringify({ ok: true, orderId: order.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[process-free-order] error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});