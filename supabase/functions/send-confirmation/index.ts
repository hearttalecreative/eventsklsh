import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
      return new Response(JSON.stringify({ error: "Missing name or email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = `Your test ticket for ${eventTitle || "the event"}`;
    const html = `
      <h1>Thank you, ${name}!</h1>
      <p>This is a test purchase confirmation for <strong>${eventTitle || "the event"}</strong>.</p>
      <p>If you received this, Resend is correctly configured.</p>
    `;

    const response = await resend.emails.send({
      from: "Tickets <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
    });

    console.log("Resend response:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
});
