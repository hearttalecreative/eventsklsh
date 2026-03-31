import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { addContactToBrevo, determineLocationFromVenue } from "../_shared/brevo-contacts.ts";

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

    const { event_id, ticket_id, addon_ids = [], ticket_label = null, attendees, internal_notes = null, force = false } = await req.json();

    console.log('Creating comped attendees:', { event_id, ticket_id, addon_ids, ticket_label, count: attendees.length, internal_notes });

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, venues(*)')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Fetch ticket details if ticket_id is provided (existing ticket)
    let ticket: any = null;
    if (ticket_id) {
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticket_id)
        .single();

      if (ticketError || !ticketData) {
        throw new Error('Ticket not found');
      }
      ticket = ticketData;
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

    // Check for existing paid tickets for each email
    const warnings: Array<{ email: string; message: string; existingCount: number }> = [];
    for (const attendeeData of attendees) {
      const { email } = attendeeData;
      
      // Check if this email already has a paid ticket for this event
      const { data: existingPaid, error: paidCheckErr } = await supabase
        .from('attendees')
        .select(`
          id,
          name,
          email,
          order_item_id,
          order_item:order_item_id (
            order:order_id (
              status
            )
          )
        `)
        .eq('event_id', event_id)
        .ilike('email', email)
        .not('order_item_id', 'is', null);
      
      if (!paidCheckErr && existingPaid && existingPaid.length > 0) {
        const paidTickets = existingPaid.filter((a: any) => 
          a.order_item?.order?.status === 'paid'
        );
        
        if (paidTickets.length > 0) {
          warnings.push({
            email,
            message: `Email ${email} already has ${paidTickets.length} paid ticket(s) for this event`,
            existingCount: paidTickets.length
          });
        }
      }
    }

    // If warnings exist and not forced, return them without creating attendees
    if (warnings.length > 0 && !force) {
      return new Response(
        JSON.stringify({ 
          success: false,
          warnings,
          message: 'Some attendees already have paid tickets for this event'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409 // Conflict status
        }
      );
    }

    let emailSent = false;
    let emailErrorResponse = null;

    // Process each attendee
    const createdAttendees: any[] = [];
    
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
          order_item_id: null, // No order for comped attendees
          comped_ticket_id: ticket_id, // Track which ticket type this comped attendee belongs to
          internal_notes: internal_notes // Admin notes for this attendee
        })
        .select()
        .single();

      if (attendeeError) {
        console.error('Error creating attendee:', attendeeError);
        throw attendeeError;
      }

      console.log('Attendee created:', attendee.id);
      createdAttendees.push(attendee);

      // Add attendee to Brevo contact list (non-blocking)
      const location = determineLocationFromVenue(event.venues);
      try {
        await addContactToBrevo(email, name, location);
      } catch (error) {
        console.error(`[Brevo] Failed to add comped attendee to Brevo:`, error);
      }

      // Build order summary for email
      const ticketNameForEmail = ticket ? ticket.name : (ticket_label || 'Complimentary Ticket');
      
      const orderSummary = {
        orderId: `COMP-${attendee.id.substring(0, 8).toUpperCase()}`,
        tickets: [{
          name: ticketNameForEmail,
          quantity: 1,
          unitPrice: 0
        }],
        addons: addonsData.map(addon => ({
          name: addon.name,
          quantity: 1,
          unitPrice: 0
        })),
        totalAmount: 0,
        currency: 'usd'
      };

      const postPurchaseInstructions = ticket?.post_purchase_instructions?.trim() || event.instructions;

      // Format venue information
      const venueInfo = event.venues 
        ? `${event.venues.name}${event.venues.address ? ', ' + event.venues.address : ''}`
        : null;

      try {
        // Use direct fetch for edge-to-edge invocation so we can pass the service role
        // key as the Authorization header — supabase.functions.invoke() from a
        // service-role client does not forward a JWT, which causes JWT verification
        // failures on the downstream send-confirmation function.
        const sendConfirmationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-confirmation`;
        const emailResp = await fetch(sendConfirmationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
          },
          body: JSON.stringify({
            email,
            name,
            phone,
            eventTitle: event.title,
            eventDescription: event.short_description || event.description,
            eventDate: event.starts_at,
            eventVenue: venueInfo,
            eventImageUrl: event.image_url,
            eventSlug: event.slug,
            instructions: postPurchaseInstructions,
            confirmationCode: confirmationCode,
            qrCode: qrCode,
            orderDetails: orderSummary,
            is_comped: true
          }),
        });

        if (!emailResp.ok) {
          const errText = await emailResp.text();
          console.error('Error sending confirmation email — HTTP', emailResp.status, errText);
          emailErrorResponse = `HTTP ${emailResp.status}: ${errText}`;
        } else {
          emailSent = true;
          console.log('Confirmation email sent successfully to:', email);
        }
      } catch (err: any) {
        console.error('Exception sending confirmation email:', err);
        emailErrorResponse = err.message || String(err);
      }
    } // End of for loop

    return new Response(
      JSON.stringify({ 
        success: true, 
        attendees_created: createdAttendees.length,
        attendee_ids: createdAttendees.map(a => a.id),
        emailSent,
        emailError: emailErrorResponse
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
