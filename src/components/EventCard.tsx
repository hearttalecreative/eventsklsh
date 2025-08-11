import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface Props {
  event: EventItem;
}

export const EventCard = ({ event }: Props) => {
  const hasTickets = event.tickets && event.tickets.length > 0;
  const minPrice = hasTickets ? Math.min(...event.tickets.map((t) => effectiveUnitAmount(t))) : null;
  const maxPax = hasTickets ? Math.max(...event.tickets.map((t) => t.participantsPerTicket || 1)) : 1;
  const currency = hasTickets ? event.tickets[0].currency : 'USD';
  return (
    <Card className="h-full flex flex-col border bg-card">
      <CardHeader className="p-0">
        <Link to={`/event/${event.id}`} className="block relative h-48 w-full overflow-hidden rounded-t-lg">
          <img
            src={event.imageUrl}
            alt={`${event.title} event image`}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        </Link>
        <div className="p-4">
          <CardTitle className="text-xl">
            <Link to={`/event/${event.id}`} className="hover:underline">{event.title}</Link>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{truncateWords(event.shortDescription, 50)}</p>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 mt-auto">
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Starts</span>
            <time className="font-medium" dateTime={event.startsAt}>{new Date(event.startsAt).toLocaleString()}</time>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Venue</span>
            <span className="font-medium truncate max-w-[60%]" title={`${event.venue.name} — ${event.venue.address}`}>{event.venue.name}</span>
          </div>
          {maxPax > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Multi-participant</span>
              <span className="font-medium">Up to {maxPax} per ticket</span>
            </div>
          )}
          {hasTickets ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">From</span>
              <span className="font-medium">{formatCurrency(minPrice as number, currency)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tickets</span>
              <span className="font-medium">Not available</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <Button asChild className="w-full">
            <Link to={`/event/${event.id}`}>Get tickets</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
