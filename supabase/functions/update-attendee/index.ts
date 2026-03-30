import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UpdateAttendeeRequest {
  attendeeId: string;
  name?: string;
  email?: string;
  phone?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client with user JWT — only used to identify the calling user
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Get the user from the token
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client — bypasses RLS for admin checks and data operations
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Check admin role using the has_role() security definer RPC (same pattern as admin-list-attendees)
    const { data: isAdmin, error: roleError } = await service.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: UpdateAttendeeRequest = await req.json();
    const { attendeeId, name, email, phone } = body;

    if (!attendeeId) {
      return new Response(
        JSON.stringify({ error: 'attendeeId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current attendee data before update (for audit log)
    const { data: currentAttendee, error: getCurrentError } = await service
      .from('attendees')
      .select('*')
      .eq('id', attendeeId)
      .single();

    if (getCurrentError || !currentAttendee) {
      return new Response(
        JSON.stringify({ error: 'Attendee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare update data (only include fields that are provided)
    const updateData: Record<string, string | null> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No update fields provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update attendee using service client (bypasses RLS)
    const { data: updatedAttendee, error: updateError } = await service
      .from('attendees')
      .update(updateData)
      .eq('id', attendeeId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update attendee: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the admin activity (best-effort — don't fail if this errors)
    try {
      const changes = Object.keys(updateData).map(key => ({
        field: key,
        old_value: (currentAttendee as any)[key],
        new_value: (updateData as any)[key],
      }));

      await service
        .from('admin_activity_logs')
        .insert({
          admin_id: user.id,
          action: 'update_attendee',
          resource_type: 'attendees',
          resource_id: attendeeId,
          details: {
            attendee_name: updatedAttendee.name,
            attendee_email: updatedAttendee.email,
            changes,
          },
        });
    } catch (logError) {
      console.error('Failed to log admin activity:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        attendee: updatedAttendee,
        message: 'Attendee updated successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in update-attendee function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});