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
  phone?: string;
  eventTitle?: string;
  eventDescription?: string;
  eventDate?: string;
  eventVenue?: string;
  instructions?: string;
  confirmationCode?: string;
  qrCode?: string;
  orderDetails?: {
    orderId: string;
    totalAmount: number;
    currency: string;
    tickets: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
    addons?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
    }>;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { 
      name, 
      email, 
      phone, 
      eventTitle, 
      eventDescription, 
      eventDate, 
      eventVenue, 
      instructions, 
      confirmationCode,
      qrCode,
      orderDetails 
    }: Payload = await req.json();
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

    // Format event date
    const formatEventDate = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    };

    // Format currency amount
    const formatAmount = (cents: number, currency: string = 'usd') => {
      const amount = cents / 100;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
      }).format(amount);
    };

    const subject = `Event Ticket Confirmation - ${eventTitle || "Event"}`;
    const html = `
      <div style="background:#fafaf9;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell',sans-serif;color:#2c1810;line-height:1.6;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header with Logo -->
          <div style="background:linear-gradient(135deg, #a0662f 0%, #8b5a2b 100%);padding:40px 24px 32px 24px;text-align:center;position:relative;">
            <div style="background:#ffffff;width:200px;height:60px;margin:0 auto 24px auto;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
              <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Kyle Lam Sound Healing" style="height:40px;width:auto;" />
            </div>
            <h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:700;letter-spacing:-0.5px;">Thank you, ${name}!</h1>
            <p style="margin:0;color:#ffffff;opacity:0.95;font-size:18px;font-weight:500;">Your Sound Healing journey awaits</p>
            <div style="margin-top:16px;padding:12px 24px;background:rgba(255,255,255,0.15);border-radius:50px;display:inline-block;">
              <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Ticket Confirmed</p>
            </div>
          </div>
          
          <!-- Main Content -->
          <div style="padding:32px 24px;">
            
            <!-- Event Information -->
            <div style="background:linear-gradient(135deg, #f8f6f4 0%, #f5f2ef 100%);border-radius:12px;padding:24px;margin-bottom:24px;border:1px solid #e7e3e0;">
              <h2 style="margin:0 0 16px 0;font-size:22px;color:#2c1810;font-weight:700;letter-spacing:-0.3px;">${eventTitle || "Sound Healing Event"}</h2>
              ${eventDescription ? `<p style="margin:0 0 20px 0;color:#52433a;font-size:15px;line-height:1.6;">${eventDescription}</p>` : ''}
              
              <div style="display:grid;gap:16px;margin-top:20px;">
                ${eventDate ? `
                <div style="display:flex;align-items:center;color:#52433a;font-size:15px;background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e7e3e0;">
                  <div style="background:#a0662f;color:#ffffff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;margin-right:12px;font-size:14px;">📅</div>
                  <div>
                    <strong style="color:#2c1810;font-size:16px;display:block;margin-bottom:4px;">Date & Time</strong>
                    <span style="color:#a0662f;font-weight:600;font-size:15px;">${formatEventDate(eventDate)}</span>
                  </div>
                </div>
                ` : ''}
                
                ${eventVenue ? `
                <div style="display:flex;align-items:center;color:#52433a;font-size:15px;background:#ffffff;padding:16px;border-radius:8px;border:1px solid #e7e3e0;">
                  <div style="background:#a0662f;color:#ffffff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;margin-right:12px;font-size:14px;">📍</div>
                  <div>
                    <strong style="color:#2c1810;font-size:16px;display:block;margin-bottom:4px;">Location</strong>
                    <span style="color:#a0662f;font-weight:600;font-size:15px;">${eventVenue}</span>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- QR Code and Confirmation -->
            ${(qrCode || confirmationCode) ? `
            <div style="background:linear-gradient(135deg, #a0662f 0%, #8b5a2b 100%);border-radius:12px;padding:32px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
              <h3 style="margin:0 0 20px 0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Your Sacred Ticket</h3>
              
              ${qrCode ? `
              <div style="background:#ffffff;border-radius:16px;padding:24px;margin:0 auto 20px auto;max-width:220px;box-shadow:0 8px 24px rgba(0,0,0,0.15);border:2px solid #f8f6f4;position:relative;">
                <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#a0662f;color:#ffffff;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Sound Healing</div>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://events.kylelamsoundhealing.com/qr/${qrCode}`)}" 
                     alt="QR Code for check-in" 
                     style="width:160px;height:160px;display:block;margin:16px auto 20px auto;border-radius:12px;border:1px solid #e7e3e0;" />
                <div style="text-align:center;">
                  <p style="margin:0;color:#52433a;font-size:11px;font-weight:700;text-align:center;font-family:monospace;letter-spacing:1px;line-height:1.4;background:#f8f6f4;padding:8px;border-radius:6px;">${qrCode}</p>
                </div>
              </div>
              ` : ''}
              
              ${confirmationCode ? `
              <div style="background:#ffffff;color:#a0662f;padding:16px 24px;border-radius:10px;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:3px;display:inline-block;margin-bottom:12px;border:2px solid #f8f6f4;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                ${confirmationCode}
              </div>
              ` : ''}
              
              <p style="margin:12px 0 0 0;color:#ffffff;opacity:0.95;font-size:14px;font-weight:500;line-height:1.5;">
                ${qrCode ? 'Present this QR code or confirmation code at check-in for your transformative Sound Healing experience' : 'Present this confirmation code at the event for your healing journey'}
              </p>
            </div>
            ` : ''}

            <!-- Order Details -->
            ${orderDetails ? `
            <div style="background:#f8f6f4;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h3 style="margin:0 0 16px 0;font-size:18px;color:#2c1810;font-weight:600;">Order Details</h3>
              
              <div style="margin-bottom:16px;">
                <strong style="color:#52433a;">Order ID:</strong> 
                <span style="font-family:monospace;background:#ffffff;padding:2px 6px;border-radius:4px;color:#a0662f;font-weight:600;font-size:12px;">${orderDetails.orderId}</span>
              </div>

              <!-- Tickets -->
              ${orderDetails.tickets?.length ? `
              <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0;color:#2c1810;font-size:14px;font-weight:600;">Tickets:</h4>
                ${orderDetails.tickets.map(ticket => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e7e3e0;">
                    <div>
                      <span style="font-weight:500;color:#2c1810;font-size:13px;">${ticket.name}</span>
                      <span style="color:#52433a;margin-left:6px;font-size:12px;">× ${ticket.quantity}</span>
                    </div>
                    <span style="font-weight:600;color:#a0662f;font-size:13px;">${formatAmount(ticket.unitPrice * ticket.quantity, orderDetails.currency)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Add-ons -->
              ${orderDetails.addons?.length ? `
              <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0;color:#2c1810;font-size:14px;font-weight:600;">Add-ons:</h4>
                ${orderDetails.addons.map(addon => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e7e3e0;">
                    <div>
                      <span style="font-weight:500;color:#2c1810;font-size:13px;">${addon.name}</span>
                      <span style="color:#52433a;margin-left:6px;font-size:12px;">× ${addon.quantity}</span>
                    </div>
                    <span style="font-weight:600;color:#a0662f;font-size:13px;">${formatAmount(addon.unitPrice * addon.quantity, orderDetails.currency)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Total -->
              <div style="border-top:2px solid #a0662f;padding-top:12px;margin-top:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:16px;font-weight:600;color:#2c1810;">Total:</span>
                  <span style="font-size:18px;font-weight:700;color:#a0662f;">${formatAmount(orderDetails.totalAmount, orderDetails.currency)}</span>
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Customer Information -->
            <div style="background:#f8f6f4;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h3 style="margin:0 0 16px 0;font-size:18px;color:#2c1810;font-weight:600;">Customer Information</h3>
              
              <div style="display:grid;gap:8px;">
                <div style="font-size:14px;"><strong style="color:#2c1810;">Name:</strong> <span style="color:#a0662f;font-weight:500;">${name}</span></div>
                <div style="font-size:14px;"><strong style="color:#2c1810;">Email:</strong> <span style="color:#a0662f;font-weight:500;">${email}</span></div>
                ${phone ? `<div style="font-size:14px;"><strong style="color:#2c1810;">Phone:</strong> <span style="color:#a0662f;font-weight:500;">${phone}</span></div>` : ''}
              </div>
            </div>

            ${instructions ? `
            <!-- Event Instructions -->
            <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h3 style="margin:0 0 12px 0;font-size:18px;color:#a0662f;font-weight:600;display:flex;align-items:center;">
                <span style="font-size:20px;margin-right:6px;">📋</span>
                Important Instructions
              </h3>
              <div style="color:#2c1810;font-size:14px;line-height:1.6;">
                ${formatInstructions(instructions)}
              </div>
            </div>
            ` : ''}
            
            <!-- Success Message with Branding -->
            <div style="background:linear-gradient(135deg, #a0662f 0%, #8b5a2b 100%);border-radius:12px;padding:32px;text-align:center;margin-bottom:24px;position:relative;">
              <div style="font-size:36px;margin-bottom:16px;">🎵</div>
              <h3 style="margin:0 0 12px 0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Ready for Your Sound Healing Journey!</h3>
              <p style="margin:0 0 16px 0;color:#ffffff;opacity:0.95;font-size:15px;font-weight:500;line-height:1.5;">Kyle Lam Sound Healing welcomes you to a transformative experience</p>
              <a href="https://kylelamsoundhealing.com" target="_blank" style="color:#ffffff;text-decoration:none;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;display:inline-block;margin-top:8px;border:1px solid rgba(255,255,255,0.3);">Visit Our Website →</a>
            </div>
            
            <!-- Contact & Footer -->
            <div style="text-align:center;padding:24px 0;border-top:2px solid #f0ede9;">
              <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Kyle Lam Sound Healing" style="height:32px;width:auto;margin:0 auto 16px auto;opacity:0.8;" />
              <p style="margin:0 0 8px 0;color:#52433a;font-size:14px;font-weight:600;">Kyle Lam Sound Healing</p>
              <p style="margin:0 0 12px 0;color:#52433a;font-size:13px;">Questions about your booking? Reply to this email</p>
              <a href="https://kylelamsoundhealing.com" target="_blank" style="color:#a0662f;text-decoration:none;font-size:13px;font-weight:600;">kylelamsoundhealing.com</a>
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
