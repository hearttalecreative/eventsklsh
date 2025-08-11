import { events as mockEvents } from '@/data/events';
import { EventCard } from './EventCard';
import { useSupabaseEventsList } from '@/hooks/useSupabaseEvents';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EventList = () => {
  const { data, loading } = useSupabaseEventsList();
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState<string>('all');
  const [order, setOrder] = useState<'date-asc' | 'date-desc'>('date-asc');
  const items = useMemo(() => (data && data.length ? data : mockEvents), [data]);
  const available = useMemo(
    () => items.filter((ev) => (ev.tickets?.length ?? 0) > 0 && !!ev.imageUrl && ev.imageUrl.trim() !== ''),
    [items]
  );
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    available.forEach((ev)=>{
      const d = new Date(ev.startsAt); const m = (d.getMonth()+1).toString().padStart(2,'0'); const y = d.getFullYear().toString();
      set.add(`${y}-${m}`);
    });
    return Array.from(set).sort();
  }, [available]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return available.filter((ev) => {
      const matchQ = ev.title.toLowerCase().includes(q);
      if (month === 'all') return matchQ;
      const d = new Date(ev.startsAt); const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
      return matchQ && key === month;
    });
  }, [available, query, month]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    return arr.sort((a, b) => order === 'date-asc'
      ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [filtered, order]);
  return (
    <section className="container mx-auto px-4">
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-3 items-center">
          <Input placeholder="Search events by name" value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="Search events" />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue placeholder="All months" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {monthOptions.map((m)=> (
                <SelectItem key={m} value={m}>{new Date(m+"-01").toLocaleDateString(undefined,{ month:'long', year:'numeric'})}</SelectItem>
              ))}
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
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events found.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}
    </section>
  );
};

export default EventList;
