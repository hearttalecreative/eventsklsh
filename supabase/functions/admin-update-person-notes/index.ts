import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RecordType = "event" | "training";

interface RequestBody {
  recordType: RecordType;
  recordId: string;
  internalNotes?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json().catch(() => ({ recordId: "", recordType: "event" }));
    const { recordId, recordType, internalNotes } = body;

    if (!recordId || !recordType) {
      return new Response(JSON.stringify({ error: "recordId and recordType are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: isAdmin, error: roleError } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedNotes = internalNotes && internalNotes.trim().length > 0 ? internalNotes.trim() : null;

    const targetTable = recordType === "training" ? "training_purchases" : "attendees";
    const notesUpdatedAt = new Date().toISOString();

    let updateAttempt = await serviceClient
      .from(targetTable)
      .update({
        internal_notes: sanitizedNotes,
        internal_notes_updated_at: notesUpdatedAt,
      })
      .eq("id", recordId)
      .select("id, internal_notes, internal_notes_updated_at")
      .single();

    if (updateAttempt.error && updateAttempt.error.message?.includes("internal_notes_updated_at")) {
      updateAttempt = await serviceClient
        .from(targetTable)
        .update({ internal_notes: sanitizedNotes })
        .eq("id", recordId)
        .select("id, internal_notes")
        .single();
    }

    const updateError = updateAttempt.error;

    if (updateError) {
      if (updateError.message?.includes("internal_notes")) {
        return new Response(
          JSON.stringify({
            error: "Missing internal_notes column. Apply the latest database migration before editing notes.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      console.error("[admin-update-person-notes] update error", updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({
      ok: true,
      notesUpdatedAt: (updateAttempt.data as { internal_notes_updated_at?: string | null })?.internal_notes_updated_at || notesUpdatedAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin-update-person-notes] unexpected error", error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
