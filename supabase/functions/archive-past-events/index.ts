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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const nowIso = new Date().toISOString();

    // Find all published events that have ended
    const { data: pastEvents, error: findError } = await supabase
      .from('events')
      .select('id, title, ends_at')
      .eq('status', 'published')
      .lt('ends_at', nowIso);

    if (findError) throw findError;

    if (!pastEvents || pastEvents.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No past events to archive",
          archived: 0
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Archive past events
    const eventIds = pastEvents.map(e => e.id);
    const { error: updateError } = await supabase
      .from('events')
      .update({ status: 'archived' })
      .in('id', eventIds);

    if (updateError) throw updateError;

    console.log(`Archived ${pastEvents.length} past events:`, pastEvents.map(e => e.title));

    return new Response(
      JSON.stringify({ 
        message: `Successfully archived ${pastEvents.length} past events`,
        archived: pastEvents.length,
        events: pastEvents.map(e => ({ id: e.id, title: e.title, ends_at: e.ends_at }))
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err: any) {
    console.error("Error archiving past events:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
