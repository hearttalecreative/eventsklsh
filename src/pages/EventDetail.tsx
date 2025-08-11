import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events } from '@/data/events';
import { EventItem, TicketType, Addon } from '@/types/events';
import MapLeaflet from '@/components/MapLeaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseEventDetail } from '@/hooks/useSupabaseEvents';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Facebook, Mail, MessageSquare, MessageCircle, Send, Share2 } from 'lucide-react';

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

const EventDetail = () => {
  const { id } = useParams();
  const { data: dbEvent } = useSupabaseEventDetail(id);
  const mockEvent: EventItem | undefined = useMemo(() => events.find((e) => e.id === id), [id]);
  const event: EventItem | undefined = dbEvent ?? mockEvent;

  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(event?.tickets[0]?.id);
  const selectedTicket = useMemo(() => event?.tickets.find((t) => t.id === selectedTicketId), [event, selectedTicketId]);
  const [quantityTickets, setQuantityTickets] = useState<number>(1);
  const participantsPerTicket = selectedTicket?.participantsPerTicket ?? 1;
  const participantsCount = quantityTickets * participantsPerTicket;

  useEffect(() => {
    if (event?.tickets?.[0]?.id) setSelectedTicketId(event.tickets[0].id);
  }, [event?.id]);

  const [addonsQty, setAddonsQty] = useState<Record<string, number>>({});

  const [participants, setParticipants] = useState(
    Array.from({ length: participantsCount }, () => ({ fullName: '', email: '', phone: '' }))
  );

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponValid, setCouponValid] = useState(false);

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

  if (!event || !selectedTicket) {
    return (
      <div className="container mx-auto py-16">
        <p className="text-muted-foreground">Event not found. <Link to="/" className="underline">Go back</Link></p>
      </div>
    );
  }

  const endOrStart = new Date(event.endsAt || event.startsAt);
  const isArchived = event.status === 'archived';
  const hasTickets = Array.isArray(event.tickets) && event.tickets.length > 0;
  const isPast = endOrStart < new Date();
  if (!hasTickets || isArchived || isPast) {
    return (
      <main className="container mx-auto py-16">
        <Helmet>
          <title>Evento no disponible | Events</title>
          <meta name="robots" content="noindex,follow" />
          <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
        </Helmet>
        <div className="max-w-xl mx-auto text-center space-y-4">
          <h1 className="text-3xl font-bold">Este evento no se encuentra disponible</h1>
          <p className="text-muted-foreground">Puede que no tenga tickets, esté archivado o ya haya pasado la fecha.</p>
          <Button asChild>
            <Link to="/">Ver todos los eventos</Link>
          </Button>
        </div>
      </main>
    );
  }

  const currency = selectedTicket.currency;
  const ticketUnit = effectiveUnitAmount(selectedTicket);
  const ticketsSubtotal = ticketUnit * quantityTickets;
  const addonsSubtotal = Object.entries(addonsQty).reduce((sum, [id, qty]) => {
    const addon = event.addons.find((a) => a.id === id);
    return sum + (addon ? addon.unitAmountCents * qty : 0);
  }, 0);

  const discount = couponValid ? Math.round((ticketsSubtotal) * 0.5) : 0; // 50% demo (tickets only)
  const total = ticketsSubtotal + addonsSubtotal - discount;


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
      priceCurrency: t.currency.toUpperCase(),
      availability: "https://schema.org/InStock",
      validFrom: t.earlyBirdStart || event.startsAt,
    })),
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
          currency: 'mxn',
          buyer: { name: primary.fullName, email: primary.email },
          cart,
        },
      });
      if (error) throw error as any;
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start checkout');
    }
  };

  const testPurchase = async () => {
    if (!acceptedTerms) {
      toast.error('Please accept Terms and Conditions');
      return;
    }
    const invalid = participants.findIndex((p) => !p.fullName || !p.email || !p.phone);
    if (invalid !== -1) {
      toast.error(`Please complete participant #${invalid + 1}`);
      return;
    }
    const primary = participants[0];
    try {
      const { error } = await supabase.functions.invoke('send-confirmation', {
        body: { name: primary.fullName, email: primary.email, eventTitle: event.title },
      });
      if (error) throw error as any;
      toast.success('Test email sent. Please check your inbox.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send test email');
    }
  };
  return (
    <main className="container mx-auto py-10 space-y-10">
      <Helmet>
        <title>{`${event.title} | Events`}</title>
        <meta name="description" content={event.shortDescription} />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
        <script type="application/ld+json">{JSON.stringify(eventJsonLd)}</script>
      </Helmet>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-lg overflow-hidden border">
            <img src={event.imageUrl} alt={`${event.title} image`} className="w-full h-64 object-cover" loading="lazy" decoding="async" />
          </div>
          <article className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Share" onClick={() => {
              if (navigator.share) {
                navigator.share({ title: event.title, text: event.shortDescription, url: typeof window !== 'undefined' ? window.location.href : '' });
              } else {
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`,'_blank');
              }
            }}>
              <Share2 className="w-4 h-4" />
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Facebook">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`} target="_blank" rel="noopener noreferrer">
                <Facebook className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Email">
              <a href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent((event.shortDescription||'') + '\n' + (typeof window !== 'undefined' ? window.location.href : ''))}`}>
                <Mail className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="SMS">
              <a href={`sms:?&body=${encodeURIComponent(event.title + ' - ' + (typeof window !== 'undefined' ? window.location.href : ''))}`}>
                <MessageSquare className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="WhatsApp">
              <a href={`https://wa.me/?text=${encodeURIComponent(event.title + ' - ' + (typeof window !== 'undefined' ? window.location.href : ''))}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label="Telegram">
              <a href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(event.title)}`} target="_blank" rel="noopener noreferrer">
                <Send className="w-4 h-4" />
              </a>
            </Button>
          </div>
            <h1 className="text-4xl font-bold">{event.title}</h1>
            <p className="text-muted-foreground">{event.shortDescription}</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-muted-foreground">Starts</div>
                <div className="font-medium">{new Date(event.startsAt).toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-muted-foreground">Ends</div>
                <div className="font-medium">{new Date(event.endsAt).toLocaleString()}</div>
              </div>
              <div className="p-4 rounded-lg border bg-card sm:col-span-2">
                <div className="text-muted-foreground">Venue</div>
                <div className="font-medium">{event.venue.name} — {event.venue.address}</div>
              </div>
              {/* Recurrence removed as requested */}
            </div>
            <MapLeaflet lat={event.venue.lat} lng={event.venue.lng} name={event.venue.name} />
            <div className="prose max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
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

        <aside className="space-y-6">
          <section className="p-6 border rounded-lg bg-card animate-enter">
            <h2 className="text-xl font-semibold mb-4">1. Choose tickets</h2>
            <div className="space-y-3">
              {event.tickets.map((t) => {
                const unit = effectiveUnitAmount(t);
                const isSelected = selectedTicketId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${isSelected ? 'border-primary bg-secondary' : 'hover:bg-muted'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{t.name}{t.zone ? ` — ${t.zone}` : ''}</div>
                        <div className="text-xs text-muted-foreground">Capacity: {t.capacityTotal}</div>
                        <div className="text-xs text-muted-foreground">Includes {t.participantsPerTicket || 1} participant{(t.participantsPerTicket || 1) > 1 ? 's' : ''} per ticket</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(unit, t.currency)}</div>
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
                <Button type="button" variant="outline" size="icon" aria-label="Decrease tickets"
                  onClick={() => setQuantityTickets((v) => clamp(v - 1, 1, selectedTicket.capacityTotal))}>
                  −
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={selectedTicket.capacityTotal}
                  value={quantityTickets}
                  onChange={(e) => setQuantityTickets(clamp(parseInt(e.target.value || '1', 10), 1, selectedTicket.capacityTotal))}
                  className="w-20 text-center"
                />
                <Button type="button" variant="outline" size="icon" aria-label="Increase tickets"
                  onClick={() => setQuantityTickets((v) => clamp(v + 1, 1, selectedTicket.capacityTotal))}>
                  +
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">Participants: <span className="font-medium text-foreground">{participantsCount}</span></div>
            </div>
          </section>

          {event.addons.length > 0 && (
            <section className="p-6 border rounded-lg bg-card animate-enter">
              <h2 className="text-xl font-semibold mb-4">2. Add-ons (max {participantsCount} per add-on)</h2>
              <div className="space-y-4">
                {event.addons.map((a: Addon) => (
                  <div key={a.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{a.name}</div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                      )}
                      <div className="text-sm text-muted-foreground mt-1">{formatCurrency(a.unitAmountCents, currency)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" aria-label={`Decrease ${a.name}`}
                        onClick={() => setAddonsQty((prev) => ({ ...prev, [a.id]: clamp((prev[a.id] ?? 0) - 1, 0, participantsCount) }))}>−</Button>
                      <Input
                        type="number"
                        min={0}
                        max={participantsCount}
                        value={addonsQty[a.id] ?? 0}
                        onChange={(e) => {
                          const v = clamp(parseInt(e.target.value || '0', 10), 0, participantsCount);
                          setAddonsQty((prev) => ({ ...prev, [a.id]: v }));
                        }}
                        className="w-16 text-center"
                      />
                      <Button type="button" variant="outline" size="icon" aria-label={`Increase ${a.name}`}
                        onClick={() => setAddonsQty((prev) => ({ ...prev, [a.id]: clamp((prev[a.id] ?? 0) + 1, 0, participantsCount) }))}>+</Button>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">You can select up to {participantsCount} units of each add-on.</div>
              </div>
            </section>
          )}


          <section className="p-6 border rounded-lg bg-card animate-enter">
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
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="p-6 border rounded-lg bg-card animate-enter">
            <h2 className="text-xl font-semibold mb-4">4. Terms, Coupon & Summary</h2>
            <div className="flex items-center gap-2 mb-4">
              <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(Boolean(v))} />
              <label htmlFor="terms" className="text-sm">I accept the <a href="/terms" className="underline">Terms and Conditions</a></label>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Input placeholder="Coupon code" value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponValid(false); }} className="max-w-xs" />
              <Button type="button" variant="outline" onClick={async () => {
                if (!coupon) { toast.error('Enter a coupon'); return; }
                try {
                  const { data, error } = await supabase.functions.invoke('validate-coupon', {
                    body: { eventId: event.id, code: coupon }
                  });
                  if (error) throw error as any;
                  if (data?.valid) {
                    setCouponValid(true);
                    toast.success('Coupon applied');
                  } else {
                    setCouponValid(false);
                    toast.error('Invalid coupon');
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
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
            <Button className="w-full mt-4" onClick={proceed}>Proceed to payment</Button>
            <Button className="w-full mt-2" variant="secondary" onClick={testPurchase}>Test purchase (send email)</Button>
            <p className="text-xs text-muted-foreground mt-2">Serás redirigido a Stripe Checkout.</p>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default EventDetail;
