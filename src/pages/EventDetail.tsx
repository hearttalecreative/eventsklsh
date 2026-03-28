import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events } from '@/data/events';
import { EventItem, TicketType, Addon } from '@/types/events';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseEventDetail } from '@/hooks/useSupabaseEvents';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Facebook, Mail, MessageSquare, Send, Share2, Copy, CalendarDays, ExternalLink, Pause } from 'lucide-react';
import whatsappIcon from '@/assets/whatsapp.svg';
import GoogleMapDisplay from '@/components/GoogleMapDisplay';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';

function effectiveUnitAmount(ticket: TicketType, now = new Date()): number {
  if (
    ticket.earlyBirdAmountCents &&
    ticket.earlyBirdStart &&
    ticket.earlyBirdEnd &&
    now >= new Date(ticket.earlyBirdStart) &&
    now <= new Date(ticket.earlyBirdEnd)
  ) {
    return ticket.earlyBirdAmountCents;
  }
  return ticket.unitAmountCents;
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');

function formatEventSchedule(startsAt: string, endsAt?: string, timezone?: string) {
  const tz = timezone || 'America/Los_Angeles';
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : undefined;
  
  const dateFmt = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
  const timeFmt = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d).toLowerCase().replace(':00','');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).formatToParts(start);
  const tzName = parts.find(p=>p.type==='timeZoneName')?.value || '';
  
  // Check if event spans multiple days (compare dates in the target timezone)
  const startDate = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(start);
  const endDate = end ? new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(end) : startDate;
  
  if (end && startDate !== endDate) {
    // Multi-day event: "Sat, Dec 6, 2pm – Sun, Dec 7, 5pm PST"
    return `${dateFmt(start)}, ${timeFmt(start)} – ${dateFmt(end)}, ${timeFmt(end)} ${tzName}`;
  }
  
  // Single-day event: "Sat, Dec 6, 2pm – 5pm PST"
  const range = end ? `${timeFmt(start)} – ${timeFmt(end)}` : timeFmt(start);
  return `${dateFmt(start)}, ${range} ${tzName}`;
}
const EventDetail = () => {
  const { slugOrId } = useParams();
  const { data: dbEvent, loading } = useSupabaseEventDetail(slugOrId);
  const mockEvent: EventItem | undefined = useMemo(() => {
    if (!slugOrId) return undefined;
    return events.find((e) => e.id === slugOrId || e.slug === slugOrId || slugify(e.title) === slugOrId);
  }, [slugOrId]);
  // Only use mock data if loading is complete and no real data exists
  const event: EventItem | undefined = loading ? undefined : (dbEvent ?? mockEvent);

  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(event?.tickets[0]?.id);
  const selectedTicket = useMemo(() => event?.tickets.find((t) => t.id === selectedTicketId), [event, selectedTicketId]);
  const [quantityTickets, setQuantityTickets] = useState<number>(1);
  const participantsPerTicket = selectedTicket?.participantsPerTicket ?? 1;
  const participantsCount = quantityTickets * participantsPerTicket;

  useEffect(() => {
    if (event?.tickets?.[0]?.id) setSelectedTicketId(event.tickets[0].id);
  }, [event?.id]);

  // Check ticket availability when ticket or quantity changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (!selectedTicket?.id || quantityTickets < 1) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-ticket-availability', {
          body: { ticketId: selectedTicket.id, requestedQty: quantityTickets }
        });
        
        if (error) throw error;
        setTicketAvailability(data);
      } catch (err) {
        console.error('Failed to check ticket availability:', err);
        setTicketAvailability(null);
      }
    };
    
    checkAvailability();
  }, [selectedTicket?.id, quantityTickets]);

  const [addonsQty, setAddonsQty] = useState<Record<string, number>>({});

  const [participants, setParticipants] = useState(
    Array.from({ length: participantsCount }, () => ({ fullName: '', email: '', phone: '' }))
  );

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponValid, setCouponValid] = useState(false);
  const [couponInfo, setCouponInfo] = useState<null | { applyTo: 'tickets' | 'addons' | 'both'; discount: { type: 'percent' | 'amount'; value: number } }>(null);
  const [ticketAvailability, setTicketAvailability] = useState<{ available: boolean; remaining: number } | null>(null);

  // External ticket sales email capture modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [showFullDesc, setShowFullDesc] = useState(false);
  const { shortDesc, isLong } = useMemo(() => {
    const desc = event?.description || '';
    const words = desc.trim().split(/\s+/).filter(Boolean);
    return { shortDesc: words.slice(0, 100).join(' '), isLong: words.length > 100 };
  }, [event?.description]);

  useEffect(() => {
    // keep participants array length in sync
    setParticipants((prev) => {
      const next = Array.from({ length: participantsCount }, (_, i) => prev[i] ?? { fullName: '', email: '', phone: '' });
      return next;
    });
  }, [participantsCount]);

  // Show loading skeleton while loading
  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-lg overflow-hidden border bg-muted animate-pulse h-64"></div>
            <div className="space-y-4">
              <div className="bg-muted h-8 rounded w-3/4 animate-pulse"></div>
              <div className="bg-muted h-4 rounded w-1/2 animate-pulse"></div>
              <div className="grid gap-4">
                <div className="bg-muted h-16 rounded animate-pulse"></div>
                <div className="bg-muted h-16 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="p-6 border rounded-lg bg-card">
              <div className="bg-muted h-6 rounded w-1/3 mb-4 animate-pulse"></div>
              <div className="space-y-3">
                <div className="bg-muted h-16 rounded animate-pulse"></div>
                <div className="bg-muted h-16 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If not loading and no event, show not found
  if (!event) {
    return (
      <div className="container mx-auto py-16">
        <p className="text-muted-foreground">Event not found. <Link to="/" className="underline">Go back</Link></p>
      </div>
    );
  }

  // For sold-out or paused events without tickets, we still want to show the event
  // Only truly block if event exists but has no tickets AND is not in a special status
  const hasNoTicketsAndNotSpecialStatus = !selectedTicket && !['sold_out', 'paused'].includes(event.status);

  const endOrStart = new Date(event.endsAt || event.startsAt);
  const hasTickets = Array.isArray(event.tickets) && event.tickets.length > 0;
  const isPast = endOrStart < new Date();
  const isPaused = event.status === 'paused';
  const isSoldOut = event.status === 'sold_out';
  
  // Block ticket purchasing for events that are sold out, paused, past, or not published
  const canPurchaseTickets = hasTickets && !isPast && event.status === 'published';

  const currency = 'USD';
  const ticketUnit = selectedTicket ? effectiveUnitAmount(selectedTicket) : 0;
  const ticketsSubtotal = ticketUnit * quantityTickets;
  const addonsSubtotal = Object.entries(addonsQty).reduce((sum, [id, qty]) => {
    const addon = event.addons.find((a) => a.id === id);
    return sum + (addon ? addon.unitAmountCents * qty : 0);
  }, 0);

  let discount = 0;
  if (couponValid && couponInfo) {
    const baseTickets = ticketsSubtotal;
    const baseAddons = addonsSubtotal;
    const baseBoth = baseTickets + baseAddons;
    const { applyTo, discount: d } = couponInfo;
    const pct = d.type === 'percent' ? d.value : null;
    const amt = d.type === 'amount' ? d.value : null;
    if (pct != null) {
      if (applyTo === 'tickets') discount = Math.floor(baseTickets * (pct / 100));
      else if (applyTo === 'addons') discount = Math.floor(baseAddons * (pct / 100));
      else discount = Math.floor(baseBoth * (pct / 100));
    } else if (amt != null) {
      if (applyTo === 'tickets') discount = Math.min(amt, baseTickets);
      else if (applyTo === 'addons') discount = Math.min(amt, baseAddons);
      else discount = Math.min(amt, baseBoth);
    }
  }
  const subtotalAfterDiscount = ticketsSubtotal + addonsSubtotal - discount;
  const processingFee = Math.round(subtotalAfterDiscount * 0.035);
  const total = subtotalAfterDiscount + processingFee;


  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.shortDescription,
    image: [event.imageUrl],
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.venue.name,
      address: event.venue.address,
    },
    offers: event.tickets.map((t) => ({
      "@type": "Offer",
      url: typeof window !== 'undefined' ? window.location.href : '',
      price: (effectiveUnitAmount(t) / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: "https://schema.org/InStock",
      validFrom: t.earlyBirdStart || event.startsAt,
    })),
  };

  const fmtGcal = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const startStr = fmtGcal(event.startsAt);
  const endStr = fmtGcal(event.endsAt || new Date(new Date(event.startsAt).getTime() + 2*60*60*1000).toISOString());
  const locationStr = `${event.venue.name} — ${event.venue.address}`;
  const detailsStr = `${event.shortDescription || ''} ${typeof window !== 'undefined' ? window.location.href : ''}`.trim();
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(detailsStr)}&location=${encodeURIComponent(locationStr)}`;

  // Handle email submission for external ticket sales
  const handleEmailSubmit = async (email: string) => {
    setEmailSubmitting(true);
    
    try {
      const response = await supabase.functions.invoke('capture-external-email', {
        body: {
          email,
          eventId: event.id,
          eventTitle: event.title,
          venue: event.venue
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save email');
      }

      // Close modal and redirect to external URL
      setShowEmailModal(false);
      
      // Open external URL in new tab
      if (event.externalTicketUrl) {
        window.open(event.externalTicketUrl, '_blank', 'noopener,noreferrer');
      }
      
      toast.success('Redirecting to ticket purchase page...');
      
    } catch (error) {
      console.error('Email capture failed:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  // Handle external ticket sales button click
  const handleExternalTicketClick = () => {
    if (event.externalTicketSales) {
      setShowEmailModal(true);
    }
  };

const proceed = async () => {
    // basic validation
    if (!acceptedTerms) {
      toast.error('Please accept Terms and Conditions');
      return;
    }
    const invalid = participants.findIndex((p) => !p.fullName || !p.email || !p.phone);
    if (invalid !== -1) {
      toast.error(`Please complete participant #${invalid + 1}`);
      return;
    }

    // Check ticket availability before proceeding
    if (ticketAvailability && !ticketAvailability.available) {
      const message = ticketAvailability.remaining <= 5 && ticketAvailability.remaining > 0
        ? 'Almost sold out! Not enough tickets available for your selection.'
        : 'Not enough tickets available for your selection.';
      toast.error(message);
      return;
    }

    try {
      const cart = {
        eventId: event.id,
        ticketId: selectedTicket.id,
        ticketQty: quantityTickets,
        addons: Object.entries(addonsQty)
          .map(([id, qty]) => ({ id, qty: Number(qty) }))
          .filter((a) => (a.qty ?? 0) > 0),
        participants,
        coupon: couponValid ? (coupon || undefined) : undefined,
      };
      localStorage.setItem('lastCart', JSON.stringify(cart));

      const primary = participants[0];
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          currency: 'usd',
          buyer: { name: primary.fullName, email: primary.email },
          cart,
        },
      });
      
      console.log('[EventDetail] create-payment response:', { data, error });
      
      if (error) {
        console.error('[EventDetail] create-payment error:', error);
        throw new Error(error.message || 'Payment creation failed');
      }
      
      if (data?.error) {
        console.error('[EventDetail] create-payment returned error:', data.error);
        throw new Error(data.error);
      }
      
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        console.error('[EventDetail] No checkout URL in response:', data);
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('[EventDetail] Checkout error:', err);
      const errorMessage = err?.message || 'Failed to start checkout. Please try again.';
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <main className="container mx-auto py-8 md:py-10 space-y-8">
        <Helmet>
          <title>{event.title}</title>
        <meta name="description" content={event.shortDescription} />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta property="og:site_name" content="Kyle Lam Sound Healing" />
        <meta property="og:type" content="event" />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={event.shortDescription} />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : ''} />
        <meta property="og:image" content={event.imageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={event.title} />
        <meta name="twitter:description" content={event.shortDescription} />
        <meta name="twitter:image" content={event.imageUrl} />
        <script type="application/ld+json">{JSON.stringify(eventJsonLd)}</script>
      </Helmet>

      <div className="grid gap-8 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7 order-1">
          <div className="overflow-hidden rounded-none sm:rounded-2xl border-0 sm:border border-white/70 shadow-none sm:shadow-horizon-lg bg-white/70 -mx-4 sm:mx-0">
            <AspectRatio ratio={1230/693}>
              <img src={event.imageUrl} alt={`${event.title} image`} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
            </AspectRatio>
          </div>
          <article className="space-y-5">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 sm:gap-2 rounded-xl border border-border/80 bg-white/70 p-2 overflow-x-auto sm:overflow-visible w-full sm:w-fit">
            <Button variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="Share" onClick={() => {
              const shareUrl = `https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`;
              console.log('[EventDetail] Share URL:', shareUrl);
              console.log('[EventDetail] Event slug:', event.slug);
              if (navigator.share) {
                navigator.share({ title: event.title, text: event.shortDescription, url: shareUrl });
              } else {
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,'_blank');
              }
            }}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="Copy link" onClick={() => {
              const shareUrl = `https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`;
              navigator.clipboard.writeText(shareUrl).then(() => {
                toast.success('Link copied to clipboard!');
              }).catch(() => {
                toast.error('Failed to copy link');
              });
            }}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="Facebook">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`)}`} target="_blank" rel="noopener noreferrer">
                <Facebook className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="Email">
              <a href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent((event.shortDescription||'') + '\n' + `https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`)}`}>
                <Mail className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="SMS">
              <a href={`sms:?&body=${encodeURIComponent(event.title + ' - ' + `https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`)}`}>
                <MessageSquare className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="WhatsApp">
              <a href={`https://wa.me/?text=${encodeURIComponent(event.title + ' - ' + `https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`)}`} target="_blank" rel="noopener noreferrer">
                <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="Telegram">
              <a href={`https://t.me/share/url?url=${encodeURIComponent(`https://iorxmepjaqagfxnyptvb.supabase.co/functions/v1/share-event/${event.slug}`)}&text=${encodeURIComponent(event.title)}`} target="_blank" rel="noopener noreferrer">
                <Send className="w-4 h-4" />
              </a>
            </Button>
          </div>
          <Button asChild variant="outline" className="w-full min-h-11">
            <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 w-full">
              <CalendarDays className="h-4 w-4" />
              Add to Google Calendar
            </a>
          </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">Live booking</span>
              {isPast && <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider">Past event</span>}
              {isPaused && <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider">Paused</span>}
              {isSoldOut && <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider">Sold out</span>}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">{event.title}</h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-3xl">{event.shortDescription}</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl border border-border/80 bg-white/75 sm:col-span-2">
                <div className="text-muted-foreground">When</div>
                <div className="font-medium">{formatEventSchedule(event.startsAt, event.endsAt, event.timezone)}</div>
              </div>
              <div className="p-4 rounded-xl border border-border/80 bg-white/75 sm:col-span-2">
                <div className="text-muted-foreground">Venue</div>
                <div className="font-medium">{event.venue.name} — {event.venue.address}</div>
              </div>
              {/* Recurrence removed as requested */}
            </div>

            <div className="rounded-xl overflow-hidden border border-border/80 shadow-sm">
              <GoogleMapDisplay address={event.venue.address} name={`${event.title} — ${event.venue.name}`} />
            </div>
            <div className="prose max-w-none rounded-xl border border-border/70 bg-white/75 p-4 md:p-6">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  p: ({ children }) => <p className="mb-4">{children}</p>,
                  br: () => <br className="mb-2" />,
                  ul: ({ children }) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 list-decimal pl-6">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>
                }}
              >
                {(showFullDesc || !isLong) ? (event.description || '') : `${shortDesc}...`}
              </ReactMarkdown>
              {isLong && (
                <button type="button" className="mt-2 text-primary underline" onClick={() => setShowFullDesc((v) => !v)}>
                  {showFullDesc ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          </article>
        </div>

        <aside className="space-y-6 xl:col-span-5 xl:sticky xl:top-24 self-start order-2">
          {event.externalTicketSales ? (
            // External ticket sales UI
            <section className="p-6 border border-border/80 rounded-2xl bg-white/80 shadow-horizon animate-enter">
              <h2 className="text-xl font-semibold mb-4">Get Tickets</h2>
              <p className="text-muted-foreground mb-6">
                Tickets for this event are sold through an external platform. 
                Click below to purchase your tickets.
              </p>
              
              <Button 
                onClick={handleExternalTicketClick}
                className="w-full min-h-12 text-base"
                disabled={isPaused || isPast}
              >
                {isPaused ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Sales Paused
                  </>
                ) : isPast ? (
                  <>
                    Event Ended
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {event.externalTicketButtonText || 'Get Tickets'}
                  </>
                )}
              </Button>
              
              {isPaused && (
                <p className="text-sm text-muted-foreground text-center mt-3">
                  ⏸️ Ticket sales are temporarily paused.
                </p>
              )}
              
              {isPast && (
                <p className="text-sm text-muted-foreground text-center mt-3">
                  This event has already ended.
                </p>
              )}
            </section>
          ) : (
            // Internal ticket sales UI (existing)
            <>
              <section className="p-6 border border-border/80 rounded-2xl bg-white/80 shadow-horizon animate-enter">
                {!canPurchaseTickets && (
                    <div className="mb-4 p-3 rounded-lg bg-muted/70 border border-muted-foreground/20">
                    <p className="text-sm text-muted-foreground">
                      {event.status === 'sold_out' && '🎫 This event is sold out.'}
                      {event.status === 'paused' && '⏸️ Ticket sales are temporarily paused.'}
                      {event.status === 'draft' && 'This event is in draft mode.'}
                      {event.status === 'archived' && 'This event has been archived.'}
                      {isPast && 'This event has already ended.'}
                      {!hasTickets && !['sold_out', 'paused'].includes(event.status) && 'No tickets available for this event.'}
                      {canPurchaseTickets ? '' : ' Ticket purchasing is disabled.'}
                    </p>
                  </div>
                )}
                {hasTickets && selectedTicket ? (
              <>
                <h2 className="text-xl font-semibold mb-4">1. Choose tickets</h2>
                <div className="space-y-3">
                  {event.tickets.map((t) => {
                    const unit = effectiveUnitAmount(t);
                    const isSelected = selectedTicketId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTicketId(t.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/80 hover:bg-muted/50'}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{t.name}{t.zone ? ` — ${t.zone}` : ''}</div>
                            {t.description && (<div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{t.description}</div>)}
                            {isSelected && ticketAvailability && ticketAvailability.remaining <= 5 && ticketAvailability.remaining > 0 && (
                              <div className="text-xs font-medium mt-1 text-accent-foreground">
                                🔥 Almost Sold Out!
                              </div>
                            )}
                            {isSelected && ticketAvailability && ticketAvailability.remaining === 0 && (
                              <div className="text-xs text-destructive mt-1">
                                ⚠️ Sold out
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">Includes {t.participantsPerTicket || 1} participant{(t.participantsPerTicket || 1) > 1 ? 's' : ''} per ticket</div>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <div className="font-semibold">{formatCurrency(unit, 'USD')}</div>
                            {t.earlyBirdAmountCents && t.earlyBirdEnd && new Date() <= new Date(t.earlyBirdEnd) && (
                              <div className="text-xs text-accent-foreground bg-accent/20 inline-block px-2 py-0.5 rounded">Early bird</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-sm text-muted-foreground">Tickets</label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Decrease tickets"
                      onClick={() => setQuantityTickets((v) => clamp(v - 1, 1, selectedTicket.capacityTotal))}
                      disabled={!canPurchaseTickets || (ticketAvailability && ticketAvailability.remaining === 0)}>
                      −
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={ticketAvailability ? ticketAvailability.remaining : selectedTicket.capacityTotal}
                      value={quantityTickets}
                      onChange={(e) => {
                        const maxTickets = ticketAvailability ? ticketAvailability.remaining : selectedTicket.capacityTotal;
                        setQuantityTickets(clamp(parseInt(e.target.value || '1', 10), 1, maxTickets));
                      }}
                      className="w-20 h-11 text-center"
                      disabled={!canPurchaseTickets || (ticketAvailability && ticketAvailability.remaining === 0)}
                    />
                    <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Increase tickets"
                      onClick={() => {
                        const maxTickets = ticketAvailability ? ticketAvailability.remaining : selectedTicket.capacityTotal;
                        setQuantityTickets((v) => clamp(v + 1, 1, maxTickets));
                      }}
                      disabled={!canPurchaseTickets || (ticketAvailability && ticketAvailability.remaining === 0)}>
                      +
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">Participants: <span className="font-medium text-foreground">{participantsCount}</span></div>
                  {ticketAvailability && !ticketAvailability.available && (
                    <div className="w-full text-sm text-destructive">
                      {ticketAvailability.remaining <= 5 && ticketAvailability.remaining > 0 
                        ? '⚠️ Almost sold out! Not enough tickets available for your selection.'
                        : '⚠️ Not enough tickets available for your selection.'}
                    </div>
                  )}
                </div>
              </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No tickets are currently available for this event.</p>
                  </div>
                )}
              </section>

              {hasTickets && selectedTicket && (
            <>
              {event.addons.length > 0 && (
                <section className="p-6 border border-border/80 rounded-2xl bg-white/80 shadow-horizon animate-enter">
                  <h2 className="text-xl font-semibold mb-4">2. Add-ons</h2>
                  <div className="space-y-4">
                    {event.addons.map((a: Addon) => (
                      <div key={a.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                         <div className="min-w-0 flex-1">
                           <div className="font-medium">{a.name}</div>
                           {a.description && (
                             <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">{a.description}</p>
                           )}
                           <div className="text-sm text-muted-foreground mt-1">
                             {formatCurrency(a.unitAmountCents, currency)}
                             {(a as any).max_quantity_per_person && (
                               <span className="ml-2 text-xs">
                                 (Max {(a as any).max_quantity_per_person} per person)
                               </span>
                             )}
                           </div>
                         </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Decrease ${a.name}`}
                            onClick={() =>
                              setAddonsQty((prev) => ({ ...prev, [a.id]: Math.max((prev[a.id] ?? 0) - 1, 0) }))
                            }
                          >
                            −
                          </Button>
                            <Input
                              type="number"
                              min={0}
                              max={(a as any).max_quantity_per_person ? (a as any).max_quantity_per_person * participantsCount : undefined}
                             value={addonsQty[a.id] ?? 0}
                             onChange={(e) => {
                               const raw = parseInt(e.target.value || '0', 10);
                               const maxPerPerson = (a as any).max_quantity_per_person;
                               const max = maxPerPerson ? maxPerPerson * participantsCount : undefined;
                               const v = isNaN(raw) ? 0 : Math.max(raw, 0);
                               const finalValue = max ? Math.min(v, max) : v;
                               setAddonsQty((prev) => ({ ...prev, [a.id]: finalValue }));
                             }}
                              className="w-16 h-11 text-center"
                            />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Increase ${a.name}`}
                            onClick={() =>
                              setAddonsQty((prev) => {
                                const current = prev[a.id] ?? 0;
                                const maxPerPerson = (a as any).max_quantity_per_person;
                                const max = maxPerPerson ? maxPerPerson * participantsCount : undefined;
                                const newValue = current + 1;
                                return { ...prev, [a.id]: max ? Math.min(newValue, max) : newValue };
                              })
                            }
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}


              <section className="p-6 border border-border/80 rounded-2xl bg-white/80 shadow-horizon animate-enter">
                <h2 className="text-xl font-semibold mb-4">3. Participants</h2>
                <div className="divide-y">
                  {participants.map((p, i) => (
                    <div key={i} className="py-4">
                      <div className="text-sm font-medium mb-2">Participant #{i + 1}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`p-${i}-name`}>Full name</Label>
                           <Input
                             id={`p-${i}-name`}
                             placeholder="Name and last name"
                             value={p.fullName}
                             onChange={(e) => setParticipants((arr) => arr.map((v, idx) => (idx === i ? { ...v, fullName: e.target.value } : v)))}
                             className="h-11"
                             required
                           />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`p-${i}-email`}>Email</Label>
                           <Input
                             id={`p-${i}-email`}
                             type="email"
                             placeholder="name@example.com"
                             value={p.email}
                             onChange={(e) => setParticipants((arr) => arr.map((v, idx) => (idx === i ? { ...v, email: e.target.value } : v)))}
                             className="h-11"
                             required
                           />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`p-${i}-phone`}>Phone</Label>
                           <Input
                             id={`p-${i}-phone`}
                             placeholder="e.g. +1 555 555 5555"
                             value={p.phone}
                             onChange={(e) => setParticipants((arr) => arr.map((v, idx) => (idx === i ? { ...v, phone: e.target.value } : v)))}
                             className="h-11"
                             required
                           />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="p-6 border border-border/80 rounded-2xl bg-white/80 shadow-horizon animate-enter">
                <h2 className="text-xl font-semibold mb-4">4. Terms, Coupon & Summary</h2>
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(Boolean(v))} />
                  <label htmlFor="terms" className="text-sm">I accept the <a href="https://kylelamsoundhealing.com/refund-and-event-credit-policy/" target="_blank" rel="noopener noreferrer" className="underline">Refund Policy, Privacy Policy & Liability Waiver</a></label>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap sm:flex-nowrap">
                  <Input placeholder="Coupon code" value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponValid(false); }} className="max-w-xs h-11" />
                  <Button type="button" variant="outline" className="min-h-11" onClick={async () => {
                    if (!coupon) { toast.error('Enter a coupon'); return; }
                    const primaryEmail = participants[0]?.email?.toLowerCase().trim() || null;
                    try {
                      const { data, error } = await supabase.functions.invoke('validate-coupon', {
                        body: { eventId: event.id, code: coupon, email: primaryEmail }
                      });
                      if (error) throw error as any;
                      if (data?.valid) {
                        setCouponValid(true);
                        setCouponInfo(data.coupon || null);
                        toast.success('Coupon applied');
                      } else {
                        setCouponValid(false);
                        const errorMsg = data?.message || 'Invalid coupon';
                        toast.error(errorMsg);
                      }
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to validate coupon');
                    }
                  }}>Apply coupon</Button>
                </div>
                {discount > 0 && (
                  <p className="text-xs text-accent-foreground mb-3">You saved {formatCurrency(discount, currency)} with coupon {coupon.toUpperCase()}.</p>
                )}
                <p className="text-xs text-muted-foreground mt-2 mb-4">Coupons apply only to ticket value. Add-ons are not discounted.</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="text-muted-foreground truncate">{selectedTicket.name} × {quantityTickets} {participantsPerTicket > 1 ? `(includes ${participantsPerTicket} participants each)` : ''}</div>
                    <div className="font-medium">{formatCurrency(ticketsSubtotal, currency)}</div>
                  </div>
                  {Object.entries(addonsQty).filter(([_, qty]) => (qty ?? 0) > 0).map(([id, qty]) => {
                    const a = event.addons.find((x) => x.id === id)!;
                    return (
                      <div key={id} className="flex items-start justify-between pl-4">
                        <div className="text-muted-foreground truncate">{a.name} × {qty}</div>
                        <div>{formatCurrency(a.unitAmountCents * (qty ?? 0), currency)}</div>
                      </div>
                    );
                  })}
                  {discount > 0 && (
                    <div className="flex justify-between text-accent-foreground">
                      <span>Discount</span>
                      <span>-{formatCurrency(discount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Fee (3.5%)</span>
                    <span>{formatCurrency(processingFee, currency)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>
                </div>
                <Button className="w-full mt-4 min-h-11 text-base" onClick={proceed} disabled={!canPurchaseTickets}>Proceed to payment</Button>
                <p className="text-xs text-muted-foreground mt-2">You will be redirected to Stripe Checkout.</p>
              </section>
              </>
            )}
            </>
          )}

          {/* Email Capture Modal */}
          <EmailCaptureModal
            isOpen={showEmailModal}
            onClose={() => setShowEmailModal(false)}
            onSubmit={handleEmailSubmit}
            eventTitle={event.title}
            isLoading={emailSubmitting}
            buttonText={event.externalTicketButtonText}
          />
        </aside>
      </div>
    </main>
    </>
  );
};

export default EventDetail;
