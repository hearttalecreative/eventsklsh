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
  eventImageUrl?: string;
  eventSlug?: string;
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
    discountInfo?: {
      couponCode: string;
      discountAmount: number;
      originalAmount: number;
      finalAmount: number;
    };
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
      orderDetails,
      eventImageUrl,
      eventSlug 
    }: Payload = await req.json();
    console.log("send-confirmation invoked with:", { name, email, eventTitle, eventImageUrl });

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

    // Format event date with timezone support
    const formatEventDate = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      
      // Use the timezone from the event data or default to PST
      const timezone = 'America/Los_Angeles'; // PST/PDT timezone
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
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
      <div style="background:#ffffff;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell',sans-serif;color:#2c1810;line-height:1.6;">
        <div style="max-width:580px;margin:0 auto;">
          
          <!-- Header with Logo -->
          <div style="text-align:center;margin-bottom:48px;">
            <img src="https://kylelamsoundhealing.com/wp-content/uploads/2025/08/400px-1.png" alt="Kyle Lam Sound Healing" style="height:60px;width:auto;margin-bottom:24px;" />
            <h1 style="margin:0 0 12px 0;font-size:32px;line-height:1.2;color:#2c1810;font-weight:300;letter-spacing:-0.5px;">Thank you, ${name}</h1>
            <p style="margin:0;color:#8a7766;font-size:16px;font-weight:400;">Your Sound Healing journey awaits</p>
          </div>
          
          <!-- Event Information -->
          <div style="margin-bottom:40px;">
            <h2 style="margin:0 0 20px 0;font-size:24px;color:#2c1810;font-weight:300;letter-spacing:-0.3px;text-align:center;">${eventTitle || "Sound Healing Event"}</h2>
            
            ${eventImageUrl ? `
            <div style="text-align:center;margin-bottom:24px;">
              <img src="${eventImageUrl}" alt="${eventTitle || 'Event'}" style="max-width:100%;height:auto;border-radius:8px;max-height:300px;object-fit:cover;" />
            </div>
            ` : `
            <!-- No event image URL provided: ${eventImageUrl} -->
            `}
            
            ${eventDescription ? `<p style="margin:0 0 24px 0;color:#8a7766;font-size:16px;line-height:1.6;text-align:center;">${eventDescription}</p>` : ''}
            
            <div style="background:#fdfcfb;border-radius:8px;padding:24px;border:1px solid #f0ede8;">
              ${eventDate ? `
              <div style="margin-bottom:16px;text-align:center;">
                <p style="margin:0 0 4px 0;color:#8a7766;font-size:14px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Date & Time</p>
                <p style="margin:0;color:#2c1810;font-weight:400;font-size:16px;">${formatEventDate(eventDate)}</p>
                <div style="margin-top:12px;">
                  <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle || '')}&dates=${eventDate ? eventDate.replace(/[-:]/g, '').replace(/\.\d{3}/, '') : ''}/${eventDate ? new Date(new Date(eventDate).getTime() + 90*60*1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : ''}&details=${encodeURIComponent(eventDescription || '')}&location=${encodeURIComponent(eventVenue || '')}&ctz=America/Los_Angeles" 
                     target="_blank" 
                     style="display:inline-block;background:#a0662f;color:#ffffff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-right:8px;">
                    Add to Google Calendar
                  </a>
                </div>
              </div>
              ` : ''}
              
              ${eventVenue ? `
              <div style="text-align:center;${eventDate ? 'border-top:1px solid #f0ede8;padding-top:16px;' : ''}">
                <p style="margin:0 0 4px 0;color:#8a7766;font-size:14px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Location</p>
                <p style="margin:0;color:#2c1810;font-weight:400;font-size:16px;">${eventVenue}</p>
                <div style="margin-top:8px;">
                  <a href="https://maps.google.com/?q=${encodeURIComponent(eventVenue)}" 
                     target="_blank" 
                     style="color:#a0662f;text-decoration:none;font-size:14px;font-weight:500;border-bottom:1px solid #a0662f;">
                    View on Google Maps
                  </a>
                </div>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- QR Code and Confirmation -->
          ${(qrCode || confirmationCode) ? `
          <div style="text-align:center;margin-bottom:40px;">
            <h3 style="margin:0 0 24px 0;color:#2c1810;font-size:20px;font-weight:300;letter-spacing:-0.3px;">Your Event Ticket</h3>
            
            ${qrCode ? `
            <div style="background:#fdfcfb;border:1px solid #f0ede8;border-radius:12px;padding:32px;margin:0 auto 24px auto;max-width:280px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://events.kylelamsoundhealing.com/qr/${qrCode}`)}" 
                   alt="QR Code for check-in" 
                   style="width:180px;height:180px;display:block;margin:0 auto 20px auto;border-radius:8px;" />
              <div style="text-align:center;">
                <p style="margin:0;color:#8a7766;font-size:12px;font-weight:500;font-family:monospace;letter-spacing:1px;line-height:1.4;">${qrCode}</p>
              </div>
            </div>
            ` : ''}
            
            ${confirmationCode ? `
            <div style="background:#fdfcfb;border:1px solid #f0ede8;color:#2c1810;padding:16px 24px;border-radius:8px;font-family:monospace;font-size:18px;font-weight:600;letter-spacing:2px;display:inline-block;margin-bottom:16px;">
              ${confirmationCode}
            </div>
            ` : ''}
            
            <p style="margin:16px 0 0 0;color:#8a7766;font-size:14px;font-weight:400;line-height:1.5;">
              ${qrCode ? 'Present this QR code at check-in for your Sound Healing experience' : 'Present this confirmation code at the event'}
            </p>
          </div>
          ` : ''}

          <!-- Order Details -->
          ${orderDetails ? `
          <div style="background:#fdfcfb;border:1px solid #f0ede8;border-radius:8px;padding:24px;margin-bottom:32px;">
            <h3 style="margin:0 0 20px 0;font-size:18px;color:#2c1810;font-weight:300;text-align:center;">Order Summary</h3>
            
            <div style="margin-bottom:20px;text-align:center;">
              <span style="font-family:monospace;background:#ffffff;padding:8px 12px;border-radius:6px;color:#8a7766;font-weight:500;font-size:13px;border:1px solid #f0ede8;">${orderDetails.orderId}</span>
            </div>

            <!-- Tickets -->
            ${orderDetails.tickets?.length ? `
            <div style="margin-bottom:20px;">
              ${orderDetails.tickets.map(ticket => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0ede8;">
                  <div>
                    <span style="font-weight:400;color:#2c1810;font-size:15px;">${ticket.name}</span>
                    <span style="color:#8a7766;margin-left:8px;font-size:14px;">× ${ticket.quantity}</span>
                  </div>
                  <span style="font-weight:400;color:#2c1810;font-size:15px;">${formatAmount(ticket.unitPrice * ticket.quantity, orderDetails.currency)}</span>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <!-- Add-ons -->
            ${orderDetails.addons?.length ? `
            <div style="margin-bottom:20px;">
              ${orderDetails.addons.map(addon => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0ede8;">
                  <div>
                    <span style="font-weight:400;color:#2c1810;font-size:15px;">${addon.name}</span>
                    <span style="color:#8a7766;margin-left:8px;font-size:14px;">× ${addon.quantity}</span>
                  </div>
                  <span style="font-weight:400;color:#2c1810;font-size:15px;">${formatAmount(addon.unitPrice * addon.quantity, orderDetails.currency)}</span>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <!-- Discount Information -->
            ${orderDetails.discountInfo ? `
            <div style="margin-bottom:20px;padding:16px;background:#f9f7f4;border-radius:6px;border:1px solid #e8e2d8;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:14px;color:#8a7766;">Subtotal</span>
                <span style="font-size:14px;color:#2c1810;">${formatAmount(orderDetails.discountInfo.originalAmount, orderDetails.currency)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:14px;color:#a0662f;font-weight:500;">Discount (${orderDetails.discountInfo.couponCode})</span>
                <span style="font-size:14px;color:#a0662f;font-weight:500;">-${formatAmount(orderDetails.discountInfo.discountAmount, orderDetails.currency)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid #e8e2d8;">
                <span style="font-size:15px;color:#2c1810;font-weight:400;">Amount Paid</span>
                <span style="font-size:15px;color:#2c1810;font-weight:500;">${formatAmount(orderDetails.discountInfo.finalAmount, orderDetails.currency)}</span>
              </div>
            </div>
            ` : ''}

            <!-- Total -->
            <div style="border-top:1px solid #a0662f;padding-top:16px;margin-top:16px;text-align:center;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:16px;font-weight:400;color:#2c1810;">Total</span>
                <span style="font-size:18px;font-weight:500;color:#a0662f;">${formatAmount(orderDetails.totalAmount, orderDetails.currency)}</span>
              </div>
            </div>
          </div>
          ` : ''}

          ${instructions ? `
          <!-- Event Instructions -->
          <div style="background:#fdfcfb;border:1px solid #f0ede8;border-radius:8px;padding:24px;margin-bottom:32px;">
            <h3 style="margin:0 0 16px 0;font-size:18px;color:#2c1810;font-weight:300;text-align:center;">Important Information</h3>
            <div style="color:#2c1810;font-size:15px;line-height:1.7;text-align:center;">
              ${formatInstructions(instructions)}
            </div>
          </div>
          ` : ''}

          <!-- Invite Friends Section -->
          <div style="background:#fdfcfb;border:1px solid #f0ede8;border-radius:8px;padding:24px;margin-bottom:32px;text-align:center;">
            <h3 style="margin:0 0 16px 0;font-size:18px;color:#2c1810;font-weight:300;">Share this Experience</h3>
            <p style="margin:0 0 20px 0;color:#8a7766;font-size:15px;line-height:1.6;">
              Know someone who would love this Sound Healing experience? Forward this email to them!
            </p>
            <a href="mailto:?subject=${encodeURIComponent(`Join me at ${eventTitle || 'this Sound Healing event'}`)}&body=${encodeURIComponent(`Hi! I wanted to share this amazing Sound Healing event with you:\n\n${eventTitle || 'Sound Healing Event'}\n${eventDate ? `Date: ${formatEventDate(eventDate)}\n` : ''}${eventVenue ? `Location: ${eventVenue}\n` : ''}\n${eventDescription ? `\n${eventDescription}\n` : ''}\nI think you'd really enjoy this experience. Hope to see you there!\n\nFor more information, please visit https://kylelamsoundhealing.com`)}" 
               style="display:inline-block;background:#a0662f;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:500;">
              Forward this Email to Friends
            </a>
          </div>
          
          <!-- Footer -->
          <div style="text-align:center;padding:32px 0;border-top:1px solid #f0ede8;">
            <div style="margin-bottom:24px;">
              <p style="margin:0 0 8px 0;color:#2c1810;font-size:16px;font-weight:300;">Ready for your Sound Healing journey</p>
              <p style="margin:0;color:#8a7766;font-size:14px;">We look forward to welcoming you</p>
            </div>
            
            <div style="margin-bottom:24px;">
              <a href="https://kylelamsoundhealing.com" target="_blank" style="color:#a0662f;text-decoration:none;font-size:14px;font-weight:400;border-bottom:1px solid #a0662f;">Visit Kyle Lam Sound Healing →</a>
            </div>
            
            <img src="https://kylelamsoundhealing.com/wp-content/uploads/2025/08/400px-1.png" alt="Kyle Lam Sound Healing" style="height:32px;width:auto;opacity:0.7;" />
            <p style="margin:16px 0 0 0;color:#8a7766;font-size:12px;">Questions? Reply to this email</p>
          </div>
        </div>
        </div>
      </div>
    `;

    try {
      // Send email to the original recipient
      const response = await sendBrevoEmail(email, name, subject, html);
      console.log("Brevo response:", response);
      
      // Send copy to Info@kylelamsoundhealing.com
      try {
        const copySubject = `[COPY] ${subject} - ${name}`;
        const copyResponse = await sendBrevoEmail("Info@kylelamsoundhealing.com", "Kyle Lam Sound Healing", copySubject, html);
        console.log("Copy email sent to Info@kylelamsoundhealing.com:", copyResponse);
      } catch (copyError: any) {
        console.error("Failed to send copy email:", copyError?.message || String(copyError));
        // Don't fail the main request if copy email fails
      }
      
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
