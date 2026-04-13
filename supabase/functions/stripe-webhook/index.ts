import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const ADMIN_REPORTS_EMAIL = "info@kylelamsoundhealing.com";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error(`[stripe-webhook] Missing Stripe signature header`);
    // Acknowledge to avoid Stripe retries; CheckoutSuccess will fallback if needed
    return new Response(JSON.stringify({ received: true, reason: "no_signature" }), { status: 200 });
  }

  let event: Stripe.Event;
  
  try {
    const body = await req.text();
    // Stripe requires async verification in edge/Deno environments
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log(`[stripe-webhook] Received event: ${event.type}`);
  } catch (err: any) {
    console.error(`[stripe-webhook] Webhook signature verification failed:`, err.message);
    return new Response(JSON.stringify({ received: true, reason: "bad_signature" }), { status: 200 });
  }

  // Handle checkout completion (sync or async)
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const startTime = Date.now();
    console.log(`[stripe-webhook] Processing ${event.type} for session: ${session.id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const notifyAdminOfError = async (errorMsg: string, cartData: any = null) => {
      try {
        const customerName = session.customer_details?.name || cartData?.participants?.[0]?.fullName || "Unknown";
        const customerEmail = session.customer_details?.email || cartData?.participants?.[0]?.email || "Unknown";
        const amount = (session.amount_total || 0) / 100;
        
        const message = `A Stripe payment was received but failed to process completely in our system.

Error Details:
- Message: ${errorMsg}
- Stripe Event ID: ${event.id}
- Stripe Session ID: ${session.id}
- Customer Name: ${customerName}
- Customer Email: ${customerEmail}
- Amount: $${amount.toFixed(2)} USD

Please check the Stripe Dashboard and the application's Admin Logs for more details, and manually fulfill this order if necessary.`;

        await supabase.functions.invoke("send-admin-email", {
          body: {
            to: ADMIN_REPORTS_EMAIL,
            subject: `Action Required: Stripe Payment Processing Error - ${customerName}`,
            message: message,
            recipientName: "Administrator"
          }
        });
      } catch (emailErr) {
        console.error(`[stripe-webhook] Failed to send admin notification email:`, emailErr);
      }
    };

    try {
      // Load cart payload. New flow stores it in DB (Stripe metadata values have a 500-char limit).
      const metadata = session.metadata || {};
      let purchaseId = metadata.purchase_id;

      // Fallback for Training Purchase: Match by email + amount + status=pending if metadata was lost
      if (!purchaseId && session.customer_details?.email) {
        console.log(`[stripe-webhook] Missing purchase_id, attempting fallback for ${session.customer_details.email} ($${(session.amount_total || 0) / 100})`);
        const { data: matchedPurchases } = await supabase
          .from("training_purchases")
          .select("id")
          .eq("email", session.customer_details.email)
          .eq("amount_cents", session.amount_total || 0)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (matchedPurchases && matchedPurchases.length === 1) {
          purchaseId = matchedPurchases[0].id;
          console.log(`[stripe-webhook] Fallback matched training purchase: ${purchaseId}`);
        }
      }

      // Check for training purchases first
      if (purchaseId) {
        console.log(`[stripe-webhook] Processing training purchase: ${purchaseId}`);

        // Update the training_purchases table to "paid"
        const { error: updateError } = await supabase
          .from("training_purchases")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", purchaseId);

        if (updateError) {
          console.error("[stripe-webhook] Failed to update training purchase status:", updateError);
          await notifyAdminOfError(`Failed to update training purchase status: ${updateError.message}`);
          return new Response(JSON.stringify({ received: true, reason: 'training_update_failed' }), { status: 200 });
        }

        // Send confirmation email to admin now that payment is confirmed
        try {
          const customerName = metadata.customer_name || session.customer_details?.name || "Unknown";
          const customerEmail = metadata.customer_email || session.customer_details?.email || "Unknown";
          const customerPhone = metadata.customer_phone || "Not provided";
          const preferredDates = metadata.preferred_dates || "Not provided";
          const programName = metadata.program_name || "Training Program";
          const amountUSD = ((session.amount_total || 0) / 100).toFixed(2);

          const message = `New Training Payment Confirmed!
A payment has been successfully processed through Stripe.

Program Details:
- Program: ${programName}
- Amount Paid: $${amountUSD} USD
- Stripe Session: ${session.id}

Customer Information:
- Name: ${customerName}
- Email: ${customerEmail}
- Phone: ${customerPhone}
- Preferred Dates: ${preferredDates}

Please follow up with the customer to confirm training dates.`;

          await supabase.functions.invoke("send-admin-email", {
            body: {
              to: [ADMIN_REPORTS_EMAIL],
              subject: `✅ Payment Confirmed: ${programName} — ${customerName}`,
              message: message,
              recipientName: "Administrator"
            }
          });

          console.log(`[stripe-webhook] Admin confirmation email sent via send-admin-email for training purchase: ${purchaseId}`);
        } catch (emailErr) {
          console.error("[stripe-webhook] Failed to send training confirmation email:", emailErr);
          // Don't fail the webhook just because email failed
        }

        // Log to stripe_logs
        await supabase.from("stripe_logs").insert({
          event_type: event.type,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          customer_email: session.customer_details?.email || metadata.customer_email || 'unknown',
          customer_name: session.customer_details?.name || metadata.customer_name,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'success',
          error_message: null,
          processing_time_ms: Date.now() - startTime,
          metadata: {
            payment_intent_id: session.payment_intent,
            purchase_id: purchaseId
          }
        });

        console.log(`[stripe-webhook] Successfully processed training purchase: ${purchaseId}`);
        return new Response(JSON.stringify({ received: true, purchaseId: purchaseId }), { status: 200 });
      }

      let cart: any | null = null;
      let checkoutId = metadata.checkout_id;

      // Fallback for Event Ticket: Match by email in pending_checkouts if metadata was lost
      if (!checkoutId && !metadata.cart_data && session.customer_details?.email) {
        console.log(`[stripe-webhook] Missing checkout_id, attempting fallback for ${session.customer_details.email}`);
        const { data: matchedCheckouts } = await supabase
          .from("pending_checkouts")
          .select("id, cart")
          .eq("buyer_email", session.customer_details.email)
          .order("created_at", { ascending: false });

        if (matchedCheckouts && matchedCheckouts.length === 1) {
          checkoutId = matchedCheckouts[0].id;
          cart = matchedCheckouts[0].cart;
          console.log(`[stripe-webhook] Fallback matched event checkout: ${checkoutId}`);
        }
      }

      if (metadata.cart_data) {
        // Backward-compat for older sessions
        cart = JSON.parse(metadata.cart_data);
      } else if (checkoutId) {
        // Load cart from DB if not already loaded by fallback
        if (!cart) {
          const { data: pending, error: pendingErr } = await supabase
            .from('pending_checkouts')
            .select('cart')
            .eq('id', checkoutId)
            .maybeSingle();

          if (pendingErr) {
            console.error('[stripe-webhook] Failed to load pending checkout cart:', pendingErr);
            await notifyAdminOfError(`Failed to load pending checkout cart: ${pendingErr.message}`);
            return new Response(JSON.stringify({ received: true, reason: 'pending_checkout_load_failed' }), { status: 200 });
          }

          if (!pending?.cart) {
            console.error(`[stripe-webhook] No pending checkout cart found for checkout_id=${checkoutId} session=${session.id}`);
            await notifyAdminOfError(`No pending checkout cart found for checkout_id=${checkoutId}`);
            return new Response(JSON.stringify({ received: true, reason: 'missing_pending_checkout' }), { status: 200 });
          }

          cart = pending.cart;
        }
      }

      if (!cart) {
        console.error(`[stripe-webhook] Missing cart payload for ${session.id}`);

        await supabase.from('stripe_logs').insert({
          event_type: event.type,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          customer_email: session.customer_details?.email || 'unknown',
          customer_name: session.customer_details?.name,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'error',
          error_message: 'Missing cart payload (checkout_id/cart_data)',
          processing_time_ms: Date.now() - startTime,
        });

        await notifyAdminOfError('Missing cart payload (checkout_id/cart_data)');

        return new Response(JSON.stringify({ received: true, reason: 'missing_cart_payload' }), { status: 200 });
      }

      console.log(`[stripe-webhook] Cart data:`, cart);

      // Fast path: prevent duplicates by Stripe session id
      const { data: existingBySession } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();

      if (existingBySession) {
        console.log(`[stripe-webhook] Session ${session.id} already processed as order ${existingBySession.id}`);
        
        // Log duplicate attempt
        await supabase.from('stripe_logs').insert({
          event_type: `${event.type}_duplicate`,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          customer_email: session.customer_details?.email || cart.participants[0]?.email,
          customer_name: session.customer_details?.name || cart.participants[0]?.fullName,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'duplicate',
          order_id: existingBySession.id,
          event_id: cart.eventId,
          processing_time_ms: Date.now() - startTime,
          metadata: { session_payment_status: session.payment_status }
        });

        return new Response(JSON.stringify({ received: true, orderId: existingBySession.id }), { status: 200 });
      }

      // Also check for potential duplicates by email+event (last hour)
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('id, stripe_session_id, created_at')
        .eq('email', session.customer_details?.email || cart.participants[0]?.email)
        .eq('event_id', cart.eventId)
        .eq('status', 'paid')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .order('created_at', { ascending: false });

      const sessionAlreadyProcessed = existingOrders?.some(order => order.stripe_session_id === session.id);
      if (sessionAlreadyProcessed) {
        console.log(`[stripe-webhook] Stripe session ${session.id} already processed, skipping duplicate`);
        const existingOrder = existingOrders!.find(o => o.stripe_session_id === session.id);
        
        // Log duplicate
        await supabase.from('stripe_logs').insert({
          event_type: `${event.type}_duplicate`,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          customer_email: session.customer_details?.email || cart.participants[0]?.email,
          customer_name: session.customer_details?.name || cart.participants[0]?.fullName,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'duplicate',
          order_id: existingOrder?.id,
          event_id: cart.eventId,
          processing_time_ms: Date.now() - startTime
        });

        return new Response(JSON.stringify({ received: true, orderId: existingOrder?.id }), { status: 200 });
      }

      // Get event title for logging
      const { data: eventData } = await supabase
        .from('events')
        .select('title')
        .eq('id', cart.eventId)
        .single();

      // Log webhook receipt with a unique identifier we can update later
      const { data: initialLog } = await supabase.from('stripe_logs').insert({
        event_type: event.type,
        stripe_session_id: session.id,
        stripe_event_id: event.id,
        customer_email: session.customer_details?.email || cart.participants[0]?.email,
        customer_name: session.customer_details?.name || cart.participants[0]?.fullName,
        amount_cents: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: 'processing',
        event_id: cart.eventId,
        event_title: eventData?.title,
        tickets_count: cart.participants?.length || 0,
        metadata: {
          payment_status: session.payment_status,
          payment_method_types: session.payment_method_types,
          payment_intent_id: session.payment_intent
        }
      }).select().single();

      // Process the payment by calling verify-payment (idempotent)
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { sessionId: session.id, cart },
      });

      if (error) {
        console.error(`[stripe-webhook] Error calling verify-payment:`, error);
        
        // Update the existing log to error instead of creating a new one
        if (initialLog?.id) {
          await supabase.from('stripe_logs')
            .update({
              status: 'error',
              error_message: error.message || String(error),
              processing_time_ms: Date.now() - startTime
            })
            .eq('id', initialLog.id);
        }

        await notifyAdminOfError(error.message || String(error), cart);

        throw error;
      }

      console.log(`[stripe-webhook] Successfully processed order:`, data);
      
      // Update the existing log to success instead of creating a new one
      if (initialLog?.id) {
        await supabase.from('stripe_logs')
          .update({
            status: 'success',
            order_id: data?.orderId,
            processing_time_ms: Date.now() - startTime,
            metadata: {
              payment_status: session.payment_status,
              order_created: true
            }
          })
          .eq('id', initialLog.id);
      }

      return new Response(JSON.stringify({ received: true, orderId: data?.orderId }), { status: 200 });
    } catch (err: any) {
      console.error(`[stripe-webhook] Error processing checkout session:`, err);
      
      // Try to log the error even if it failed
      try {
        await supabase.from('stripe_logs').insert({
          event_type: `${event.type}_error`,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          customer_email: session.customer_details?.email || 'unknown',
          customer_name: session.customer_details?.name,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'error',
          error_message: err.message || String(err),
          processing_time_ms: Date.now() - startTime
        });
      } catch (logErr) {
        console.error('[stripe-webhook] Failed to log error:', logErr);
      }

      await notifyAdminOfError(err.message || String(err));

      // Acknowledge to stop Stripe retries; internal processing failed but will be handled via fallback/manual
      return new Response(JSON.stringify({ received: true, error: err.message }), { status: 200 });
    }
  }

  // Return a 200 response to acknowledge receipt of the event in other cases
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
