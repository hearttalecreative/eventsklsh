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
    description: row.description ?? undefined,
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
        .select('id,slug,title,short_description,image_url,starts_at,ends_at,venue_id,status,category,description,sku,timezone')
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
        .select('id,event_id,name,unit_amount_cents,currency,capacity_total,zone,participants_per_ticket,early_bird_amount_cents,early_bird_start,early_bird_end,description,display_order')
        .in('event_id', eventIds)
        .order('display_order', { ascending: true });

      // 3) addons for all events
      const { data: ads } = await supabase
        .from('addons')
        .select('id,event_id,name,unit_amount_cents,description')
        .in('event_id', eventIds);

      // 4) venues
      const { data: vns } = await supabase
        .from('venues')
        .select('id,name,address')
        .in('id', venueIds);

      const venueMap = new Map((vns || []).map((v: any) => [v.id, mapVenue(v)]));
      const ticketsByEvent = new Map<string, TicketType[]>();
      // Sort tickets by display_order before grouping
      const sortedTickets = (tks || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      sortedTickets.forEach((t: any) => {
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
        slug: r.slug || undefined,
        shortDescription: r.short_description || '',
        description: r.description || '',
        imageUrl: r.image_url || '',
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        venue: venueMap.get(r.venue_id) || { name: 'Venue', address: '' },
        category: r.category || undefined,
        sku: r.sku || '',
        status: r.status,
        tickets: ticketsByEvent.get(r.id) || [],
        addons: addonsByEvent.get(r.id) || [],
        capacityTotal: r.capacity_total || undefined,
        
        instructions: undefined,
        recurrenceRule: r.recurrence_rule || undefined,
        recurrenceText: r.recurrence_text || undefined,
        timezone: r.timezone || 'America/Los_Angeles',
      }));

      if (!canceled) { setData(mapped); setLoading(false); }
    }
    load();
    return () => { canceled = true; };
  }, []);

  return { data, loading, error };
}

export function useSupabaseEventDetail(idOrSlug: string | undefined) {
  const [data, setData] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idOrSlug) return;
    let canceled = false;

    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

    async function load() {
      console.log('[useSupabaseEventDetail] Loading event with idOrSlug:', idOrSlug);
      setLoading(true);
      const field = isUuid(idOrSlug) ? 'id' : 'slug';
      console.log('[useSupabaseEventDetail] Using field:', field, 'for value:', idOrSlug);
      // Fetch event - no status filter for direct access
      const { data: e, error } = await supabase
        .from('events')
        .select('id,slug,title,short_description,description,image_url,starts_at,ends_at,venue_id,status,category,sku,recurrence_rule,recurrence_text,capacity_total,timezone')
        .eq(field, idOrSlug)
        .maybeSingle();
      console.log('[useSupabaseEventDetail] Event query result:', { e, error });
      
      let eFound = e;
      
      // Fallback: if not found by slug, try matching by 6-char suffix after `--`
      if (!eFound && field === 'slug') {
        const m = idOrSlug.match(/--([a-f0-9]{6})$/i);
        if (m) {
          const suffix = m[1];
          console.log('[useSupabaseEventDetail] Attempting suffix fallback:', suffix);
          const { data: e2, error: err2 } = await supabase
            .from('events')
            .select('id,slug,title,short_description,description,image_url,starts_at,ends_at,venue_id,status,category,sku,recurrence_rule,recurrence_text,capacity_total,timezone')
            .ilike('slug', `%--${suffix}`)
            .maybeSingle();
          if (err2) console.warn('[useSupabaseEventDetail] Fallback query error:', err2);
          if (e2) eFound = e2;
        }
      }

      if (error || !eFound) { 
        console.log('[useSupabaseEventDetail] No event found or error:', error);
        if (!canceled) setLoading(false); 
        return; 
      }

      const eventId = eFound.id;

      const [{ data: tks }, { data: ads }, { data: v }] = await Promise.all([
        supabase.from('tickets').select('id,event_id,name,unit_amount_cents,currency,capacity_total,zone,participants_per_ticket,early_bird_amount_cents,early_bird_start,early_bird_end,description,display_order').eq('event_id', eventId).order('display_order', { ascending: true }),
        supabase.from('addons').select('id,event_id,name,unit_amount_cents,description').eq('event_id', eventId),
        supabase.from('venues').select('id,name,address').eq('id', eFound.venue_id).maybeSingle(),
      ]);

      console.log('[useSupabaseEventDetail] Related data loaded:', { 
        tickets: tks?.length, 
        addons: ads?.length, 
        venue: v?.name 
      });

      const mapped: EventItem = {
        id: eFound.id,
        title: eFound.title,
        slug: eFound.slug || undefined,
        shortDescription: eFound.short_description || '',
        description: eFound.description || '',
        imageUrl: eFound.image_url || '',
        startsAt: eFound.starts_at,
        endsAt: eFound.ends_at,
        venue: v ? mapVenue(v) : { name: 'Venue', address: '' },
        category: eFound.category || undefined,
        sku: eFound.sku || '',
        status: eFound.status,
        tickets: (tks || []).map(mapTicket),
        addons: (ads || []).map(mapAddon),
        capacityTotal: eFound.capacity_total || undefined,
        
        instructions: undefined,
        recurrenceRule: eFound.recurrence_rule || undefined,
        recurrenceText: eFound.recurrence_text || undefined,
        timezone: eFound.timezone || 'America/Los_Angeles',
      };
      console.log('[useSupabaseEventDetail] Final mapped event:', mapped);
      if (!canceled) { setData(mapped); setLoading(false); }
    }
    load();
    return () => { canceled = true; };
  }, [idOrSlug]);

  return { data, loading };
}
