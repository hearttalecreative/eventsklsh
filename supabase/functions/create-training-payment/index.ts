import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  programId: string;
  fullName: string;
  email: string;
  phone: string;
  preferredDates: string;
}

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

const sendNotificationEmail = async (
  supabase: any,
  program: { name: string; price_cents: number; processing_fee_percent: number },
  customer: { fullName: string; email: string; phone: string; preferredDates: string },
  totalAmountCents: number
) => {
  const processingFeeCents = Math.round(program.price_cents * (program.processing_fee_percent / 100));
  const adminEmail = Deno.env.get("ADMIN_EMAIL") || "info@kylelamsoundhealing.com";
  
  const message = `A new training program registration has been initiated (Pending Payment).

Program Details:
- Program: ${program.name}
- Program Price: ${formatPrice(program.price_cents)}
- Processing Fee (${program.processing_fee_percent}%): ${formatPrice(processingFeeCents)}
- Total Amount: ${formatPrice(totalAmountCents)}

Customer Information:
- Name: ${customer.fullName}
- Email: ${customer.email}
- Phone: ${customer.phone}
- Preferred Dates: ${customer.preferredDates}

This is a lead notification. A second email will be sent once the payment is confirmed.`;

  try {
    await supabase.functions.invoke("send-admin-email", {
      body: {
        to: [adminEmail, "kyle@kylelamsoundhealing.com"],
        subject: `New Training Purchase (Pending): ${program.name} — ${customer.fullName}`,
        message: message,
        recipientName: "Administrator"
      }
    });
    console.log("Notification email sent via send-admin-email");
  } catch (emailError) {
    console.error("Failed to send notification email:", emailError);
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { programId, fullName, email, phone, preferredDates }: RequestPayload = await req.json();

    // Validate required fields
    if (!programId || !fullName || !email || !phone || !preferredDates) {
      return new Response(
        JSON.stringify({ error: "All fields are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the training program
    const { data: program, error: programError } = await supabase
      .from("training_programs")
      .select("*")
      .eq("id", programId)
      .eq("active", true)
      .single();

    if (programError || !program) {
      console.error("Program fetch error:", programError);
      return new Response(
        JSON.stringify({ error: "Training program not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate the processing fee dynamically
    const processingFeeCents = Math.round(program.price_cents * (program.processing_fee_percent / 100));
    const totalAmountCents = program.price_cents + processingFeeCents;

    // Create a purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from("training_purchases")
      .insert({
        program_id: programId,
        full_name: fullName,
        email: email,
        phone: phone,
        preferred_dates: preferredDates,
        amount_cents: totalAmountCents,
        status: "pending",
      })
      .select()
      .single();

    if (purchaseError) {
      console.error("Purchase insert error:", purchaseError);
      return new Response(
        JSON.stringify({ error: "Failed to create purchase record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Determine the origin for redirect URLs
    const origin = req.headers.get("origin") || "https://events.kylelamsoundhealing.com";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: program.name,
              description: `Private Training Registration for ${fullName}`,
            },
            unit_amount: program.price_cents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Processing Fee",
              description: `${program.processing_fee_percent}% processing fee`,
            },
            unit_amount: processingFeeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/training-success?purchase_id=${purchase.id}`,
      cancel_url: `${origin}/trainings`,
      metadata: {
        purchase_id: purchase.id,
        program_id: programId,
        program_name: program.name,
        customer_name: fullName,
        customer_email: email,
        customer_phone: phone,
        preferred_dates: preferredDates,
      },
    });

    // Update purchase with session ID
    await supabase
      .from("training_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    // Send notification email
    await sendNotificationEmail(
      supabase,
      program,
      { fullName, email, phone, preferredDates },
      totalAmountCents
    );

    console.log(`Created Stripe session ${session.id} for purchase ${purchase.id}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in create-training-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
