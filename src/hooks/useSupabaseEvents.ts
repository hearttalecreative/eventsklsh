import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EventItem, TicketType, Addon, Venue } from '@/types/events';

function mapTicket(row: any): TicketType {
  return {
    id: row.id,
    name: row.name,
    unitAmountCents: row.unit_amount_cents,
    currency: (row.currency || 'usd') as any,
    capacityTotal: row.capacity_total,
    zone: row.zone || undefined,
    participantsPerTicket: row.participants_per_ticket ?? 1,
    earlyBirdAmountCents: row.early_bird_amount_cents ?? undefined,
    earlyBirdStart: row.early_bird_start ?? undefined,
    earlyBirdEnd: row.early_bird_end ?? undefined,
  };
}

function mapAddon(row: any): Addon {
  return {
    id: row.id,
    name: row.name,
    unitAmountCents: row.unit_amount_cents,
    description: row.description ?? undefined,
  };
}

function mapVenue(row: any): Venue {
  return {
    name: row.name,
    address: row.address || '',
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
  };
}

export function useSupabaseEventsList() {
  const [data, setData] = useState<EventItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      setError(null);
      // 1) events (published)
      const { data: evs, error: eErr } = await supabase
        .from('events')
        .select('id,title,short_description,image_url,starts_at,ends_at,venue_id,status,category,description,sku')
        .eq('status', 'published')
        .order('starts_at', { ascending: true });
      if (eErr) {
        if (!canceled) { setError(eErr.message); setLoading(false); }
        return;
      }
      const eventIds = (evs || []).map((r: any) => r.id);
      const venueIds = Array.from(new Set((evs || []).map((r: any) => r.venue_id).filter(Boolean)));

      // 2) tickets for all events
      const { data: tks } = await supabase
        .from('tickets')
        .select('id,event_id,name,unit_amount_cents,currency,capacity_total,zone,participants_per_ticket,early_bird_amount_cents,early_bird_start,early_bird_end')
        .in('event_id', eventIds);

      // 3) addons for all events
      const { data: ads } = await supabase
        .from('addons')
        .select('id,event_id,name,unit_amount_cents,description')
        .in('event_id', eventIds);

      // 4) venues
      const { data: vns } = await supabase
        .from('venues')
        .select('id,name,address,lat,lng')
        .in('id', venueIds);

      const venueMap = new Map((vns || []).map((v: any) => [v.id, mapVenue(v)]));
      const ticketsByEvent = new Map<string, TicketType[]>();
      (tks || []).forEach((t: any) => {
        const arr = ticketsByEvent.get(t.event_id) || [];
        arr.push(mapTicket(t));
        ticketsByEvent.set(t.event_id, arr);
      });
      const addonsByEvent = new Map<string, Addon[]>();
      (ads || []).forEach((a: any) => {
        const arr = addonsByEvent.get(a.event_id) || [];
        arr.push(mapAddon(a));
        addonsByEvent.set(a.event_id, arr);
      });

      const mapped: EventItem[] = (evs || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        shortDescription: r.short_description || '',
        description: r.description || '',
        imageUrl: r.image_url || '',
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        venue: venueMap.get(r.venue_id) || { name: 'Venue', address: '', lat: 0, lng: 0 },
        category: r.category || undefined,
        sku: r.sku || '',
        status: r.status,
        tickets: ticketsByEvent.get(r.id) || [],
        addons: addonsByEvent.get(r.id) || [],
        capacityTotal: r.capacity_total || undefined,
        
        instructions: undefined,
        recurrenceRule: r.recurrence_rule || undefined,
        recurrenceText: r.recurrence_text || undefined,
      }));

      if (!canceled) { setData(mapped); setLoading(false); }
    }
    load();
    return () => { canceled = true; };
  }, []);

  return { data, loading, error };
}

export function useSupabaseEventDetail(id: string | undefined) {
  const [data, setData] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let canceled = false;
    async function load() {
      setLoading(true);
      const { data: e, error } = await supabase
        .from('events')
        .select('id,title,short_description,description,image_url,starts_at,ends_at,venue_id,status,category,sku,recurrence_rule,recurrence_text,capacity_total')
        .eq('id', id)
        .maybeSingle();
      if (error || !e) { setLoading(false); return; }

      const [{ data: tks }, { data: ads }, { data: v }] = await Promise.all([
        supabase.from('tickets').select('id,event_id,name,unit_amount_cents,currency,capacity_total,zone,participants_per_ticket,early_bird_amount_cents,early_bird_start,early_bird_end').eq('event_id', id),
        supabase.from('addons').select('id,event_id,name,unit_amount_cents,description').eq('event_id', id),
        supabase.from('venues').select('id,name,address,lat,lng').eq('id', e.venue_id).maybeSingle(),
      ]);

      const mapped: EventItem = {
        id: e.id,
        title: e.title,
        shortDescription: e.short_description || '',
        description: e.description || '',
        imageUrl: e.image_url || '',
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        venue: v ? mapVenue(v) : { name: 'Venue', address: '', lat: 0, lng: 0 },
        category: e.category || undefined,
        sku: e.sku || '',
        status: e.status,
        tickets: (tks || []).map(mapTicket),
        addons: (ads || []).map(mapAddon),
        capacityTotal: e.capacity_total || undefined,
        
        instructions: undefined,
        recurrenceRule: e.recurrence_rule || undefined,
        recurrenceText: e.recurrence_text || undefined,
      };
      if (!canceled) { setData(mapped); setLoading(false); }
    }
    load();
    return () => { canceled = true; };
  }, [id]);

  return { data, loading };
}
