import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Using Brevo API via HTTP

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  name: string;
  email: string;
  eventTitle?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { name, email, eventTitle }: Payload = await req.json();
    console.log("send-confirmation invoked with:", { name, email, eventTitle });

    if (!email || !name) {
      console.error("Missing fields", { name, email });
      return new Response(JSON.stringify({ ok: false, error: "Missing name or email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = `Your ticket confirmation for ${eventTitle || "the event"}`;
    const html = `
      <div style="background:#f6f7fb;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
          <!-- Header with Logo -->
          <div style="background:linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);padding:32px 24px;text-align:center;">
            <div style="background:#ffffff;width:120px;height:36px;margin:0 auto 16px auto;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <div style="width:20px;height:20px;background:linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);border-radius:4px;margin-right:8px;"></div>
              <span style="font-weight:700;color:#1f2937;font-size:18px;">Events</span>
            </div>
            <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:700;">Thank you, ${name}!</h1>
            <p style="margin:12px 0 0 0;color:#e0e7ff;font-size:16px;">Your tickets have been confirmed</p>
          </div>
          
          <!-- Event Details -->
          <div style="padding:24px;">
            <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;color:#1e293b;">${eventTitle || "the event"}</h2>
              <p style="margin:0;color:#64748b;">This is a test purchase confirmation to verify that Brevo email service is correctly configured.</p>
            </div>
            
            <div style="background:#dcfce7;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;color:#166534;font-weight:600;">✅ Email Configuration Test Successful</p>
              <p style="margin:8px 0 0 0;color:#15803d;font-size:14px;">Your Brevo integration is working properly!</p>
            </div>
            
            <p style="margin:24px 0 0 0;color:#6b7280;font-size:13px;text-align:center;">
              If you have any questions about this test, just reply to this email.
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      const response = await sendBrevoEmail(email, name, subject, html);
      console.log("Brevo response:", response);
      return new Response(JSON.stringify({ ok: true, response }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (e: any) {
      console.error("Brevo send error:", e?.message || String(e));
      return new Response(
        JSON.stringify({ ok: false, error: e?.message || String(e) }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } catch (error: any) {
    console.error("Error in send-confirmation:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || String(error) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
