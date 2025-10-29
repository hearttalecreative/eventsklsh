import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

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

    try {
      // Extract cart data from session metadata
      const metadata = session.metadata || {};
      
      if (!metadata.cart_data) {
        console.error(`[stripe-webhook] No cart_data in session metadata for ${session.id}`);
        
        // Log the error
        await supabase.from('stripe_logs').insert({
          event_type: event.type,
          stripe_session_id: session.id,
          stripe_event_id: event.id,
          customer_email: session.customer_details?.email || 'unknown',
          customer_name: session.customer_details?.name,
          amount_cents: session.amount_total || 0,
          currency: session.currency || 'usd',
          status: 'error',
          error_message: 'Missing cart_data in session metadata',
          processing_time_ms: Date.now() - startTime
        });

        // Acknowledge to prevent Stripe retries; the frontend fallback will handle verification
        return new Response(JSON.stringify({ received: true, reason: "missing_cart_data" }), { status: 200 });
      }

      const cart = JSON.parse(metadata.cart_data);
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
          payment_method_types: session.payment_method_types
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

      // Acknowledge to stop Stripe retries; internal processing failed but will be handled via fallback/manual
      return new Response(JSON.stringify({ received: true, error: err.message }), { status: 200 });
    }
  }

  // Return a 200 response to acknowledge receipt of the event in other cases
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});