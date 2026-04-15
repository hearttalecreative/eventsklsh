import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_REPORTS_EMAIL = 'info@kylelamsoundhealing.com';
const DEFAULT_EVENT_TIMEZONE = 'America/Los_Angeles';

const normalizeTimezone = (timezone?: string | null): string => {
  if (!timezone) return DEFAULT_EVENT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
};

interface ResendTicketEmailRequest {
  attendeeId: string;
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
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the user from the token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError || !roles?.some(r => r.role === 'admin')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body: ResendTicketEmailRequest = await req.json();
    const { attendeeId } = body;

    if (!attendeeId) {
      return new Response(
        JSON.stringify({ error: 'attendeeId is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use service-role client to bypass RLS on the orders join
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Get attendee data with related information
    // Note: order_items is left-joined (no !inner) so comped attendees without orders still work
    const { data: attendeeData, error: getAttendeeError } = await service
      .from('attendees')
      .select(`
        *,
        events!inner(*,venues(*)),
        order_items(
          id,
          ticket_id,
          quantity,
          orders(
            id,
            total_amount_cents,
            user_id,
            email,
            created_at
          ),
          tickets(name),
          addons(name)
        )
      `)
      .eq('id', attendeeId)
      .single();

    if (getAttendeeError || !attendeeData) {
      console.error('Get attendee error:', getAttendeeError);
      return new Response(
        JSON.stringify({ error: 'Attendee not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate that attendee has an email
    if (!attendeeData.email) {
      return new Response(
        JSON.stringify({ error: 'Attendee does not have an email address' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get Brevo API configuration
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL');
    const senderName = Deno.env.get('BREVO_SENDER_NAME');

    if (!brevoApiKey || !senderEmail || !senderName) {
      return new Response(
        JSON.stringify({ error: 'Email service configuration missing' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate QR code for check-in (reusing existing confirmation code)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${attendeeData.confirmation_code}`;

    const eventTimezone = normalizeTimezone(attendeeData.events.timezone);

    // Format event date in the event timezone
    const eventDateValue = new Date(attendeeData.events.starts_at);
    const eventDate = Number.isNaN(eventDateValue.getTime())
      ? String(attendeeData.events.starts_at)
      : new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: eventTimezone,
          timeZoneName: 'short',
        }).format(eventDateValue);

    // Prepare email content
    const emailSubject = `Your Ticket for ${attendeeData.events.title}`;
    // order_items is an array — safely grab the first item and its order
    const firstOrderItem = Array.isArray(attendeeData.order_items) ? attendeeData.order_items[0] : null;
    const order = firstOrderItem?.orders ?? null;
    const venue = attendeeData.events.venues;
    const orderDate = order?.created_at
      ? new Date(order.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: eventTimezone,
        })
      : null;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; color: white; }
          .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
          .ticket-info { background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .qr-section { text-align: center; background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #e0e0e0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
          .highlight { color: #667eea; font-weight: bold; }
          .alert-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
          h1 { margin: 0; font-size: 24px; }
          h2 { color: #667eea; margin-top: 0; }
          .ticket-detail { margin: 10px 0; }
          .ticket-detail strong { color: #333; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎵 Your Event Ticket</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Kyle Lam Sound Healing</p>
        </div>
        
        <div class="content">
          <div class="alert-box">
            <strong>📧 Ticket Resent:</strong> This is a resent copy of your ticket. Your original ticket is still valid.
          </div>
          
          <h2>${attendeeData.events.title}</h2>
          
          <div class="ticket-info">
            <div class="ticket-detail"><strong>Name:</strong> ${attendeeData.name || 'N/A'}</div>
            <div class="ticket-detail"><strong>Email:</strong> ${attendeeData.email}</div>
            ${attendeeData.phone ? `<div class="ticket-detail"><strong>Phone:</strong> ${attendeeData.phone}</div>` : ''}
            <div class="ticket-detail"><strong>Event Date:</strong> ${eventDate}</div>
            ${venue ? `<div class="ticket-detail"><strong>Venue:</strong> ${venue.name}${venue.address ? `, ${venue.address}` : ''}</div>` : ''}
            <div class="ticket-detail"><strong>Ticket Type:</strong> ${firstOrderItem?.tickets?.name || 'Standard'}</div>
            ${orderDate ? `<div class="ticket-detail"><strong>Order Date:</strong> ${orderDate}</div>` : ''}
          </div>

          ${attendeeData.events.instructions ? `
            <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <strong>📋 Event Instructions:</strong><br/>
              ${attendeeData.events.instructions.replace(/\n/g, '<br/>')}
            </div>
          ` : ''}
          
          <div class="qr-section">
            <h3 style="margin-top: 0;">🎫 Your Check-in QR Code</h3>
            <p>Show this QR code at the event for quick check-in</p>
            <img src="${qrCodeUrl}" alt="Check-in QR Code" style="max-width: 200px; height: auto;"/>
            <p style="font-family: monospace; font-size: 14px; color: #666; margin-top: 15px;">
              Confirmation Code: <strong>${attendeeData.confirmation_code}</strong>
            </p>
          </div>

          <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <strong>💡 Need Help?</strong><br/>
            If you have any questions or need to make changes to your ticket, please contact us at 
            <a href="mailto:${ADMIN_REPORTS_EMAIL}" style="color: #667eea;">${ADMIN_REPORTS_EMAIL}</a>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for joining us! 🙏</p>
          <p style="font-size: 12px; color: #999;">
            Kyle Lam Sound Healing<br/>
            This email was resent by an administrator.
          </p>
        </div>
      </body>
      </html>
    `;

    // Send email via Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: attendeeData.email,
            name: attendeeData.name || 'Event Attendee',
          },
        ],
        // Copy admin on resent tickets
        cc: [
          {
            email: ADMIN_REPORTS_EMAIL,
            name: 'Kyle Lam Sound Healing - Admin'
          }
        ],
        subject: `[RESENT] ${emailSubject}`,
        htmlContent: emailHtml,
      }),
    });

    if (!brevoResponse.ok) {
      const brevoError = await brevoResponse.text();
      console.error('Brevo API error:', brevoError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email via Brevo' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the admin activity
    try {
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: user.id,
          action: 'resend_ticket_email',
          resource_type: 'attendees',
          resource_id: attendeeId,
          details: {
            attendee_name: attendeeData.name,
            attendee_email: attendeeData.email,
            event_title: attendeeData.events.title,
            confirmation_code: attendeeData.confirmation_code
          }
        });
    } catch (logError) {
      console.error('Failed to log admin activity:', logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Ticket email resent successfully to ${attendeeData.email}`,
        attendee: {
          name: attendeeData.name,
          email: attendeeData.email,
          confirmation_code: attendeeData.confirmation_code
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in resend-ticket-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
