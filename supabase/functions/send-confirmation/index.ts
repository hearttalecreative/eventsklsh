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
  eventDate?: string;
  eventVenue?: string;
  instructions?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { name, email, eventTitle, eventDate, eventVenue, instructions }: Payload = await req.json();
    console.log("send-confirmation invoked with:", { name, email, eventTitle });

    if (!email || !name) {
      console.error("Missing fields", { name, email });
      return new Response(JSON.stringify({ ok: false, error: "Missing name or email" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Format instructions if provided (convert markdown-like formatting to HTML)
    const formatInstructions = (text: string) => {
      if (!text) return '';
      
      return text
        // Bold text **text** to <strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic text *text* to <em>
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Line breaks
        .replace(/\n/g, '<br>')
        // Lists (- item) to bullet points
        .replace(/^- (.+)$/gm, '• $1')
        // Code `code` to inline code
        .replace(/`(.*?)`/g, '<code style="background:#f3f4f6;padding:2px 4px;border-radius:4px;font-family:monospace;font-size:14px;">$1</code>');
    };

    const subject = `Confirmation: ${eventTitle || "Event Registration"}`;
    const html = `
      <div style="background:hsl(35, 40%, 98%);padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:hsl(24, 30%, 15%);line-height:1.6;">
        <div style="max-width:600px;margin:0 auto;background:hsl(0, 0%, 100%);border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg, hsl(30, 60%, 42%) 0%, hsl(30, 50%, 35%) 100%);padding:40px 32px;text-align:center;">
            <div style="background:hsl(0, 0%, 100%);width:140px;height:40px;margin:0 auto 20px auto;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
              <div style="width:24px;height:24px;background:linear-gradient(135deg, hsl(30, 60%, 42%) 0%, hsl(30, 50%, 35%) 100%);border-radius:6px;margin-right:8px;"></div>
              <span style="font-weight:700;color:hsl(24, 30%, 15%);font-size:16px;">Events</span>
            </div>
            <h1 style="margin:0;font-size:32px;line-height:1.2;color:hsl(0, 0%, 100%);font-weight:700;">Thank you, ${name}!</h1>
            <p style="margin:16px 0 0 0;color:hsl(35, 20%, 95%);font-size:18px;font-weight:500;">Your tickets have been confirmed</p>
          </div>
          
          <!-- Event Details -->
          <div style="padding:32px;">
            <!-- Event Info Card -->
            <div style="background:linear-gradient(135deg, hsl(35, 30%, 94%) 0%, hsl(35, 20%, 90%) 100%);border:1px solid hsl(35, 18%, 88%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="margin:0 0 16px 0;font-size:24px;color:hsl(24, 30%, 15%);font-weight:600;">${eventTitle || "Event"}</h2>
              ${eventDate ? `<div style="margin:8px 0;color:hsl(24, 15%, 40%);font-size:16px;"><strong>📅 Date & time:</strong> ${eventDate}</div>` : ''}
              ${eventVenue ? `<div style="margin:8px 0;color:hsl(24, 15%, 40%);font-size:16px;"><strong>📍 Location:</strong> ${eventVenue}</div>` : ''}
            </div>
            
            ${instructions ? `
            <!-- Instructions -->
            <div style="background:hsl(35, 45%, 96%);border:1px solid hsl(30, 60%, 80%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;font-size:20px;color:hsl(30, 60%, 30%);font-weight:600;display:flex;align-items:center;">
                <span style="font-size:24px;margin-right:8px;">📋</span>
                Important Instructions
              </h3>
              <div style="color:hsl(30, 60%, 25%);font-size:16px;line-height:1.8;">
                ${formatInstructions(instructions)}
              </div>
            </div>
            ` : ''}
            
            <!-- Success Message -->
            <div style="background:linear-gradient(135deg, hsl(35, 45%, 96%) 0%, hsl(30, 60%, 90%) 100%);border:1px solid hsl(30, 60%, 70%);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
              <div style="font-size:32px;margin-bottom:8px;">✨</div>
              <p style="margin:0;color:hsl(30, 60%, 30%);font-weight:600;font-size:18px;">All set for your experience!</p>
              <p style="margin:8px 0 0 0;color:hsl(30, 60%, 25%);font-size:14px;">We'll see you soon at this beautiful event</p>
            </div>
            
            <!-- Contact -->
            <div style="text-align:center;padding:16px 0;border-top:1px solid hsl(35, 18%, 88%);">
              <p style="margin:0 0 8px 0;color:hsl(24, 15%, 40%);font-size:14px;">Questions? Reply to this email</p>
              <p style="margin:0;color:hsl(24, 12%, 75%);font-size:12px;">With love and light 🙏</p>
            </div>
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
