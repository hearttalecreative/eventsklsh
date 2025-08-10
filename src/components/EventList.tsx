import { events } from '@/data/events';
import { EventCard } from './EventCard';

const EventList = () => {
  return (
    <section aria-labelledby="events-heading" className="container mx-auto">
      <h2 id="events-heading" className="text-3xl font-semibold mb-6">Upcoming events</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
    </section>
  );
};

export default EventList;
