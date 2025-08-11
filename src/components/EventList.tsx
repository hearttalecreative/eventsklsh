import { events as mockEvents } from '@/data/events';
import { EventCard } from './EventCard';
import { useSupabaseEventsList } from '@/hooks/useSupabaseEvents';
import { useMemo } from 'react';

const EventList = () => {
  const { data, loading } = useSupabaseEventsList();
  const items = useMemo(() => (data && data.length ? data : mockEvents), [data]);
  const sorted = useMemo(() => {
    const now = Date.now();
    const future = items
      .filter((ev) => new Date(ev.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const past = items
      .filter((ev) => new Date(ev.startsAt).getTime() < now)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return [...future, ...past];
  }, [items]);
  return (
    <section aria-labelledby="events-heading" className="container mx-auto">
      <h2 id="events-heading" className="text-3xl font-semibold mb-6">Upcoming events</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
    </section>
  );
};

export default EventList;
