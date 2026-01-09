import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateCouponInput } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    
    // Validate and sanitize input
    const { eventId, code } = validateCouponInput(payload.eventId, payload.code);
    const buyerEmail = payload.email ? String(payload.email).toLowerCase().trim() : null;

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // code is already uppercased and sanitized by validateCouponInput

    // Prefer event-specific coupon over global; only admins can read coupons via service role
    const { data: coupons, error } = await supabaseService
      .from('coupons')
      .select('id, code, discount_percent, discount_amount_cents, apply_to, event_id, starts_at, ends_at, max_redemptions, active, one_per_customer, one_per_customer_per_event')
      .or(`event_id.eq.${eventId},event_id.is.null`)
      .ilike('code', code)
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
        return new Response(JSON.stringify({ valid: false, reason: 'max_redemptions_reached' }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // One per customer check (global - across all events)
    if (chosen.one_per_customer) {
      if (!buyerEmail) {
        // Cannot validate without email - require email for one_per_customer coupons
        return new Response(JSON.stringify({ 
          valid: false, 
          reason: 'email_required',
          message: 'Please enter participant email before applying this coupon'
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      
      const { count: emailCount, error: emailErr } = await supabaseService
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', chosen.id)
        .ilike('email', buyerEmail);
      
      if (emailErr) throw emailErr;
      
      if ((emailCount ?? 0) > 0) {
        return new Response(JSON.stringify({ 
          valid: false, 
          reason: 'already_used_by_email',
          message: 'You have already used this coupon'
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // One per customer per event check (allows same person to use once per different event)
    if (chosen.one_per_customer_per_event) {
      if (!buyerEmail) {
        return new Response(JSON.stringify({ 
          valid: false, 
          reason: 'email_required',
          message: 'Please enter participant email before applying this coupon'
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      
      // Check if this email already used this coupon for THIS specific event
      const { count: emailEventCount, error: emailEventErr } = await supabaseService
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', chosen.id)
        .eq('event_id', eventId)
        .ilike('email', buyerEmail);
      
      if (emailEventErr) throw emailEventErr;
      
      if ((emailEventCount ?? 0) > 0) {
        return new Response(JSON.stringify({ 
          valid: false, 
          reason: 'already_used_for_event',
          message: 'You have already used this coupon for this event'
        }), {
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
