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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`[stripe-webhook] Received event: ${event.type}`);
  } catch (err: any) {
    console.error(`[stripe-webhook] Webhook signature verification failed:`, err.message);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`[stripe-webhook] Processing checkout.session.completed for session: ${session.id}`);

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

      // Check if order already exists for this session to prevent duplicates
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('email', session.customer_details?.email || cart.participants[0]?.email)
        .eq('event_id', cart.eventId)
        .eq('total_amount_cents', session.amount_total)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOrder) {
        console.log(`[stripe-webhook] Order already processed for session ${session.id}`);
        return new Response(JSON.stringify({ received: true, orderId: existingOrder.id }), { status: 200 });
      }

      // Process the payment by calling verify-payment
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

  // Return a 200 response to acknowledge receipt of the event
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});