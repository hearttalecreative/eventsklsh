import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") || "";
const BREVO_SENDER_EMAIL = Deno.env.get("BREVO_SENDER_EMAIL") || "no-reply@example.com";
const BREVO_SENDER_NAME = Deno.env.get("BREVO_SENDER_NAME") || "Kyle Lam Sound Healing";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody =
  | {
      action: "lists";
    }
  | {
      action: "send";
      subject: string;
      htmlContent: string;
      listIds: number[];
      campaignName?: string | null;
    };

interface BrevoListRow {
  id: number;
  name: string;
  totalBlacklisted: number;
  totalSubscribers: number;
  uniqueSubscribers: number;
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function callBrevo(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.brevo.com${path}`, {
    ...init,
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
      ...(init.headers || {}),
    },
  });

  const payload = await readJsonSafely(response);
  if (!response.ok) {
    const errorText =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as Record<string, unknown>).message)
        : JSON.stringify(payload || {});
    throw new Error(`Brevo error ${response.status}: ${errorText}`);
  }

  return payload;
}

async function verifyAdmin(req: Request) {
  const authClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser();

  if (userErr || !user) {
    return { ok: false as const, response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }) };
  }

  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });

  const { data: isAdmin, error: roleErr } = await service.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (roleErr || !isAdmin) {
    return {
      ok: false as const,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }),
    };
  }

  return { ok: true as const, userId: user.id };
}

async function listBrevoLists() {
  const limit = 50;
  let offset = 0;
  let total = 0;
  const lists: BrevoListRow[] = [];

  do {
    const payload = (await callBrevo(`/v3/contacts/lists?limit=${limit}&offset=${offset}`)) as {
      count?: number;
      lists?: BrevoListRow[];
    };

    const chunk = payload.lists || [];
    total = payload.count || 0;
    lists.push(...chunk);

    if (chunk.length < limit) {
      break;
    }

    offset += limit;
  } while (lists.length < total);

  return lists;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!BREVO_API_KEY) {
      return new Response(JSON.stringify({ error: "BREVO_API_KEY is not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminCheck = await verifyAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body: RequestBody = await req.json();

    if (body.action === "lists") {
      const lists = await listBrevoLists();
      return new Response(
        JSON.stringify({
          ok: true,
          lists: lists
            .map((list) => ({
              id: list.id,
              name: list.name,
              totalSubscribers: list.totalSubscribers,
              uniqueSubscribers: list.uniqueSubscribers,
              totalBlacklisted: list.totalBlacklisted,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    if (body.action !== "send") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const subject = body.subject?.trim();
    const htmlContent = body.htmlContent?.trim();
    const campaignName = body.campaignName?.trim() || `Newsletter ${new Date().toISOString().slice(0, 10)}`;
    const listIds = Array.from(new Set((body.listIds || []).filter((id) => Number.isInteger(id) && id > 0)));

    if (!subject) {
      return new Response(JSON.stringify({ error: "Subject is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!htmlContent) {
      return new Response(JSON.stringify({ error: "HTML content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (listIds.length === 0) {
      return new Response(JSON.stringify({ error: "At least one Brevo list must be selected" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const campaign = (await callBrevo("/v3/emailCampaigns", {
      method: "POST",
      body: JSON.stringify({
        name: campaignName,
        subject,
        type: "classic",
        htmlContent,
        sender: {
          email: BREVO_SENDER_EMAIL,
          name: BREVO_SENDER_NAME,
        },
        recipients: {
          listIds,
        },
        inlineImageActivation: true,
      }),
    })) as { id?: number };

    if (!campaign?.id) {
      throw new Error("Brevo campaign was created without an id");
    }

    await callBrevo(`/v3/emailCampaigns/${campaign.id}/sendNow`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        campaignId: campaign.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("[brevo-newsletters] error", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
