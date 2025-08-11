import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  eventId: string;
  code: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, code } = (await req.json()) as Payload;
    if (!eventId || !code) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const codeUpper = code.trim().toUpperCase();

    // Prefer event-specific coupon over global; only admins can read coupons via service role
    const { data: coupons, error } = await supabaseService
      .from('coupons')
      .select('id, code, discount_percent, discount_amount_cents, apply_to, event_id, starts_at, ends_at, max_redemptions, active')
      .or(`event_id.eq.${eventId},event_id.is.null`)
      .ilike('code', codeUpper)
      .eq('active', true)
      .order('event_id', { ascending: false, nullsFirst: false });

    if (error) throw error;

    const now = new Date();
    let chosen = (coupons || []).find(c => c.event_id === eventId) || (coupons || []).find(c => c.event_id === null);

    if (!chosen) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Date window check
    if (chosen.starts_at && new Date(chosen.starts_at) > now) chosen = undefined as any;
    if (chosen && chosen.ends_at && new Date(chosen.ends_at) < now) chosen = undefined as any;

    if (!chosen) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Usage limit check (total across all events)
    if (chosen.max_redemptions != null) {
      const { count, error: cntErr } = await supabaseService
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', chosen.id);
      if (cntErr) throw cntErr;
      if ((count ?? 0) >= chosen.max_redemptions) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const discount = chosen.discount_percent != null
      ? { type: 'percent', value: chosen.discount_percent }
      : chosen.discount_amount_cents != null
        ? { type: 'amount', value: chosen.discount_amount_cents }
        : null;

    return new Response(JSON.stringify({
      valid: true,
      coupon: {
        id: chosen.id,
        code: chosen.code,
        applyTo: chosen.apply_to,
        eventId: chosen.event_id,
        discount,
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error('validate-coupon error', err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
