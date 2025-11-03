import { events as mockEvents } from '@/data/events';
import { EventCard } from '@/components/EventCard';
import { useSupabaseEventsList } from '@/hooks/useSupabaseEvents';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Helmet } from "react-helmet-async";

const CaliforniaEvents = () => {
  const { data, loading } = useSupabaseEventsList();
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState<string>('all');
  const [order, setOrder] = useState<'date-asc' | 'date-desc'>('date-asc');
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'California Events - Kyle Lam Sound Healing',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
  };

  const items = useMemo(() => {
    if (loading) return [];
    return (data && data.length ? data : mockEvents);
  }, [data, loading]);

  // Filter events by California
  const californiaEvents = useMemo(
    () => items.filter((ev) => {
      const hasTickets = (ev.tickets?.length ?? 0) > 0;
      const hasImage = !!ev.imageUrl && ev.imageUrl.trim() !== '';
      const address = ev.venue?.address?.toLowerCase() || '';
      const isInCalifornia = address.includes('california') || address.includes(', ca');
      return hasTickets && hasImage && isInCalifornia;
    }),
    [items]
  );

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    californiaEvents.forEach((ev)=>{
      const d = new Date(ev.startsAt); 
      const m = (d.getMonth()+1).toString().padStart(2,'0'); 
      const y = d.getFullYear().toString();
      set.add(`${y}-${m}`);
    });
    return Array.from(set).sort();
  }, [californiaEvents]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return californiaEvents.filter((ev) => {
      const matchQ = ev.title.toLowerCase().includes(q);
      if (month === 'all') return matchQ;
      const d = new Date(ev.startsAt); 
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
      return matchQ && key === month;
    });
  }, [californiaEvents, query, month]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    return arr.sort((a, b) => order === 'date-asc'
      ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [filtered, order]);

  return (
    <main>
      <Helmet>
        <title>California Events | Kyle Lam Sound Healing</title>
        <meta name="description" content="Discover Kyle Lam Sound Healing events in California. Buy tickets for sound healing experiences throughout the Golden State." />
        <link rel="canonical" href={`${baseUrl}/events/california`} />
        <meta property="og:site_name" content="Kyle Lam Sound Healing" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="California Events | Kyle Lam Sound Healing" />
        <meta property="og:description" content="Discover Kyle Lam Sound Healing events in California. Buy tickets for sound healing experiences throughout the Golden State." />
        <meta property="og:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="California Events | Kyle Lam Sound Healing" />
        <meta name="twitter:description" content="Discover Kyle Lam Sound Healing events in California. Buy tickets for sound healing experiences throughout the Golden State." />
        <meta name="twitter:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-4xl font-bold">California Events</h1>
        <p className="text-muted-foreground mt-2">Sound healing experiences throughout California</p>
      </header>

      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="mb-4 rounded-lg border bg-card p-4">
            <div className="grid gap-3 md:grid-cols-3 items-center">
              <Input placeholder="Search events by name" value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="Search events" />
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue placeholder="All months" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthOptions.map((m)=> {
                    const [year, monthNum] = m.split('-');
                    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                    return (
                      <SelectItem key={m} value={m}>{date.toLocaleDateString(undefined,{ month:'long', year:'numeric'})}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={order} onValueChange={(v)=>setOrder(v as any)}>
                <SelectTrigger><SelectValue placeholder="Order" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">Date: ascending</SelectItem>
                  <SelectItem value="date-desc">Date: descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="p-6 border rounded-lg animate-pulse">
                  <div className="bg-muted h-48 rounded mb-4"></div>
                  <div className="bg-muted h-4 rounded mb-2 w-3/4"></div>
                  <div className="bg-muted h-3 rounded mb-2 w-1/2"></div>
                  <div className="bg-muted h-3 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events found in California.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="container mx-auto px-4 py-8 text-center border-t">
        <p className="text-sm text-muted-foreground">
          © Copyright 2025 Kyle Lam Sound Healing. All Rights Reserved. | Developed with ♥ by{' '}
          <a 
            href="https://hearttalecreative.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Hearttale Creative
          </a>
          .
        </p>
      </footer>
    </main>
  );
};

export default CaliforniaEvents;
