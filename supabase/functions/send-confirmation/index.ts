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
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background:#a0662f;padding:32px 24px;text-align:center;">
            <div style="background:#ffffff;width:140px;height:40px;margin:0 auto 20px auto;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <div style="width:20px;height:20px;background:#a0662f;border-radius:4px;margin-right:8px;"></div>
              <span style="font-weight:600;color:#2c1810;font-size:16px;">Events</span>
            </div>
            <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:600;">Thank you, ${name}!</h1>
            <p style="margin:12px 0 0 0;color:#ffffff;opacity:0.9;font-size:16px;">Your ticket has been confirmed</p>
          </div>
          
          <!-- Main Content -->
          <div style="padding:24px;">
            
            <!-- Event Information -->
            <div style="background:#f8f6f4;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;color:#2c1810;font-weight:600;">${eventTitle || "Event"}</h2>
              ${eventDescription ? `<p style="margin:0 0 16px 0;color:#52433a;font-size:14px;line-height:1.5;">${eventDescription}</p>` : ''}
              
              <div style="display:grid;gap:12px;margin-top:16px;">
                ${eventDate ? `
                <div style="display:flex;align-items:flex-start;color:#52433a;font-size:14px;">
                  <span style="margin-right:8px;font-size:16px;margin-top:1px;">📅</span>
                  <div>
                    <strong style="color:#2c1810;">Date & Time:</strong><br>
                    <span style="color:#a0662f;font-weight:500;">${formatEventDate(eventDate)}</span>
                  </div>
                </div>
                ` : ''}
                
                ${eventVenue ? `
                <div style="display:flex;align-items:flex-start;color:#52433a;font-size:14px;">
                  <span style="margin-right:8px;font-size:16px;margin-top:1px;">📍</span>
                  <div>
                    <strong style="color:#2c1810;">Location:</strong><br>
                    <span style="color:#a0662f;font-weight:500;">${eventVenue}</span>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- QR Code and Confirmation -->
            ${(qrCode || confirmationCode) ? `
            <div style="background:#a0662f;border-radius:8px;padding:24px;text-align:center;margin-bottom:20px;">
              <h3 style="margin:0 0 16px 0;color:#ffffff;font-size:18px;font-weight:600;">Your Ticket</h3>
              
              ${qrCode ? `
              <div style="background:#ffffff;border-radius:16px;padding:24px;margin:0 auto 20px auto;max-width:220px;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:2px solid #f8f6f4;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://events.kylelamsoundhealing.com/qr/${qrCode}`)}" 
                     alt="QR Code for check-in" 
                     style="width:160px;height:160px;display:block;margin:0 auto 16px auto;border-radius:12px;border:1px solid #e7e3e0;" />
                <div style="text-align:center;">
                  <p style="margin:0;color:#52433a;font-size:11px;font-weight:600;text-align:center;font-family:monospace;letter-spacing:0.5px;line-height:1.4;">${qrCode}</p>
                </div>
              </div>
              ` : ''}
              
              ${confirmationCode ? `
              <div style="background:#ffffff;color:#a0662f;padding:12px 20px;border-radius:6px;font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:2px;display:inline-block;margin-bottom:8px;">
                ${confirmationCode}
              </div>
              ` : ''}
              
              <p style="margin:8px 0 0 0;color:#ffffff;opacity:0.9;font-size:13px;">
                ${qrCode ? 'Present this QR code or confirmation code at check-in' : 'Present this confirmation code at the event'}
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
            
            <!-- Success Message -->
            <div style="background:#a0662f;border-radius:8px;padding:24px;text-align:center;margin-bottom:20px;">
              <div style="font-size:32px;margin-bottom:12px;">✨</div>
              <h3 style="margin:0 0 8px 0;color:#ffffff;font-size:18px;font-weight:600;">All Set!</h3>
              <p style="margin:0;color:#ffffff;opacity:0.9;font-size:14px;">We look forward to seeing you at the event</p>
            </div>
            
            <!-- Contact -->
            <div style="text-align:center;padding:20px 0;border-top:1px solid #e7e3e0;">
              <p style="margin:0 0 6px 0;color:#52433a;font-size:12px;">Questions? Reply to this email</p>
              <p style="margin:0;color:#52433a;opacity:0.7;font-size:11px;">Thank you for choosing us!</p>
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
