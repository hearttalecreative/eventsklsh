import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  eventId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId }: RequestBody = await req.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Client with user JWT to read auth context
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
        auth: { persistSession: false },
      }
    );

    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Service role client to bypass RLS once we've validated admin
    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Validate admin role using security definer function
    const { data: isAdmin, error: roleErr } = await service.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch attendees with ticket info (both purchased and comped)
    const { data: attendeeRows, error: attErr } = await service
      .from("attendees")
      .select(
        `id, name, email, phone, confirmation_code, checked_in_at, qr_code, order_item_id, comped_ticket_id, is_comped, ticket_label,
         order_item:order_item_id (order_id, ticket:ticket_id (name)),
         comped_ticket:comped_ticket_id (name)`
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (attErr) throw attErr;

    // Collect order_ids to load add-ons in batch
    const orderIds = Array.from(
      new Set(
        (attendeeRows || [])
          .map((a: any) => a.order_item?.order_id)
          .filter((v: string | null) => !!v)
      )
    );

    let addonsByOrder: Record<string, Array<{ name: string; quantity: number }>> = {};
    if (orderIds.length > 0) {
      const { data: addonRows, error: addErr } = await service
        .from("order_items")
        .select(`order_id, quantity, addon:addon_id (name)`)
        .in("order_id", orderIds)
        .not("addon_id", "is", null);
      if (addErr) throw addErr;
      for (const row of addonRows || []) {
        const list = addonsByOrder[row.order_id] || [];
        list.push({ name: row.addon.name, quantity: row.quantity });
        addonsByOrder[row.order_id] = list;
      }
    }

    const attendees = (attendeeRows || []).map((a: any) => {
      // Get ticket name from order_item, comped_ticket, or custom ticket_label
      let ticket = null;
      if (a.order_item?.ticket) {
        ticket = a.order_item.ticket;
      } else if (a.comped_ticket) {
        ticket = a.comped_ticket;
      } else if (a.ticket_label) {
        ticket = { name: a.ticket_label };
      }
      
      const addons = a.order_item?.order_id ? addonsByOrder[a.order_item.order_id] || [] : [];
      return {
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        confirmation_code: a.confirmation_code,
        checked_in_at: a.checked_in_at,
        qr_code: a.qr_code,
        ticket,
        addons,
      };
    });

    return new Response(
      JSON.stringify({ ok: true, attendees }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("[admin-list-attendees] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
