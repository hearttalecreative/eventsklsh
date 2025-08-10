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

interface Props {
  event: EventItem;
}

export const EventCard = ({ event }: Props) => {
  const minPrice = Math.min(...event.tickets.map((t) => effectiveUnitAmount(t)));
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
          <p className="text-sm text-muted-foreground mt-1">{event.shortDescription}</p>
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
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium">{formatCurrency(minPrice, event.tickets[0].currency)}</span>
          </div>
        </div>
        <div className="mt-4">
          <Button asChild className="w-full">
            <Link to={`/event/${event.id}`}>View details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
