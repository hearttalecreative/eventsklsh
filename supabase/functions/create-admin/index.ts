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
      throw new Error("Only primary admin can create new admins");
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    console.log("Creating new admin user:", email);

    // Create the new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    console.log("User created successfully:", newUser.user?.id);

    // Add admin role to user_roles table
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user!.id,
        role: "admin",
        is_primary: false,
      });

    if (roleError) {
      console.error("Error adding admin role:", roleError);
      throw roleError;
    }

    console.log("Admin role assigned successfully");

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user!.id,
        email: email,
        display_name: email.split("@")[0],
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user!.id,
          email: newUser.user!.email,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in create-admin function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});