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

    const subject = `Confirmación de Ticket - ${eventTitle || "Evento"}`;
    const html = `
      <div style="background:hsl(35, 40%, 98%);padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;color:hsl(24, 30%, 15%);line-height:1.6;">
        <div style="max-width:600px;margin:0 auto;background:hsl(0, 0%, 100%);border-radius:16px;overflow:hidden;box-shadow:0 4px 12px -4px rgba(0,0,0,0.15);">
          
          <!-- Header -->
          <div style="background:linear-gradient(135deg, hsl(30, 60%, 42%) 0%, hsl(30, 55%, 35%) 100%);padding:40px 32px;text-align:center;">
            <div style="background:hsl(0, 0%, 100%);width:160px;height:50px;margin:0 auto 24px auto;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
              <div style="width:28px;height:28px;background:linear-gradient(135deg, hsl(30, 60%, 42%) 0%, hsl(30, 55%, 35%) 100%);border-radius:8px;margin-right:12px;"></div>
              <span style="font-weight:700;color:hsl(24, 30%, 15%);font-size:18px;">Events</span>
            </div>
            <h1 style="margin:0;font-size:32px;line-height:1.2;color:hsl(0, 0%, 100%);font-weight:700;">¡Gracias, ${name}!</h1>
            <p style="margin:16px 0 0 0;color:hsl(0, 0%, 100%);opacity:0.95;font-size:18px;font-weight:500;">Tu ticket ha sido confirmado</p>
          </div>
          
          <!-- Main Content -->
          <div style="padding:32px;">
            
            <!-- Event Information -->
            <div style="background:hsl(35, 30%, 96%);border:1px solid hsl(35, 18%, 88%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h2 style="margin:0 0 16px 0;font-size:24px;color:hsl(24, 30%, 15%);font-weight:600;">${eventTitle || "Evento"}</h2>
              ${eventDescription ? `<p style="margin:0 0 16px 0;color:hsl(24, 20%, 25%);font-size:16px;line-height:1.6;">${eventDescription}</p>` : ''}
              
              <div style="display:grid;gap:16px;margin-top:20px;">
                ${eventDate ? `
                <div style="display:flex;align-items:flex-start;color:hsl(24, 20%, 25%);font-size:16px;">
                  <span style="margin-right:12px;font-size:20px;margin-top:2px;">📅</span>
                  <div>
                    <strong style="color:hsl(24, 30%, 15%);">Fecha y Hora:</strong><br>
                    <span style="color:hsl(30, 60%, 42%);font-weight:500;">${formatEventDate(eventDate)}</span>
                  </div>
                </div>
                ` : ''}
                
                ${eventVenue ? `
                <div style="display:flex;align-items:flex-start;color:hsl(24, 20%, 25%);font-size:16px;">
                  <span style="margin-right:12px;font-size:20px;margin-top:2px;">📍</span>
                  <div>
                    <strong style="color:hsl(24, 30%, 15%);">Ubicación:</strong><br>
                    <span style="color:hsl(30, 60%, 42%);font-weight:500;">${eventVenue}</span>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- QR Code and Confirmation -->
            ${(qrCode || confirmationCode) ? `
            <div style="background:linear-gradient(135deg, hsl(30, 60%, 42%) 0%, hsl(30, 55%, 35%) 100%);border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
              <h3 style="margin:0 0 20px 0;color:hsl(0, 0%, 100%);font-size:22px;font-weight:600;">Tu Ticket</h3>
              
              ${qrCode ? `
              <div style="background:hsl(0, 0%, 100%);border-radius:12px;padding:20px;margin-bottom:20px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <div style="width:160px;height:160px;background:hsl(35, 30%, 96%);border:2px dashed hsl(30, 60%, 42%);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:52px;color:hsl(30, 60%, 42%);margin:0 auto;">
                  📱
                </div>
                <p style="margin:12px 0 0 0;color:hsl(24, 20%, 25%);font-size:13px;font-weight:500;">Código QR: ${qrCode}</p>
              </div>
              ` : ''}
              
              ${confirmationCode ? `
              <div style="background:hsl(0, 0%, 100%);color:hsl(30, 60%, 42%);padding:16px 24px;border-radius:10px;font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:3px;display:inline-block;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                ${confirmationCode}
              </div>
              ` : ''}
              
              <p style="margin:12px 0 0 0;color:hsl(0, 0%, 100%);opacity:0.95;font-size:15px;font-weight:500;">
                ${qrCode ? 'Presenta este código QR o código de confirmación en el check-in' : 'Presenta este código de confirmación en el evento'}
              </p>
            </div>
            ` : ''}

            <!-- Order Details -->
            ${orderDetails ? `
            <div style="background:hsl(35, 30%, 96%);border:1px solid hsl(35, 18%, 88%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 20px 0;font-size:20px;color:hsl(24, 30%, 15%);font-weight:600;">Detalles de la Compra</h3>
              
              <div style="margin-bottom:20px;">
                <strong style="color:hsl(24, 20%, 25%);">ID de Orden:</strong> 
                <span style="font-family:monospace;background:hsl(0, 0%, 100%);padding:4px 8px;border-radius:6px;color:hsl(30, 60%, 42%);font-weight:600;">${orderDetails.orderId}</span>
              </div>

              <!-- Tickets -->
              ${orderDetails.tickets?.length ? `
              <div style="margin-bottom:20px;">
                <h4 style="margin:0 0 12px 0;color:hsl(24, 30%, 15%);font-size:16px;font-weight:600;">Tickets:</h4>
                ${orderDetails.tickets.map(ticket => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid hsl(35, 18%, 88%);">
                    <div>
                      <span style="font-weight:600;color:hsl(24, 30%, 15%);">${ticket.name}</span>
                      <span style="color:hsl(24, 20%, 40%);margin-left:8px;">× ${ticket.quantity}</span>
                    </div>
                    <span style="font-weight:700;color:hsl(30, 60%, 42%);">${formatAmount(ticket.unitPrice * ticket.quantity, orderDetails.currency)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Add-ons -->
              ${orderDetails.addons?.length ? `
              <div style="margin-bottom:20px;">
                <h4 style="margin:0 0 12px 0;color:hsl(24, 30%, 15%);font-size:16px;font-weight:600;">Add-ons:</h4>
                ${orderDetails.addons.map(addon => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid hsl(35, 18%, 88%);">
                    <div>
                      <span style="font-weight:600;color:hsl(24, 30%, 15%);">${addon.name}</span>
                      <span style="color:hsl(24, 20%, 40%);margin-left:8px;">× ${addon.quantity}</span>
                    </div>
                    <span style="font-weight:700;color:hsl(30, 60%, 42%);">${formatAmount(addon.unitPrice * addon.quantity, orderDetails.currency)}</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <!-- Total -->
              <div style="border-top:2px solid hsl(30, 60%, 42%);padding-top:16px;margin-top:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:18px;font-weight:600;color:hsl(24, 30%, 15%);">Total:</span>
                  <span style="font-size:22px;font-weight:700;color:hsl(30, 60%, 42%);">${formatAmount(orderDetails.totalAmount, orderDetails.currency)}</span>
                </div>
              </div>
            </div>
            ` : ''}

            <!-- Customer Information -->
            <div style="background:hsl(35, 30%, 96%);border:1px solid hsl(35, 18%, 88%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 20px 0;font-size:20px;color:hsl(24, 30%, 15%);font-weight:600;">Información del Cliente</h3>
              
              <div style="display:grid;gap:12px;">
                <div><strong style="color:hsl(24, 30%, 15%);">Nombre:</strong> <span style="color:hsl(30, 60%, 42%);font-weight:500;">${name}</span></div>
                <div><strong style="color:hsl(24, 30%, 15%);">Email:</strong> <span style="color:hsl(30, 60%, 42%);font-weight:500;">${email}</span></div>
                ${phone ? `<div><strong style="color:hsl(24, 30%, 15%);">Teléfono:</strong> <span style="color:hsl(30, 60%, 42%);font-weight:500;">${phone}</span></div>` : ''}
              </div>
            </div>

            ${instructions ? `
            <!-- Event Instructions -->
            <div style="background:hsl(45, 100%, 96%);border:1px solid hsl(45, 86%, 83%);border-radius:12px;padding:24px;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;font-size:20px;color:hsl(30, 60%, 42%);font-weight:600;display:flex;align-items:center;">
                <span style="font-size:24px;margin-right:8px;">📋</span>
                Instrucciones Importantes
              </h3>
              <div style="color:hsl(24, 30%, 20%);font-size:16px;line-height:1.8;">
                ${formatInstructions(instructions)}
              </div>
            </div>
            ` : ''}
            
            <!-- Success Message -->
            <div style="background:linear-gradient(135deg, hsl(30, 60%, 42%) 0%, hsl(30, 55%, 35%) 100%);border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
              <div style="font-size:36px;margin-bottom:16px;">✨</div>
              <h3 style="margin:0 0 12px 0;color:hsl(0, 0%, 100%);font-size:22px;font-weight:600;">¡Todo listo!</h3>
              <p style="margin:0;color:hsl(0, 0%, 100%);opacity:0.95;font-size:16px;font-weight:500;">Esperamos verte en el evento</p>
            </div>
            
            <!-- Contact -->
            <div style="text-align:center;padding:24px 0;border-top:1px solid hsl(35, 18%, 88%);">
              <p style="margin:0 0 8px 0;color:hsl(24, 20%, 40%);font-size:14px;">¿Preguntas? Responde a este email</p>
              <p style="margin:0;color:hsl(24, 20%, 40%);opacity:0.8;font-size:12px;">¡Gracias por elegirnos!</p>
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
