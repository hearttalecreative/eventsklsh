import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "no-reply@example.com";
const SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Event Admin";
const TRAINING_PENDING_EMAIL = "info@kylelamsoundhealing.com";
const TRAINING_PENDING_TYPE = "training_pending";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendBrevoEmail(toEmail: string, toName: string | null, subject: string, html: string) {
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: toEmail, name: toName ?? undefined }],
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

interface AdminEmailRequest {
  to: string | string[];
  subject: string;
  message: string;
  recipientName?: string | null;
  isBulk?: boolean;
  notificationType?: "training_pending" | "general";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[send-admin-email] invoked");

  try {
    if (!BREVO_API_KEY) {
      console.error("[send-admin-email] BREVO_API_KEY not configured");
      return new Response(JSON.stringify({ ok: false, error: "Email service not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { to, subject, message, recipientName, isBulk, notificationType }: AdminEmailRequest = await req.json();

    if (!to || !subject || !message) {
      return new Response(JSON.stringify({ ok: false, error: "Missing to, subject or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const toArray = Array.isArray(to) ? to : [to];
    const normalizedRecipients = toArray.map((email) => email.trim().toLowerCase());
    const includesTrainingPendingMailbox = normalizedRecipients.includes(TRAINING_PENDING_EMAIL);

    if (notificationType === TRAINING_PENDING_TYPE) {
      const allRecipientsAreTrainingMailbox = normalizedRecipients.every(
        (email) => email === TRAINING_PENDING_EMAIL,
      );
      if (!allRecipientsAreTrainingMailbox) {
        return new Response(JSON.stringify({
          ok: false,
          error: "training_pending notifications can only be sent to info@kylelamsoundhealing.com",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    console.log("[send-admin-email] sending to", {
      count: toArray.length,
      isBulk: !!isBulk,
      notificationType: notificationType || "general",
      includesTrainingPendingMailbox,
    });

    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const email of toArray) {
      try {
        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#2c1810;">
            ${!isBulk && recipientName ? `<p style="margin:0 0 16px 0;">Hi ${recipientName},</p>` : '<p style="margin:0 0 16px 0;">Hello,</p>'}
            <div style="background:#fdfcfb;border:1px solid #f0ede8;border-radius:8px;padding:16px;white-space:pre-wrap;line-height:1.7;">${message}</div>
            <p style="margin:24px 0 0 0;color:#8a7766;font-size:12px;">Sent via the event management system.</p>
          </div>
        `;
        const response = await sendBrevoEmail(email, recipientName ?? null, subject, html);
        console.log("[send-admin-email] sent to", email, response?.messageId || 'ok');
        results.push({ email, ok: true });
      } catch (e: any) {
        console.error("[send-admin-email] failed for", email, e?.message || String(e));
        results.push({ email, ok: false, error: e?.message || String(e) });
      }
    }

    const failed = results.filter(r => !r.ok);
    const okCount = results.length - failed.length;

    const status = failed.length > 0 ? 207 : 200; // 207: Multi-Status
    return new Response(JSON.stringify({ ok: failed.length === 0, sent: okCount, failed }), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-admin-email] CRITICAL ERROR:", error?.message || String(error));
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
