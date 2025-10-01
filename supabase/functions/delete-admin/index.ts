import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the JWT from the request header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the caller is a primary admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: isPrimary } = await supabaseAdmin.rpc('is_primary_admin', { _user_id: user.id });
    
    if (!isPrimary) {
      throw new Error("Only primary admin can delete admins");
    }

    const { userId } = await req.json();

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Check if trying to delete primary admin
    const { data: isTargetPrimary } = await supabaseAdmin.rpc('is_primary_admin', { _user_id: userId });
    
    if (isTargetPrimary) {
      throw new Error("Cannot delete the primary admin");
    }

    console.log("Deleting admin user:", userId);

    // First, reassign any events created by this user to the primary admin
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('created_by', userId);

    if (eventsError) {
      console.error("Error checking events:", eventsError);
      throw eventsError;
    }

    if (events && events.length > 0) {
      console.log(`Found ${events.length} events to reassign to primary admin`);
      
      // Reassign events to primary admin
      const { error: reassignError } = await supabaseAdmin
        .from('events')
        .update({ created_by: user.id })
        .eq('created_by', userId);

      if (reassignError) {
        console.error("Error reassigning events:", reassignError);
        throw reassignError;
      }
    }

    // Delete user (this will cascade to user_roles and profiles)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      throw deleteError;
    }

    console.log("Admin deleted successfully");

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in delete-admin function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});