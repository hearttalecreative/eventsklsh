import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe";
import * as dotenv from "npm:dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: "supabase/.env" });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function main() {
  console.log("Fetching pending training purchases...");
  const { data: purchases, error } = await supabase
    .from("training_purchases")
    .select("*")
    .eq("status", "pending")
    .not("stripe_session_id", "is", null);

  if (error) {
    console.error("Failed to fetch:", error);
    return;
  }

  console.log(`Found ${purchases?.length || 0} pending purchases.`);

  let updatedCount = 0;

  for (const purchase of purchases || []) {
    try {
      const session = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id);
      console.log(`Session ${purchase.stripe_session_id} status: ${session.payment_status}`);
      
      if (session.payment_status === "paid") {
        console.log(`Updating purchase ${purchase.id} to paid...`);
        const { error: updateErr } = await supabase
          .from("training_purchases")
          .update({ status: "paid" })
          .eq("id", purchase.id);
        
        if (updateErr) {
          console.error("Update error:", updateErr);
        } else {
          updatedCount++;
        }
      }
    } catch (err) {
      console.error(`Error processing ${purchase.id}:`, err);
    }
  }

  console.log(`Successfully updated ${updatedCount} purchases.`);
}

main();
