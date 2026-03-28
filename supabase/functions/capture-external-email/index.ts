import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { addContactToBrevo, determineLocationFromVenue } from "../_shared/brevo-contacts.ts";

interface RequestBody {
  email: string;
  eventId: string;
  eventTitle: string;
  venue: any;
}

serve(async (req) => {
  // CORS headers for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  try {
    const body: RequestBody = await req.json();
    const { email, eventId, eventTitle, venue } = body;

    console.log(`[External Email Capture] Processing request for event: ${eventTitle}`);

    // Validate required fields
    if (!email || !eventId) {
      console.error('[External Email Capture] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Email and eventId are required' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`[External Email Capture] Invalid email format: ${email}`);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[External Email Capture] Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean email
    const cleanEmail = email.toLowerCase().trim();

    // Get client IP and user agent for analytics
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Log the external email capture for analytics
    const { error: logError } = await supabase
      .from('external_email_captures')
      .insert({
        event_id: eventId,
        email: cleanEmail,
        captured_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent
      });

    if (logError) {
      console.error('[External Email Capture] Failed to log email capture:', logError);
      // Continue anyway - don't fail the request for analytics logging
    } else {
      console.log(`[External Email Capture] Logged capture for ${cleanEmail}`);
    }

    // Determine location for Brevo segmentation
    const location = determineLocationFromVenue(venue);
    console.log(`[External Email Capture] Determined location: ${location}`);
    
    // Add contact to Brevo (non-blocking)
    try {
      await addContactToBrevo(cleanEmail, 'External Lead', location);
      console.log(`[External Email Capture] Successfully added to Brevo: ${cleanEmail}`);
    } catch (brevoError) {
      console.error('[External Email Capture] Brevo error (non-blocking):', brevoError);
      // Don't fail the request if Brevo fails
    }

    console.log(`[External Email Capture] Successfully processed ${cleanEmail} for event: ${eventTitle}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email captured successfully',
        email: cleanEmail
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('[External Email Capture] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});