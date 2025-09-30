import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


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
    if (event.status !== "published") throw new Error("Event not available for purchase");

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

    // 2) Calculate processing fee (3.5% of original total before 100% discount)
    // For 100% discount events, we still track the processing fee in the order for transparency
    const unit = ticket.unit_amount_cents;
    const ticketsSubtotal = unit * (cart.ticketQty || 1);
    const addonsSubtotal = (cart.addons || []).reduce((sum: number, a: any) => {
      const addon = (addons || []).find((row: any) => row.id === a.id);
      return sum + (addon ? addon.unit_amount_cents * (a.qty || 0) : 0);
    }, 0);
    const originalTotal = ticketsSubtotal + addonsSubtotal;
    const processingFee = Math.round(originalTotal * 0.035);

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
      phone: p.phone || null,
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

    // Send confirmation emails for free orders
    await Promise.allSettled(
      cart.participants.map(async (p: any, index: number) => {
        try {
          const attendee = insertedAttendees[index];
          
          // Fetch the attendee with QR code from database
          const { data: attendeeWithQR } = await supabase
            .from("attendees")
            .select("qr_code")
            .eq("id", attendee.id)
            .single();
          console.log(`[process-free-order] Sending confirmation email to ${p.email} for attendee ${attendee.id}`);
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
              qrCode: attendeeWithQR?.qr_code,
              orderDetails: {
                orderId: order.id,
                totalAmount: 0, // Free order
                currency: 'usd',
                tickets: [{
                  name: ticket.name,
                  quantity: cart.ticketQty || 1,
                  unitPrice: 0 // Free
                }],
                addons: (cart.addons || []).filter((a: any) => a.qty > 0).map((a: any) => {
                  const addon = (addons || []).find((row: any) => row.id === a.id);
                  return {
                    name: addon?.name || 'Add-on',
                    quantity: a.qty,
                    unitPrice: 0 // Free
                  };
                }),
                discountInfo: cart.coupon ? {
                  couponCode: cart.coupon,
                  discountAmount: originalTotal,
                  originalAmount: originalTotal,
                  finalAmount: 0
                } : null
              }
            }
          });
          console.log(`[process-free-order] Successfully sent confirmation email to ${p.email}`);
        } catch (e) {
          console.error('[process-free-order send-confirmation] failed for', p.email, e);
        }
      })
    );

    console.log(`[process-free-order] Created free order ${order.id} for ${cart.participants.length} attendees and sent confirmation emails`);

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