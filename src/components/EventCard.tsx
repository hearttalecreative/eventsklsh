import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { EventItem, TicketType } from '@/types/events';

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

function truncateWords(text: string, maxWords: number) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '…' : text;
}

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
}

function formatEventSchedule(startsAt: string, endsAt?: string, timezone?: string) {
  const tz = timezone || 'America/Los_Angeles';
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  const datePart = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(start);
  const fmtParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).formatToParts(start);
  const tzName = fmtParts.find(p => p.type === 'timeZoneName')?.value || '';
  const timeFmt = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(d).toLowerCase().replace(':00', '');
  const range = end ? `${timeFmt(start)} – ${timeFmt(end)}` : timeFmt(start);
  return `${datePart}, ${range} ${tzName}`;
}

interface Props {
  event: EventItem;
}

export const EventCard = ({ event }: Props) => {
  const hasTickets = event.tickets && event.tickets.length > 0;
  const minPrice = hasTickets ? Math.min(...event.tickets.map((t) => effectiveUnitAmount(t))) : null;
  const maxPax = hasTickets ? Math.max(...event.tickets.map((t) => t.participantsPerTicket || 1)) : 1;
  const currency = 'USD';
  const slugPath = event.slug ?? slugify(event.title) ?? event.id;
  const isSoldOut = event.status === 'sold_out';
  const isPaused = event.status === 'paused';

  return (
    <Card className="h-full flex flex-col border border-border/50 bg-card min-w-0 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-border group">
      <CardHeader className="p-0 min-w-0 relative">
        <Link
          to={`/event/${slugPath}`}
          className="block relative w-full overflow-hidden outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
          aria-label={`View details for ${event.title}`}
        >
          <AspectRatio ratio={1230 / 693}>
            <img
              src={event.imageUrl}
              alt={`${event.title} event image`}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
            />
            {/* Subtle overlay gradient on hover for better text contrast if we had texts, also adds polish */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </AspectRatio>
          {(isSoldOut || isPaused) && (
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-destructive/90 backdrop-blur-md text-destructive-foreground shadow-sm">
                {isSoldOut ? 'Sold Out' : 'Paused'}
              </span>
            </div>
          )}
        </Link>
        <div className="p-5 sm:p-6 min-w-0 pb-2">
          <CardTitle className="text-xl sm:text-2xl font-semibold leading-tight break-words group-hover:text-primary transition-colors">
            <Link to={`/event/${slugPath}`} className="outline-none focus-visible:underline decoration-2 underline-offset-4">{event.title}</Link>
          </CardTitle>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {truncateWords(event.shortDescription, 20)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 mt-auto overflow-hidden flex flex-col gap-4">
        <div className="space-y-2.5 text-sm sm:text-base pt-2">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground/80 font-medium shrink-0 uppercase tracking-wider text-xs">When</span>
            <time className="font-medium text-foreground text-right break-words" dateTime={event.startsAt}>
              {formatEventSchedule(event.startsAt, event.endsAt, event.timezone)}
            </time>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground/80 font-medium shrink-0 uppercase tracking-wider text-xs">Venue</span>
            <span className="font-medium text-foreground text-right line-clamp-2" title={`${event.venue.name} — ${event.venue.address}`}>
              {event.venue.name}
            </span>
          </div>
          {hasTickets ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-muted-foreground/80 font-medium shrink-0 uppercase tracking-wider text-xs">From</span>
              <span className="font-semibold text-lg text-primary">
                {formatCurrency(minPrice as number, currency)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-muted-foreground/80 font-medium shrink-0 uppercase tracking-wider text-xs">Tickets</span>
              <span className="font-medium text-muted-foreground italic">Not available</span>
            </div>
          )}
        </div>

        <div className="mt-2 pt-4 border-t border-border/40">
          <Button
            asChild
            className="w-full font-medium transition-all shadow-sm hover:shadow"
            variant={isSoldOut || isPaused ? "secondary" : "default"}
            disabled={isSoldOut || isPaused}
          >
            <Link to={`/event/${slugPath}`} className="outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
              {isSoldOut ? 'Sold Out' : isPaused ? 'Sales Paused' : 'Get tickets'}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
