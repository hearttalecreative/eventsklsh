import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get next 4 upcoming published events with venue information
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        short_description,
        starts_at,
        slug,
        image_url,
        venues (
          name,
          address
        )
      `)
      .eq('status', 'published')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(4);

    if (error) {
      console.error('Error fetching events:', error);
      throw error;
    }

    // Format date for XML
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toISOString();
    };

    // Format date for human readable display
    const formatDisplayDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles'
      });
    };

    // Build XML feed
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Kyle Lam Sound Healing Events - Next 4 Events</title>
    <description>Next 4 Upcoming Sound Healing Events and Experiences</description>
    <link>https://events.kylelamsoundhealing.com</link>
    <atom:link href="https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/events-feed-top4" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Kyle Lam Sound Healing Events System</generator>
    ${events?.map(event => `
    <item>
      <title><![CDATA[${event.title}]]></title>
      <description><![CDATA[${event.short_description || event.title}
      
Fecha y hora: ${formatDisplayDate(event.starts_at)}]]></description>
      <link>https://events.kylelamsoundhealing.com/event/${event.slug}</link>
      <guid>https://events.kylelamsoundhealing.com/event/${event.slug}</guid>
      <pubDate>${formatDate(event.starts_at)}</pubDate>
      <category>Sound Healing</category>
      ${event.venues ? `<location><![CDATA[${event.venues.name}${event.venues.address ? ` — ${event.venues.address}` : ''}]]></location>` : ''}
      ${event.image_url ? `<imageUrl><![CDATA[${event.image_url}]]></imageUrl>` : ''}
      <eventDate>${formatDate(event.starts_at)}</eventDate>
      <ticketUrl>https://events.kylelamsoundhealing.com/event/${event.slug}</ticketUrl>
    </item>`).join('') || ''}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error('Error in events-feed-top4:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<error>
  <message>Error generating feed: ${error.message}</message>
</error>`,
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});