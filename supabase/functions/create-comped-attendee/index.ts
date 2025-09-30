import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_id, ticket_id, addon_ids = [], ticket_label = null, attendees } = await req.json();

    console.log('Creating comped attendees:', { event_id, ticket_id, addon_ids, count: attendees.length });

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, venues(*)')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    // Fetch addon details if any
    let addonsData: any[] = [];
    if (addon_ids.length > 0) {
      const { data: addons, error: addonsError } = await supabase
        .from('addons')
        .select('*')
        .in('id', addon_ids);
      
      if (!addonsError && addons) {
        addonsData = addons;
      }
    }

    // Process each attendee
    const createdAttendees = [];
    
    for (const attendeeData of attendees) {
      const { name, email, phone } = attendeeData;
      
      // Generate confirmation code and QR code for each attendee
      const confirmationCode = generateCode(10);
      const qrCode = generateQRCode();

      // Insert the comped attendee with is_comped flag
      const { data: attendee, error: attendeeError } = await supabase
        .from('attendees')
        .insert({
          event_id,
          name,
          email,
          phone,
          confirmation_code: confirmationCode,
          qr_code: qrCode,
          is_comped: true, // Mark as comped
          ticket_label: ticket_label, // Custom label for this attendee
          order_item_id: null // No order for comped attendees
        })
        .select()
        .single();

      if (attendeeError) {
        console.error('Error creating attendee:', attendeeError);
        throw attendeeError;
      }

      console.log('Attendee created:', attendee.id);
      createdAttendees.push(attendee);

      // Prepare email data for this attendee
      const attendeesForEmail = [{
        name,
        email,
        phone,
        confirmation_code: confirmationCode,
        qr_code: qrCode
      }];

      // Build order summary for email
      const orderSummary = {
        orderId: `COMP-${attendee.id.substring(0, 8).toUpperCase()}`,
        tickets: [{
          name: ticket.name,
          quantity: 1,
          unitPrice: 0 // Show as $0 for comped
        }],
        addons: addonsData.map(addon => ({
          name: addon.name,
          quantity: 1,
          unitPrice: 0 // Show as $0 for comped
        })),
        totalAmount: 0,
        currency: 'usd'
      };

      // Format venue information
      const venueInfo = event.venues 
        ? `${event.venues.name}${event.venues.address ? ', ' + event.venues.address : ''}`
        : null;

      // Invoke confirmation email function for each attendee
      const { error: emailError } = await supabase.functions.invoke('send-confirmation', {
        body: {
          email,
          name,
          phone,
          eventTitle: event.title,
          eventDescription: event.short_description || event.description,
          eventDate: event.starts_at,
          eventVenue: venueInfo,
          eventImageUrl: event.image_url,
          eventSlug: event.slug,
          instructions: event.instructions,
          confirmationCode: confirmationCode,
          qrCode: qrCode,
          orderDetails: orderSummary,
          is_comped: true // Flag to customize email message
        }
      });

      if (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the whole operation if email fails
      } else {
        console.log('Confirmation email sent successfully to:', email);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        attendees_created: createdAttendees.length,
        attendee_ids: createdAttendees.map(a => a.id)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in create-comped-attendee:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});

// Helper functions
function generateCode(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateQRCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `QR-${hex.toUpperCase()}`;
}
