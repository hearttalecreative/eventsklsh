import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const SUPABASE_URL = 'https://iorxmepjaqagfxnyptvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvcnhtZXBqYXFhZ2Z4bnlwdHZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NTc5MjcsImV4cCI6MjA3MDQzMzkyN30.DSeXkMOG6jfO4KQtbbO0dwNi-5LpLqWucMOFsReJMU4';
const APP_URL = 'https://events.kylelamsoundhealing.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detecta si el User-Agent es un bot de redes sociales
function isSocialBot(userAgent: string): boolean {
  const botPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'WhatsApp',
    'TelegramBot',
    'Slackbot',
    'SkypeUriPreview',
    'Googlebot',
    'bingbot'
  ];
  
  const ua = userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}

// Genera HTML con meta tags del evento
function generateEventHTML(event: any, venue: any): string {
  const eventUrl = `${APP_URL}/event/${event.slug}`;
  const imageUrl = event.image_url || 'https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg';
  const description = event.short_description || event.description?.substring(0, 160) || 'Buy tickets and discover Kyle Lam Sound Healing events.';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.title} | Kyle Lam Sound Healing</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="event">
  <meta property="og:url" content="${eventUrl}">
  <meta property="og:title" content="${event.title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="Kyle Lam Sound Healing">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${eventUrl}">
  <meta name="twitter:title" content="${event.title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Auto-redirect for browsers (in case bot gets through) -->
  <meta http-equiv="refresh" content="0;url=${eventUrl}">
  
  <link rel="canonical" href="${eventUrl}">
</head>
<body>
  <h1>${event.title}</h1>
  <p>${description}</p>
  ${venue ? `<p>Location: ${venue.name}</p>` : ''}
  <p>Redirecting to <a href="${eventUrl}">${eventUrl}</a>...</p>
  <script>
    window.location.href = '${eventUrl}';
  </script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Espera el slug como último segmento: /share-event/{slug}
    const slug = pathParts[pathParts.length - 1];
    
    if (!slug) {
      console.error('[share-event] No slug provided in URL');
      return new Response('Event not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    console.log(`[share-event] Processing request for slug: ${slug}`);

    // Crear cliente de Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Buscar el evento por slug
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        venues (*)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (eventError) {
      console.error('[share-event] Error fetching event:', eventError);
      return new Response('Error fetching event', { 
        status: 500,
        headers: corsHeaders 
      });
    }

    if (!event) {
      console.error(`[share-event] Event not found for slug: ${slug}`);
      return new Response('Event not found', { 
        status: 404,
        headers: corsHeaders 
      });
    }

    console.log(`[share-event] Event found: ${event.title}`);

    // Obtener User-Agent
    const userAgent = req.headers.get('user-agent') || '';
    console.log(`[share-event] User-Agent: ${userAgent}`);

    // Si es un bot, devolver HTML con meta tags
    if (isSocialBot(userAgent)) {
      console.log('[share-event] Bot detected, returning HTML with meta tags');
      const html = generateEventHTML(event, event.venues);
      return new Response(html, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Si es un usuario normal, redirigir a la URL real
    console.log('[share-event] Normal user, redirecting to event page');
    return new Response(null, {
      status: 301,
      headers: {
        ...corsHeaders,
        'Location': `${APP_URL}/event/${event.slug}`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('[share-event] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
