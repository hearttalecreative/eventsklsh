import fs from 'fs';

// Helper to load env vars
const loadEnv = (path) => {
  if (fs.existsSync(path)) {
    const content = fs.readFileSync(path, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
};

loadEnv('.env');
loadEnv('supabase/.env');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

async function main() {
  console.log("Fetching pending training purchases...");
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/training_purchases?status=eq.pending&stripe_session_id=not.is.null&select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  const purchases = await res.json();
  if (!Array.isArray(purchases)) {
    console.error("Failed to fetch purchases:", purchases);
    return;
  }
  
  console.log(`Found ${purchases.length} pending purchases.`);
  let updatedCount = 0;

  for (const purchase of purchases) {
    try {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${purchase.stripe_session_id}`, {
        headers: {
          'Authorization': `Bearer ${STRIPE_KEY}`
        }
      });
      const session = await stripeRes.json();
      
      console.log(`Session ${purchase.stripe_session_id} status: ${session.payment_status}`);
      
      if (session.payment_status === "paid") {
        console.log(`Updating purchase ${purchase.id} to paid...`);
        
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/training_purchases?id=eq.${purchase.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ status: "paid" })
        });
        
        if (!updateRes.ok) {
          console.error(`Update error for ${purchase.id}:`, await updateRes.text());
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
