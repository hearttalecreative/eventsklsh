import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .select(`
        id,
        slug,
        title,
        short_description,
        starts_at,
        ends_at,
        status,
        venues:venue_id ( name, address )
      `)
      .eq('status', 'published')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(8);

    if (error) throw error;

    const baseUrl = Deno.env.get('PUBLIC_SITE_URL') || '';

    const feed = (data || []).map((e: any) => ({
      name: e.title,
      startDate: e.starts_at,
      startTime: new Date(e.starts_at).toISOString(),
      endTime: e.ends_at ? new Date(e.ends_at).toISOString() : null,
      shortDescription: e.short_description,
      url: baseUrl ? `${baseUrl}/event/${e.slug ?? e.id}` : `/event/${e.slug ?? e.id}`,
      venue: e.venues?.name || null,
      venueAddress: e.venues?.address || null,
    }));

    return new Response(JSON.stringify(feed, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
