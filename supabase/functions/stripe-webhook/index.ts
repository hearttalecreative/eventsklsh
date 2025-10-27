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
    return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
  }

  let event: Stripe.Event;
  
  try {
    const body = await req.text();
    // Stripe requires async verification in edge/Deno environments
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log(`[stripe-webhook] Received event: ${event.type}`);
  } catch (err: any) {
    console.error(`[stripe-webhook] Webhook signature verification failed:`, err.message);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { status: 400 });
  }

  // Handle checkout completion (sync or async)
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`[stripe-webhook] Processing ${event.type} for session: ${session.id}`);

    try {
      // Extract cart data from session metadata
      const metadata = session.metadata || {};
      
      if (!metadata.cart_data) {
        console.error(`[stripe-webhook] No cart_data in session metadata`);
        return new Response(JSON.stringify({ error: "Missing cart data in session" }), { status: 400 });
      }

      const cart = JSON.parse(metadata.cart_data);
      console.log(`[stripe-webhook] Cart data:`, cart);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Fast path: prevent duplicates by Stripe session id
      const { data: existingBySession } = await supabase
        .from('orders')
        .select('id')
        .eq('stripe_session_id', session.id)
        .maybeSingle();

      if (existingBySession) {
        console.log(`[stripe-webhook] Session ${session.id} already processed as order ${existingBySession.id}`);
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
        return new Response(JSON.stringify({ received: true, orderId: existingOrder?.id }), { status: 200 });
      }

      // Process the payment by calling verify-payment (idempotent)
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { sessionId: session.id, cart },
      });

      if (error) {
        console.error(`[stripe-webhook] Error calling verify-payment:`, error);
        throw error;
      }

      console.log(`[stripe-webhook] Successfully processed order:`, data);
      return new Response(JSON.stringify({ received: true, orderId: data?.orderId }), { status: 200 });
    } catch (err: any) {
      console.error(`[stripe-webhook] Error processing checkout session:`, err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // Return a 200 response to acknowledge receipt of the event in other cases
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});