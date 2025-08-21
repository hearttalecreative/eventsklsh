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

    const subject = `Ticket Confirmation - ${eventTitle || "Event"}`;
    const html = `
      <div style="background:hsl(210, 20%, 98%);padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:hsl(222, 84%, 4%);line-height:1.6;">
        <div style="max-width:600px;margin:0 auto;background:hsl(0, 0%, 100%);border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(262, 83%, 58%) 100%);padding:40px 32px;text-align:center;">
            <div style="background:hsl(0, 0%, 100%);width:140px;height:40px;margin:0 auto 20px auto;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
              <div style="width:24px;height:24px;background:linear-gradient(135deg, hsl(221, 83%, 53%) 0%, hsl(262, 83%, 58%) 100%);border-radius:6px;margin-right:8px;"></div>
              <span style="font-weight:700;color:hsl(222, 84%, 4%);font-size:16px;">Events</span>
            </div>
            <h1 style="margin:0;font-size:32px;line-height:1.2;color:hsl(0, 0%, 100%);font-weight:700;">Thank you, ${name}!</h1>
            <p style="margin:16px 0 0 0;color:hsl(0, 0%, 100%);opacity:0.9;font-size:18px;font-weight:500;">Your tickets have been confirmed</p>
          </div>
          
          <!-- Main Content -->
          <div style="padding:32px;">
            
            <!-- Event Information -->
            <div style="background:hsl(210, 40%, 98%);border:1px solid hsl(214, 32%, 91%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="margin:0 0 16px 0;font-size:24px;color:hsl(222, 84%, 4%);font-weight:600;">${eventTitle || "Event"}</h2>
              ${eventDescription ? `<p style="margin:0 0 16px 0;color:hsl(215, 13%, 34%);font-size:16px;line-height:1.6;">${eventDescription}</p>` : ''}
              
              <div style="display:grid;gap:12px;margin-top:16px;">
                ${eventDate ? `
                <div style="display:flex;align-items:center;color:hsl(215, 13%, 34%);font-size:16px;">
                  <span style="margin-right:12px;font-size:20px;">📅</span>
                  <div>
                    <strong>Date & Time:</strong><br>
                    <span style="color:hsl(215, 25%, 27%);">${formatEventDate(eventDate)}</span>
                  </div>
                </div>
                ` : ''}
                
                ${eventVenue ? `
                <div style="display:flex;align-items:center;color:hsl(215, 13%, 34%);font-size:16px;">
                  <span style="margin-right:12px;font-size:20px;">📍</span>
                  <div>
                    <strong>Location:</strong><br>
                    <span style="color:hsl(215, 25%, 27%);">${eventVenue}</span>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- QR Code and Confirmation -->
            ${(qrCode || confirmationCode) ? `
            <div style="background:hsl(142, 76%, 36%);background:linear-gradient(135deg, hsl(142, 76%, 36%) 0%, hsl(158, 64%, 52%) 100%);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;color:hsl(0, 0%, 100%);font-size:20px;font-weight:600;">Your Ticket</h3>
              
              ${qrCode ? `
              <div style="background:hsl(0, 0%, 100%);border-radius:12px;padding:16px;margin-bottom:16px;display:inline-block;">
                <div style="width:150px;height:150px;background:hsl(210, 40%, 98%);border:2px dashed hsl(214, 32%, 91%);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:48px;color:hsl(215, 13%, 34%);margin:0 auto;">
                  📱
                </div>
                <p style="margin:8px 0 0 0;color:hsl(215, 13%, 34%);font-size:12px;">QR Code: ${qrCode}</p>
              </div>
              ` : ''}
              
              ${confirmationCode ? `
              <div style="background:hsl(0, 0%, 100%);color:hsl(142, 76%, 36%);padding:12px 20px;border-radius:8px;font-family:monospace;font-size:20px;font-weight:bold;letter-spacing:2px;display:inline-block;margin-bottom:8px;">
                ${confirmationCode}
              </div>
              ` : ''}
              
              <p style="margin:8px 0 0 0;color:hsl(0, 0%, 100%);opacity:0.9;font-size:14px;">
                ${qrCode ? 'Show this QR code or confirmation code at check-in' : 'Present this confirmation code at the event'}
              </p>
            </div>
            ` : ''}

            <!-- Order Details -->
            ${orderDetails ? `
            <div style="background:hsl(210, 40%, 98%);border:1px solid hsl(214, 32%, 91%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;font-size:20px;color:hsl(222, 84%, 4%);font-weight:600;">Order Details</h3>
              
              <div style="margin-bottom:16px;">
                <strong style="color:hsl(215, 13%, 34%);">Order ID:</strong> 
                <span style="font-family:monospace;background:hsl(210, 40%, 98%);padding:2px 6px;border-radius:4px;">${orderDetails.orderId}</span>
              </div>

              <!-- Tickets -->
              ${orderDetails.tickets?.length ? `
              <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0;color:hsl(215, 13%, 34%);font-size:16px;font-weight:600;">Tickets:</h4>
                ${orderDetails.tickets.map(ticket => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid hsl(214, 32%, 91%);">
                    <div>
                      <span style="font-weight:500;">${ticket.name}</span>
                      <span style="color:hsl(215, 13%, 34%);margin-left:8px;">× ${ticket.quantity}</span>
                    </div>
                    <span style="font-weight:600;">${formatAmount(ticket.unitPrice * ticket.quantity, orderDetails.currency)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Add-ons -->
              ${orderDetails.addons?.length ? `
              <div style="margin-bottom:16px;">
                <h4 style="margin:0 0 8px 0;color:hsl(215, 13%, 34%);font-size:16px;font-weight:600;">Add-ons:</h4>
                ${orderDetails.addons.map(addon => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid hsl(214, 32%, 91%);">
                    <div>
                      <span style="font-weight:500;">${addon.name}</span>
                      <span style="color:hsl(215, 13%, 34%);margin-left:8px;">× ${addon.quantity}</span>
                    </div>
                    <span style="font-weight:600;">${formatAmount(addon.unitPrice * addon.quantity, orderDetails.currency)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Total -->
              <div style="border-top:2px solid hsl(214, 32%, 91%);padding-top:16px;margin-top:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:18px;font-weight:600;color:hsl(222, 84%, 4%);">Total:</span>
                  <span style="font-size:20px;font-weight:700;color:hsl(142, 76%, 36%);">${formatAmount(orderDetails.totalAmount, orderDetails.currency)}</span>
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Customer Information -->
            <div style="background:hsl(210, 40%, 98%);border:1px solid hsl(214, 32%, 91%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;font-size:20px;color:hsl(222, 84%, 4%);font-weight:600;">Customer Information</h3>
              
              <div style="display:grid;gap:8px;">
                <div><strong style="color:hsl(215, 13%, 34%);">Name:</strong> ${name}</div>
                <div><strong style="color:hsl(215, 13%, 34%);">Email:</strong> ${email}</div>
                ${phone ? `<div><strong style="color:hsl(215, 13%, 34%);">Phone:</strong> ${phone}</div>` : ''}
              </div>
            </div>

            ${instructions ? `
            <!-- Event Instructions -->
            <div style="background:hsl(47, 91%, 97%);border:1px solid hsl(48, 96%, 89%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;font-size:20px;color:hsl(25, 95%, 53%);font-weight:600;display:flex;align-items:center;">
                <span style="font-size:24px;margin-right:8px;">📋</span>
                Important Instructions
              </h3>
              <div style="color:hsl(26, 83%, 14%);font-size:16px;line-height:1.8;">
                ${formatInstructions(instructions)}
              </div>
            </div>
            ` : ''}
            
            <!-- Success Message -->
            <div style="background:linear-gradient(135deg, hsl(142, 76%, 36%) 0%, hsl(158, 64%, 52%) 100%);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <div style="font-size:32px;margin-bottom:12px;">✨</div>
              <h3 style="margin:0 0 8px 0;color:hsl(0, 0%, 100%);font-size:20px;font-weight:600;">You're all set!</h3>
              <p style="margin:0;color:hsl(0, 0%, 100%);opacity:0.9;font-size:16px;">We can't wait to see you at the event</p>
            </div>
            
            <!-- Contact -->
            <div style="text-align:center;padding:20px 0;border-top:1px solid hsl(214, 32%, 91%);">
              <p style="margin:0 0 8px 0;color:hsl(215, 13%, 34%);font-size:14px;">Questions? Reply to this email</p>
              <p style="margin:0;color:hsl(215, 13%, 34%);opacity:0.7;font-size:12px;">Thank you for choosing us!</p>
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
