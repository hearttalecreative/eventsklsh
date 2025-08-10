import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { events } from '@/data/events';
import { EventItem, TicketType, Addon } from '@/types/events';
import MapLeaflet from '@/components/MapLeaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';

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
  const event: EventItem | undefined = useMemo(() => events.find((e) => e.id === id), [id]);

  const [selectedTicketId, setSelectedTicketId] = useState<string | undefined>(event?.tickets[0]?.id);
  const selectedTicket = useMemo(() => event?.tickets.find((t) => t.id === selectedTicketId), [event, selectedTicketId]);
  const [quantityTickets, setQuantityTickets] = useState<number>(1);
  const participantsPerTicket = selectedTicket?.participantsPerTicket ?? 1;
  const participantsCount = quantityTickets * participantsPerTicket;

  const [addonsQty, setAddonsQty] = useState<Record<string, number>>({});
  const addonsSum = Object.values(addonsQty).reduce((a, b) => a + b, 0);

  const [participants, setParticipants] = useState(
    Array.from({ length: participantsCount }, () => ({ fullName: '', email: '', phone: '' }))
  );

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [coupon, setCoupon] = useState('');

  useEffect(() => {
    // keep participants array length in sync
    setParticipants((prev) => {
      const next = Array.from({ length: participantsCount }, (_, i) => prev[i] ?? { fullName: '', email: '', phone: '' });
      return next;
    });
    // ensure addons respect constraint: sum(addons) <= participants
    setAddonsQty((prev) => {
      const sum = Object.values(prev).reduce((a, b) => a + b, 0);
      if (sum <= participantsCount) return prev;
      // scale down proportionally
      const factor = participantsCount / (sum || 1);
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((k) => {
        next[k] = Math.floor(prev[k] * factor);
      });
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

  const currency = selectedTicket.currency;
  const ticketUnit = effectiveUnitAmount(selectedTicket);
  const ticketsSubtotal = ticketUnit * quantityTickets;

  const addonsSubtotal = Object.entries(addonsQty).reduce((sum, [id, qty]) => {
    const addon = event.addons.find((a) => a.id === id);
    return sum + (addon ? addon.unitAmountCents * qty : 0);
  }, 0);

  const discount = coupon && coupon.toUpperCase() === (event.couponCode || '').toUpperCase() ? Math.round((ticketsSubtotal + addonsSubtotal) * 0.1) : 0; // 10% demo
  const total = ticketsSubtotal + addonsSubtotal - discount;

  const [showFullDesc, setShowFullDesc] = useState(false);
  const { shortDesc, isLong } = useMemo(() => {
    const words = (event.description || '').trim().split(/\s+/);
    return { shortDesc: words.slice(0, 100).join(' '), isLong: words.length > 100 };
  }, [event.description]);

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

  const proceed = () => {
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
    toast.success('Great! The payment step will be enabled when we add Stripe.');
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
              {event.recurrenceText && (
                <div className="p-4 rounded-lg border bg-card sm:col-span-2">
                  <div className="text-muted-foreground">Recurrence</div>
                  <div className="font-medium">{event.recurrenceText}</div>
                </div>
              )}
            </div>
            <MapLeaflet lat={event.venue.lat} lng={event.venue.lng} name={event.venue.name} />
            <div className="prose max-w-none">
              <p>{(showFullDesc || !isLong) ? event.description : `${shortDesc}...`}</p>
              {isLong && (
                <button type="button" className="mt-2 text-primary underline" onClick={() => setShowFullDesc((v) => !v)}>
                  {showFullDesc ? 'Mostrar menos' : 'Leer más'}
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
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Tickets</label>
              <Input
                type="number"
                min={1}
                max={selectedTicket.capacityTotal}
                value={quantityTickets}
                onChange={(e) => setQuantityTickets(clamp(parseInt(e.target.value || '1', 10), 1, selectedTicket.capacityTotal))}
                className="w-24"
              />
              <div className="text-sm text-muted-foreground">Participants: <span className="font-medium text-foreground">{participantsCount}</span></div>
            </div>
          </section>

          <section className="p-6 border rounded-lg bg-card animate-enter">
            <h2 className="text-xl font-semibold mb-4">2. Add-ons (max {participantsCount})</h2>
            <div className="space-y-3">
              {event.addons.map((a: Addon) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(a.unitAmountCents, currency)}</div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={participantsCount}
                    value={addonsQty[a.id] ?? 0}
                    onChange={(e) => {
                      const v = clamp(parseInt(e.target.value || '0', 10), 0, participantsCount);
                      const next = { ...addonsQty, [a.id]: v };
                      const sum = Object.values(next).reduce((s, n) => s + n, 0);
                      if (sum <= participantsCount) setAddonsQty(next);
                    }}
                    className="w-24"
                  />
                </div>
              ))}
              <div className="text-xs text-muted-foreground">Total add-ons: {addonsSum}/{participantsCount}</div>
            </div>
          </section>

          <section className="p-6 border rounded-lg bg-card animate-enter">
            <h2 className="text-xl font-semibold mb-4">3. Participants</h2>
            <div className="space-y-4 max-h-80 overflow-auto pr-2">
              {participants.map((p, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    placeholder={`Full name #${i + 1}`}
                    value={p.fullName}
                    onChange={(e) => setParticipants((arr) => arr.map((v, idx) => (idx === i ? { ...v, fullName: e.target.value } : v)))}
                    required
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={p.email}
                    onChange={(e) => setParticipants((arr) => arr.map((v, idx) => (idx === i ? { ...v, email: e.target.value } : v)))}
                    required
                  />
                  <Input
                    placeholder="Phone"
                    value={p.phone}
                    onChange={(e) => setParticipants((arr) => arr.map((v, idx) => (idx === i ? { ...v, phone: e.target.value } : v)))}
                    required
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="p-6 border rounded-lg bg-card animate-enter">
            <h2 className="text-xl font-semibold mb-4">4. Terms, Coupon & Summary</h2>
            <div className="flex items-center gap-2 mb-4">
              <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(Boolean(v))} />
              <label htmlFor="terms" className="text-sm">I accept the <a href="#" className="underline">Terms and Conditions</a></label>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="max-w-xs" />
              <Button variant="secondary" type="button" onClick={() => toast.info('Coupon applied (demo)')}>Apply</Button>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tickets</span><span>{formatCurrency(ticketsSubtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Add-ons</span><span>{formatCurrency(addonsSubtotal, currency)}</span></div>
              {discount > 0 && (
                <div className="flex justify-between text-accent-foreground"><span>Discount</span><span>-{formatCurrency(discount, currency)}</span></div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold"><span>Total</span><span>{formatCurrency(total, currency)}</span></div>
            </div>
            <Button className="w-full mt-4" onClick={proceed}>Proceed to payment</Button>
            <p className="text-xs text-muted-foreground mt-2">Stripe will be integrated at the final step.</p>
          </section>
        </aside>
      </div>
      <footer className="py-8 mt-6 border-t">
        <div className="container mx-auto flex items-center justify-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard" aria-label="Abrir panel de administración">Ir al panel de administración</Link>
          </Button>
        </div>
      </footer>
    </main>
  );
};

export default EventDetail;
