import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AdminRoute from "@/routes/AdminRoute";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import VenueCreateDialog from "@/components/admin/VenueCreateDialog";
import { useLocation } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import RichMarkdownEditor from "@/components/RichMarkdownEditor";
import { addDays, addMonths } from "date-fns";
import { Megaphone, Edit3, Ticket, Package, Users, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Venue { id: string; name: string; address?: string | null; }

const logAdmin = async (action: string, entity_type?: string, entity_id?: string, details?: any) => {
  const { data: session } = await supabase.auth.getSession();
  const user_id = session.session?.user?.id || null;
  await supabase.from('admin_activity_logs').insert({ user_id, action, entity_type, entity_id, details });
};

const AdminEvents = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-ons editor state
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [addonsEventId, setAddonsEventId] = useState<string | null>(null);
  const [addons, setAddons] = useState<any[]>([]);
  const [savingAddons, setSavingAddons] = useState(false);

  // Tickets editor state
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [ticketsEventId, setTicketsEventId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);

// Attendees modal state
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [attendeesEventId, setAttendeesEventId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [attendeesSearch, setAttendeesSearch] = useState('');
  const filteredAttendees = useMemo(() => {
    const q = attendeesSearch.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter((a)=> (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q));
  }, [attendees, attendeesSearch]);
  const [manageEventId, setManageEventId] = useState<string | undefined>(undefined);

  // Form state for quick create
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [instructions, setInstructions] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venueId, setVenueId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState("draft");
  
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Recurrence settings
  const [eventType, setEventType] = useState<'single' | 'recurring'>("single");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]); // 0..6
  const [recurrenceMonths, setRecurrenceMonths] = useState<number>(1);

  // Sorting and filters for events table
  const [evOrderBy, setEvOrderBy] = useState<'upcoming'|'past'|'title-asc'|'title-desc'>("upcoming");
  const [filterMonth, setFilterMonth] = useState<string>('all'); // 'all' | '1'..'12'
  const [filterYear, setFilterYear] = useState<string>('all');   // 'all' | '2025' etc
  const [selectedIds, setSelectedIds] = useState<string[]>([]);


  // Edit event dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any|null>(null);
  const [eTitle, setETitle] = useState('');
  const [eShort, setEShort] = useState('');
  const [eLong, setELong] = useState('');
  const [eInstructions, setEInstructions] = useState('');
  const [eStarts, setEStarts] = useState('');
  const [eEnds, setEEnds] = useState('');
  const [eVenueId, setEVenueId] = useState<string | undefined>(undefined);
  const [eStatus, setEStatus] = useState('draft');
  const [eImageUrl, setEImageUrl] = useState('');
  const [eImageFile, setEImageFile] = useState<File | null>(null);

  // Tickets advanced fields
  const [showAdvancedTicketFields, setShowAdvancedTicketFields] = useState(false);

  // Venue create dialog state
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);

  // Venue edit dialog state
  const [venueEditOpen, setVenueEditOpen] = useState(false);
  const [venueEditing, setVenueEditing] = useState<Venue | null>(null);
  const [vName, setVName] = useState("");
  const [vAddress, setVAddress] = useState("");

  const location = useLocation();
  const openedFromParamRef = useRef(false);
  const handleVenueCreated = (venue: Venue) => {
    setVenues((arr) => [...arr, venue]);
    setVenueId(venue.id);
    logAdmin('venue_created','venue', venue.id, { name: venue.name });
  };

  useEffect(() => {
    const load = async () => {
      const { data: v } = await supabase.from("venues").select("id,name,address,lat,lng").order("name");
      setVenues(v || []);
      const { data: ev } = await supabase.from("events").select("*, venues:venue_id(name)").order("created_at", { ascending: false });
      setEvents(ev || []);
      setManageEventId(ev && ev.length ? ev[0].id : undefined);
      setLoading(false);
    };
    load();
  }, []);

  // Auto-open edit dialog when coming from dashboard with ?edit=<id> (only once)
  useEffect(() => {
    if (openedFromParamRef.current) return;
    if (!loading) {
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit');
      if (editId) {
        const ev = events.find(e => e.id === editId);
        if (ev) {
          openEdit(ev);
        }
      }
      openedFromParamRef.current = true;
    }
  }, [loading, location.search, events]);

  function isEventPast(ev: any) {
    const endOrStart = ev.ends_at ? new Date(ev.ends_at) : new Date(ev.starts_at);
    return endOrStart < new Date();
  }

  const openEdit = (ev: any) => {
    if (isEventPast(ev)) { alert('You cannot modify a past event.'); return; }
    setEditingEvent(ev);
    setETitle(ev.title || '');
    setEShort(ev.short_description || '');
    setELong(ev.description || '');
    setEInstructions(ev.instructions || '');
    setEStarts(ev.starts_at ? ev.starts_at.slice(0,16) : '');
    setEEnds(ev.ends_at ? ev.ends_at.slice(0,16) : '');
    setEVenueId(ev.venue_id || undefined);
    setEStatus(ev.status || 'draft');
    setEImageUrl(ev.image_url || '');
    setEditOpen(true);
  };
  const createVenue = async () => {
    setVenueDialogOpen(true);
  };

  const openVenueEdit = (v: Venue) => {
    setVenueEditing(v);
    setVName(v.name || "");
    setVAddress((v as any).address || "");
    setVenueEditOpen(true);
  };

const saveVenueEdit = async () => {
    if (!venueEditing) return;
    const { error } = await supabase
      .from('venues')
      .update({ name: vName, address: vAddress || null })
      .eq('id', (venueEditing as any).id);
    if (error) return alert(error.message);
    setVenues(arr => arr.map(v => v.id === (venueEditing as any).id ? { ...v, name: vName, address: vAddress } : v));
    await logAdmin('venue_updated','venue',(venueEditing as any).id,{ name: vName, address: vAddress });
    setVenueEditOpen(false);
    setVenueEditing(null);
  };
  const createEvent = async () => {
    if (!title || !startsAt) return alert("Title and start are required");
    const { data: session } = await supabase.auth.getSession();
    const created_by = session.session?.user?.id || null;

    // Base payload template
    const base: any = {
      title,
      short_description: shortDesc,
      description: longDesc || null,
      instructions: instructions || null,
      venue_id: venueId || null,
      status: status as any,
      image_url: imageUrl || null,
      created_by,
    };

    try {
      if (eventType === 'single') {
        const payload = {
          ...base,
          starts_at: startsAt,
          ends_at: endsAt || null,
        };
        const { data, error } = await supabase.from("events").insert(payload as any).select("*").single();
        if (error) throw error;
        setEvents((arr) => [data!, ...arr]);
        await logAdmin('event_created','event', data!.id, { title });
      } else {
        if (recurrenceDays.length === 0) return alert('Select at least one weekday for recurrence');
        const startBase = new Date(startsAt);
        const durationMs = endsAt ? (new Date(endsAt).getTime() - startBase.getTime()) : 0;
        const endWindow = addMonths(startBase, recurrenceMonths);
        const rows: any[] = [];
        for (let d = new Date(startBase); d <= endWindow; d = addDays(d, 1)) {
          if (!recurrenceDays.includes(d.getDay())) continue;
          const s = new Date(d);
          s.setHours(startBase.getHours(), startBase.getMinutes(), 0, 0);
          const e = durationMs ? new Date(s.getTime() + durationMs) : null;
          rows.push({
            ...base,
            starts_at: s.toISOString(),
            ends_at: e ? e.toISOString() : null,
            recurrence_text: `Repeats on ${recurrenceDays.map(i=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]).join(', ')} for ${recurrenceMonths} month(s)`,
          });
        }
        if (rows.length === 0) return alert('No dates generated with the selected options.');
        const { data, error } = await supabase.from('events').insert(rows).select('*');
        if (error) throw error;
        setEvents(arr => [ ...(data || []), ...arr ]);
        await logAdmin('events_bulk_created','event', (data && data[0]?.id) || null, { count: data?.length, title });
      }

      // Reset form
      setTitle(""); setShortDesc(""); setLongDesc(""); setInstructions(""); setStartsAt(""); setEndsAt(""); setVenueId(undefined); setStatus("draft"); setImageUrl("");
      setEventType('single'); setRecurrenceDays([]); setRecurrenceMonths(1);
    } catch (error: any) {
      alert(error.message || 'Failed to create event(s)');
    }
  };
  const saveEdit = async () => {
    if (!editingEvent) return;
    const payload: any = {
      title: eTitle,
      short_description: eShort,
      description: eLong || null,
      instructions: eInstructions || null,
      starts_at: eStarts ? new Date(eStarts).toISOString() : null,
      ends_at: eEnds ? new Date(eEnds).toISOString() : null,
      venue_id: eVenueId || null,
      status: eStatus as any,
      image_url: eImageUrl || null,
    };
const { data, error } = await supabase.from('events').update(payload).eq('id', editingEvent.id).select('*').single();
    if (error) return alert(error.message);
    setEvents(arr => arr.map(e => e.id === editingEvent.id ? { ...e, ...data } : e));
    await logAdmin('event_updated','event', editingEvent.id, payload);
    setEditOpen(false);
    setEditingEvent(null);
  };

  const openAddons = async (eventId: string) => {
    setAddonsEventId(eventId);
    const { data } = await supabase
      .from("addons")
      .select("id,name,unit_amount_cents,description")
      .eq("event_id", eventId)
      .order("name");
    setAddons(data || []);
    setAddonsOpen(true);
  };

const addAddon = async () => {
    if (!addonsEventId) return;
    const { data, error } = await supabase
      .from('addons')
      .insert({ event_id: addonsEventId, name: 'New add-on', unit_amount_cents: 500, description: '' })
      .select('id,name,unit_amount_cents,description')
      .single();
    if (error) return alert(error.message);
    setAddons((arr) => [data!, ...arr]);
    await logAdmin('addon_created','addon', data!.id, { name: data!.name, event_id: addonsEventId });
  };

const updateAddonField = async (id: string, patch: Partial<{ name: string; unit_amount_cents: number }>) => {
    const { error } = await supabase.from('addons').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.map(a => a.id===id ? { ...a, ...patch } : a));
    await logAdmin('addon_updated','addon', id, patch);
  };

const deleteAddon = async (id: string) => {
    if (!confirm('Delete this add-on?')) return;
    const { error } = await supabase.from('addons').delete().eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.filter(a => a.id !== id));
    await logAdmin('addon_deleted','addon', id);
  };

  const updateAddonDesc = (id: string, description: string) => {
    setAddons((arr) => arr.map((a) => (a.id === id ? { ...a, description } : a)));
  };

  const saveAddonDescriptions = async () => {
    if (!addonsEventId) return;
    setSavingAddons(true);
    try {
      for (const a of addons) {
        await supabase.from("addons").update({ description: a.description ?? null }).eq("id", a.id);
      }
      setAddonsOpen(false);
    } finally {
      setSavingAddons(false);
    }
  };

  // Tickets
  const openTickets = async (eventId: string) => {
    setTicketsEventId(eventId);
    const { data } = await supabase
      .from('tickets')
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setTicketsOpen(true);
  };

const addTicketSimple = async () => {
    if (!ticketsEventId) return;
    const { data, error } = await supabase
      .from('tickets')
      .insert({ event_id: ticketsEventId, name: 'General', unit_amount_cents: 2000, capacity_total: 100, currency: 'usd', participants_per_ticket: 1, zone: null })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [data!, ...arr]);
    await logAdmin('ticket_created','ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
  };

const addTicketCombo = async () => {
    if (!ticketsEventId) return;
    const { data, error } = await supabase
      .from('tickets')
      .insert({ event_id: ticketsEventId, name: 'Combo (2 participants)', unit_amount_cents: 3500, capacity_total: 100, currency: 'usd', participants_per_ticket: 2, zone: null })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [data!, ...arr]);
    await logAdmin('ticket_created','ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
  };

const addTicketByZone = async () => {
    if (!ticketsEventId) return;
    const { data, error } = await supabase
      .from('tickets')
      .insert({ event_id: ticketsEventId, name: 'By zone', unit_amount_cents: 2500, capacity_total: 100, currency: 'usd', participants_per_ticket: 1, zone: 'General' })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [data!, ...arr]);
    await logAdmin('ticket_created','ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
  };

const updateTicketField = async (
    id: string,
    patch: Partial<{
      name: string;
      unit_amount_cents: number;
      capacity_total: number;
      participants_per_ticket: number;
      zone: string | null;
      early_bird_amount_cents: number | null;
      early_bird_start: string | null;
      early_bird_end: string | null;
    }>
  ) => {
    const { error } = await supabase.from('tickets').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setTickets(arr => arr.map(t => t.id===id ? { ...t, ...patch } : t));
    await logAdmin('ticket_updated','ticket', id, patch);
  };

const deleteTicket = async (id: string) => {
    if (!confirm('Delete this ticket?')) return;
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) return alert(error.message);
    setTickets(arr => arr.filter(t => t.id !== id));
    await logAdmin('ticket_deleted','ticket', id);
  };

  // Attendees
  const openAttendees = async (eventId: string) => {
    setAttendeesEventId(eventId);
    const { data, error } = await supabase
      .from('attendees')
      .select('id,name,email,seat,zone,checked_in_at,created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });
    if (error) return alert(error.message);
    setAttendees(data || []);
    setAttendeesOpen(true);
  };

  // Delete event
  const deleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event? This action cannot be undone.')) return;
    await supabase.from('tickets').delete().eq('event_id', eventId);
    await supabase.from('addons').delete().eq('event_id', eventId);
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) return alert(error.message);
    setEvents(arr => arr.filter(e => e.id !== eventId));
    await logAdmin('event_deleted','event', eventId);
  };

  // Bulk actions
  const bulkUpdateStatus = async (next: 'draft' | 'published' | 'archived') => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase.from('events').update({ status: next }).in('id', selectedIds as any);
    if (error) return alert(error.message);
    setEvents(arr => arr.map(e => selectedIds.includes(e.id) ? { ...e, status: next } : e));
    setSelectedIds([]);
    await logAdmin('events_bulk_status','event', null as any, { next, count: selectedIds.length });
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected event(s)? This cannot be undone.`)) return;
    await supabase.from('tickets').delete().in('event_id', selectedIds as any);
    await supabase.from('addons').delete().in('event_id', selectedIds as any);
    const { error } = await supabase.from('events').delete().in('id', selectedIds as any);
    if (error) return alert(error.message);
    setEvents(arr => arr.filter(e => !selectedIds.includes(e.id)));
    await logAdmin('events_bulk_deleted','event', null as any, { count: selectedIds.length });
    setSelectedIds([]);
  };

  // Export attendees as CSV
  const exportAttendeesCsv = () => {
    const headers = ['Name','Email','Seat','Zone','Checked in','Created at'];
    const rows = attendees.map((a) => [
      a.name || '',
      a.email || '',
      a.seat || '',
      a.zone || '',
      a.checked_in_at ? new Date(a.checked_in_at).toISOString() : '',
      a.created_at ? new Date(a.created_at).toISOString() : '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendees-${attendeesEventId || 'event'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Image upload to Supabase Storage
  const uploadImage = async () => {
    if (!imageFile) return alert('Select an image first');
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, imageFile, { upsert: false });
    if (error) return alert(error.message);
    const { data } = supabase.storage.from('event-images').getPublicUrl(path);
    setImageUrl(data.publicUrl);
    alert('Image uploaded');
  };

  // Image upload for edit dialog
  const uploadEditImage = async () => {
    if (!eImageFile) return alert('Select an image first');
    const ext = eImageFile.name.split('.').pop() || 'jpg';
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, eImageFile, { upsert: false });
    if (error) return alert(error.message);
    const { data } = supabase.storage.from('event-images').getPublicUrl(path);
    setEImageUrl(data.publicUrl);
    alert('Image uploaded');
  };
  // Events ordering + filters
  const displayedEvents = useMemo(() => {
    const monthNum = filterMonth === 'all' ? null : parseInt(filterMonth, 10);
    const yearNum = filterYear === 'all' ? null : parseInt(filterYear, 10);
    const filtered = events.filter((ev) => {
      const d = new Date(ev.starts_at);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const okM = monthNum ? m === monthNum : true;
      const okY = yearNum ? y === yearNum : true;
      return okM && okY;
    });

    const now = Date.now();
    const arr = [...filtered];
    switch (evOrderBy) {
      case 'title-asc':
        return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'title-desc':
        return arr.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      case 'past': {
        const past = arr.filter((ev) => new Date(ev.starts_at).getTime() < now)
          .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
        const future = arr.filter((ev) => new Date(ev.starts_at).getTime() >= now)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        return [...past, ...future];
      }
      case 'upcoming':
      default: {
        const future = arr.filter((ev) => new Date(ev.starts_at).getTime() >= now)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        const past = arr.filter((ev) => new Date(ev.starts_at).getTime() < now)
          .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
        return [...future, ...past];
      }
    }
  }, [events, evOrderBy, filterMonth, filterYear]);
  return (
    <AdminRoute>
      <main className="container mx-auto py-8 space-y-8">
        <Helmet>
          <title>Admin Events | Events</title>
          <meta name="description" content="Create and manage events from the admin panel." />
          <link rel="canonical" href={`${baseUrl}/admin/events`} />
        </Helmet>

        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Manage events</h1>
          <Button asChild variant="outline"><a href="/dashboard">Dashboard</a></Button>
        </header>

        <section className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Create New Event</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <div className="space-y-1">
                <Textarea
                  placeholder="Short description (max 350 characters)"
                  value={shortDesc}
                  onChange={(e)=>{
                    const val = e.target.value;
                    setShortDesc(val.slice(0, 350));
                  }}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {shortDesc.length}/350
                </p>
              </div>
              <div className="space-y-1">
                <Label>Long description</Label>
                <RichMarkdownEditor value={longDesc} onChange={setLongDesc} />
              </div>
              <Textarea placeholder="Event instructions (shown to buyers after purchase)" value={instructions} onChange={(e)=>setInstructions(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Input type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)} />
                <Input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={eventType} onValueChange={(v)=>setEventType(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {eventType === 'recurring' && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                  <div className="space-y-1">
                    <Label>Select weekdays</Label>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, idx) => (
                        <label key={idx} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={recurrenceDays.includes(idx)}
                            onCheckedChange={(v)=>{
                              const checked = Boolean(v);
                              setRecurrenceDays(prev => checked ? Array.from(new Set([...prev, idx])) : prev.filter(i => i!==idx));
                            }}
                          />
                          <span>{d}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Repeat for how many months?</Label>
                    <Input type="number" min={1} max={12} value={recurrenceMonths} onChange={(e)=>setRecurrenceMonths(Math.max(1, Math.min(12, parseInt(e.target.value||'1',10))))} />
                    <p className="text-xs text-muted-foreground">We will create identical events on the selected weekdays for the next {recurrenceMonths} month(s) using the same start time.</p>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Select value={venueId} onValueChange={setVenueId as any}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="secondary" onClick={createVenue}>New venue</Button>
              </div>
              <div className="grid sm:grid-cols-1 gap-3">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 items-center">
                <Input type="file" accept="image/*" onChange={(e)=>setImageFile(e.target.files?.[0] || null)} />
                <Button type="button" variant="secondary" onClick={uploadImage}>Upload image</Button>
                {imageUrl && <span className="text-xs text-muted-foreground truncate" title={imageUrl}>Uploaded ✓</span>}
              </div>
              <Button onClick={createEvent}>Create event</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tickets & add-ons</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="manage-ev">Select event</Label>
                <Select value={manageEventId} onValueChange={(v)=>setManageEventId(v)}>
                  <SelectTrigger id="manage-ev"><SelectValue placeholder="Choose an event" /></SelectTrigger>
                  <SelectContent>
                    {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={()=> manageEventId && openTickets(manageEventId!)} disabled={!manageEventId}>Manage tickets</Button>
                <Button variant="outline" onClick={()=> manageEventId && openAddons(manageEventId!)} disabled={!manageEventId}>Manage add-ons</Button>
                {(ticketsOpen || addonsOpen) && (
                  <Button variant="ghost" onClick={()=>{setTicketsOpen(false); setAddonsOpen(false);}}>Close</Button>
                )}
              </div>

              {/* Inline editors below – no popups */}
              {ticketsOpen && ticketsEventId === manageEventId && (
                <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Tickets</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={addTicketSimple}>Add simple ticket</Button>
                      <Button size="sm" variant="secondary" onClick={addTicketCombo}>Add combo</Button>
                      <Button size="sm" variant="secondary" onClick={addTicketByZone}>Add by zone</Button>
                      <Button size="sm" variant="outline" onClick={()=>setShowAdvancedTicketFields(v=>!v)}>
                        {showAdvancedTicketFields ? 'Hide advanced' : 'Show advanced'}
                      </Button>
                    </div>
                  </div>
                  {tickets.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tickets yet.</p>
                  )}
                  {tickets.map((t) => {
                    const earlyEnabled = Boolean(t.early_bird_amount_cents && t.early_bird_start && t.early_bird_end);
                    return (
                      <div key={t.id} className="p-4 border rounded-md bg-card space-y-3">
                        <div className="grid sm:grid-cols-6 gap-3 items-center">
                          <div className="sm:col-span-2 space-y-1">
                            <Label>Name</Label>
                            <Input defaultValue={t.name} onBlur={(e)=>updateTicketField(t.id, { name: e.currentTarget.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label>Price ({(t.currency || 'usd').toUpperCase()})</Label>
                            {(() => {
                              let priceEl: HTMLInputElement | null = null;
                              return (
                                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                  <Input
                                    ref={(el) => (priceEl = el)}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={(t.unit_amount_cents / 100).toFixed(2)}
                                    className="flex-1 min-w-[140px]"
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      updateTicketField(t.id, {
                                        unit_amount_cents: Math.round(
                                          parseFloat(priceEl?.value || '0') * 100
                                        ),
                                      })
                                    }
                                  >
                                    Save
                                  </Button>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="space-y-1">
                            <Label>Capacity</Label>
                            <Input type="number" min={0} defaultValue={t.capacity_total || 0}
                              onBlur={(e)=>updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                            />
                          </div>
                          {showAdvancedTicketFields && (
                            <>
                              <div className="space-y-1">
                                <Label>Participants per ticket</Label>
                                <Input type="number" min={1} defaultValue={t.participants_per_ticket || 1}
                                  onBlur={(e)=>updateTicketField(t.id, { participants_per_ticket: parseInt(e.currentTarget.value || '1', 10) })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Zone</Label>
                                <Input defaultValue={t.zone || ''}
                                  onBlur={(e)=>updateTicketField(t.id, { zone: e.currentTarget.value || null })}
                                />
                              </div>
                            </>
                          )}
                          <div className="flex justify-end">
                            <Button variant="destructive" size="sm" onClick={()=>deleteTicket(t.id)}>Delete</Button>
                          </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Early bird</Label>
                              <p className="text-xs text-muted-foreground">Limited-time promotional price</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{earlyEnabled ? 'Active' : 'Inactive'}</span>
                              <Switch
                                checked={earlyEnabled}
                                onCheckedChange={(checked)=>{
                                  if (!checked) {
                                    updateTicketField(t.id, { early_bird_amount_cents: null, early_bird_start: null, early_bird_end: null });
                                  } else {
                                    const nowIso = new Date().toISOString();
                                    updateTicketField(t.id, { early_bird_amount_cents: Math.max(0, Math.round((t.unit_amount_cents * 0.8))), early_bird_start: nowIso, early_bird_end: nowIso });
                                  }
                                }}
                              />
                            </div>
                          </div>
                          {earlyEnabled && (
                            <div className="grid sm:grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <Label>Early price</Label>
                                <Input type="number" step="0.01" min="0" defaultValue={((t.early_bird_amount_cents||0)/100).toFixed(2)}
                                  onBlur={(e)=>updateTicketField(t.id, { early_bird_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <Label>Start</Label>
                                <Input type="datetime-local" defaultValue={t.early_bird_start ? new Date(t.early_bird_start).toISOString().slice(0,16) : ''}
                                  onBlur={(e)=>updateTicketField(t.id, { early_bird_start: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <Label>End</Label>
                                <Input type="datetime-local" defaultValue={t.early_bird_end ? new Date(t.early_bird_end).toISOString().slice(0,16) : ''}
                                  onBlur={(e)=>updateTicketField(t.id, { early_bird_end: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {addonsOpen && addonsEventId === manageEventId && (
                <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Add-ons</h4>
                    <Button size="sm" variant="secondary" onClick={addAddon}>Add add-on</Button>
                  </div>
                  {addons.length === 0 && (
                    <p className="text-sm text-muted-foreground">No add-ons for this event yet.</p>
                  )}
                  {addons.map((a) => (
                    <div key={a.id} className="p-3 border rounded-md bg-card space-y-2">
                      <div className="grid sm:grid-cols-3 gap-2 items-center">
                        <Input defaultValue={a.name} onBlur={(e)=>updateAddonField(a.id, { name: e.currentTarget.value })} />
                        <Input type="number" step="0.01" min="0" defaultValue={(a.unit_amount_cents/100).toFixed(2)}
                          onBlur={(e)=>updateAddonField(a.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                        />
                        <div className="flex justify-end">
                          <Button variant="destructive" size="sm" onClick={()=>deleteAddon(a.id)}>Delete</Button>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Brief description (max ~30 words)"
                        value={a.description ?? ''}
                        onChange={(e)=>updateAddonDesc(a.id, e.target.value)}
                      />
                    </div>
                  ))}
                  {addons.length > 0 && (
                    <div className="flex justify-end">
                      <Button onClick={saveAddonDescriptions} disabled={savingAddons}>{savingAddons ? 'Saving…' : 'Save descriptions'}</Button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">Use these tools to define ticket types and optional add-ons for the selected event.</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">All events</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm text-muted-foreground">Month</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-28"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {['1','2','3','4','5','6','7','8','9','10','11','12'].map(m=> (
                    <SelectItem key={m} value={m}>{new Date(2025, parseInt(m)-1, 1).toLocaleString(undefined,{month:'short'})}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-sm text-muted-foreground">Year</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-28"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Array.from(new Set(events.map(e=> new Date(e.starts_at).getFullYear()))).sort().map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="text-sm text-muted-foreground">Order</Label>
              <Select value={evOrderBy} onValueChange={setEvOrderBy as any}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming first</SelectItem>
                  <SelectItem value="past">Past first</SelectItem>
                  <SelectItem value="title-asc">Title A–Z</SelectItem>
                  <SelectItem value="title-desc">Title Z–A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 border rounded-md bg-muted/30">
              <span className="text-sm">Selected: {selectedIds.length}</span>
              <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('published')}>Publish</Button>
              <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('draft')}>Mark draft</Button>
              <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('archived')}>Archive</Button>
              <Button size="sm" variant="destructive" onClick={bulkDelete}>Delete</Button>
              <Button size="sm" variant="secondary" onClick={()=>setSelectedIds([])}>Clear</Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-3 pr-4 w-10">
                    <Checkbox
                      checked={displayedEvents.length>0 && selectedIds.length === displayedEvents.length}
                      onCheckedChange={(v)=>{
                        const checked = Boolean(v);
                        setSelectedIds(checked ? displayedEvents.map(e=>e.id) : []);
                      }}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Start</th>
                  <th className="py-3 pr-4">Venue</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEvents.map(ev => (
                  <tr key={ev.id} className="border-b">
                    <td className="py-3 pr-4">
                      <Checkbox
                        checked={selectedIds.includes(ev.id)}
                        onCheckedChange={(v)=>{
                          const checked = Boolean(v);
                          setSelectedIds(prev => checked ? Array.from(new Set([...prev, ev.id])) : prev.filter(id => id !== ev.id));
                        }}
                        aria-label={`Select ${ev.title}`}
                      />
                    </td>
                    <td className="py-3 pr-4 font-medium">{ev.title}</td>
                    <td className="py-3 pr-4">{new Date(ev.starts_at).toLocaleString()}</td>
                    <td className="py-3 pr-4">{ev.venues?.name || '-'}</td>
                    <td className="py-3 pr-4 capitalize">{ev.status}</td>
                    <td className="py-3 pr-4 flex flex-wrap gap-2">
                      <Button size="icon" variant="outline" title="Toggle publish" aria-label="Toggle publish" onClick={async ()=>{
                        const next = ev.status === 'published' ? 'draft' : 'published';
                        const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                        if (!error) {
                          setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                          await logAdmin('event_status_toggled','event', ev.id, { from: ev.status, to: next });
                        }
                      }}>
                        <Megaphone className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" title="Edit" aria-label="Edit" onClick={()=>openEdit(ev)} disabled={isEventPast(ev)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" title="Attendees" aria-label="Attendees" onClick={()=>openAttendees(ev.id)}>
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button size="icon" asChild title="View" aria-label="View">
                        <a href={`/event/${ev.id}`} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="destructive" title="Delete" aria-label="Delete" onClick={()=>deleteEvent(ev.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Dialog open={false} onOpenChange={setAddonsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage add-ons</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {addons.length === 0 && (
                <p className="text-sm text-muted-foreground">No add-ons for this event yet.</p>
              )}
              {addons.map((a) => (
                <div key={a.id} className="p-3 border rounded-md bg-card space-y-2">
                  <div className="grid sm:grid-cols-3 gap-2 items-center">
                    <Input defaultValue={a.name} onBlur={(e)=>updateAddonField(a.id, { name: e.currentTarget.value })} />
                    <Input type="number" step="0.01" min="0" defaultValue={(a.unit_amount_cents/100).toFixed(2)}
                      onBlur={(e)=>updateAddonField(a.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                    />
                    <div className="flex justify-end">
                      <Button variant="destructive" size="sm" onClick={()=>deleteAddon(a.id)}>Delete</Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Brief description (max ~30 words)"
                    value={a.description ?? ''}
                    onChange={(e)=>updateAddonDesc(a.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="secondary" onClick={addAddon}>Add add-on</Button>
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={()=>setAddonsOpen(false)}>Close</Button>
                <Button onClick={saveAddonDescriptions} disabled={savingAddons || addons.length===0}>{savingAddons? 'Saving...' : 'Save descriptions'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tickets dialog */}
        <Dialog open={false} onOpenChange={setTicketsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage tickets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <p className="text-sm text-muted-foreground">
                Define ticket types, prices, capacities and early-bird options. Use “Advanced” for zones and participants per ticket.
              </p>
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={()=>setShowAdvancedTicketFields(v=>!v)}>
                  {showAdvancedTicketFields ? 'Hide advanced' : 'Show advanced'}
                </Button>
              </div>
              {tickets.length === 0 && (
                <p className="text-sm text-muted-foreground">No tickets yet.</p>
              )}
              {tickets.map((t) => {
                const earlyEnabled = Boolean(t.early_bird_amount_cents && t.early_bird_start && t.early_bird_end);
                return (
                  <div key={t.id} className="p-4 border rounded-md bg-card space-y-3">
                    <div className="grid sm:grid-cols-6 gap-3 items-center">
                      <div className="sm:col-span-2 space-y-1">
                        <Label>Name</Label>
                        <Input defaultValue={t.name} onBlur={(e)=>updateTicketField(t.id, { name: e.currentTarget.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Price ({(t.currency || 'usd').toUpperCase()})</Label>
                        {(() => {
                          let priceEl: HTMLInputElement | null = null;
                          return (
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                              <Input
                                ref={(el) => (priceEl = el)}
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={(t.unit_amount_cents / 100).toFixed(2)}
                                className="flex-1 min-w-[140px]"
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  updateTicketField(t.id, {
                                    unit_amount_cents: Math.round(
                                      parseFloat(priceEl?.value || '0') * 100
                                    ),
                                  })
                                }
                              >
                                Save
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="space-y-1">
                        <Label>Capacity</Label>
                        <Input type="number" min={0} defaultValue={t.capacity_total || 0}
                          onBlur={(e)=>updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                        />
                      </div>
                      {showAdvancedTicketFields && (
                        <>
                          <div className="space-y-1">
                            <Label>Participants per ticket</Label>
                            <Input type="number" min={1} defaultValue={t.participants_per_ticket || 1}
                              onBlur={(e)=>updateTicketField(t.id, { participants_per_ticket: parseInt(e.currentTarget.value || '1', 10) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Zone</Label>
                            <Input defaultValue={t.zone || ''}
                              onBlur={(e)=>updateTicketField(t.id, { zone: e.currentTarget.value || null })}
                            />
                          </div>
                        </>
                      )}
                      <div className="flex justify-end">
                        <Button variant="destructive" size="sm" onClick={()=>deleteTicket(t.id)}>Delete</Button>
                      </div>
                    </div>

                    {/* Early bird */}
                    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Early bird</Label>
                          <p className="text-xs text-muted-foreground">Limited-time promotional price</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{earlyEnabled ? 'Active' : 'Inactive'}</span>
                          <Switch
                            checked={earlyEnabled}
                            onCheckedChange={(checked)=>{
                              if (!checked) {
                                updateTicketField(t.id, { early_bird_amount_cents: null, early_bird_start: null, early_bird_end: null });
                              } else {
                                const nowIso = new Date().toISOString();
                                updateTicketField(t.id, { early_bird_amount_cents: Math.max(0, Math.round((t.unit_amount_cents * 0.8))), early_bird_start: nowIso, early_bird_end: nowIso });
                              }
                            }}
                          />
                        </div>
                      </div>
                      {earlyEnabled && (
                        <div className="grid sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label>Early price</Label>
                            <Input type="number" step="0.01" min="0" defaultValue={((t.early_bird_amount_cents||0)/100).toFixed(2)}
                              onBlur={(e)=>updateTicketField(t.id, { early_bird_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Start</Label>
                            <Input type="datetime-local" defaultValue={t.early_bird_start ? new Date(t.early_bird_start).toISOString().slice(0,16) : ''}
                              onBlur={(e)=>updateTicketField(t.id, { early_bird_start: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>End</Label>
                            <Input type="datetime-local" defaultValue={t.early_bird_end ? new Date(t.early_bird_end).toISOString().slice(0,16) : ''}
                              onBlur={(e)=>updateTicketField(t.id, { early_bird_end: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={addTicketSimple}>Add simple ticket</Button>
              <Button variant="secondary" onClick={addTicketCombo}>Add combo (multi-participant)</Button>
              <Button variant="secondary" onClick={addTicketByZone}>Add ticket by zone</Button>
              <Button variant="secondary" onClick={()=>setTicketsOpen(false)} className="ml-auto">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit event dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={eTitle} onChange={(e)=>setETitle(e.target.value)} />
              <div className="space-y-1">
                <Textarea
                  placeholder="Short description (max 350 characters)"
                  value={eShort}
                  onChange={(e)=>{
                    const val = e.target.value;
                    setEShort(val.slice(0, 350));
                  }}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {eShort.length}/350
                </p>
              </div>
              <div className="space-y-1">
                <Label>Long description</Label>
                <RichMarkdownEditor value={eLong} onChange={setELong} />
              </div>
              <Textarea placeholder="Event instructions (shown to buyers after purchase)" value={eInstructions} onChange={(e)=>setEInstructions(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Input type="datetime-local" value={eStarts} onChange={(e)=>setEStarts(e.target.value)} />
                <Input type="datetime-local" value={eEnds} onChange={(e)=>setEEnds(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Select value={eVenueId} onValueChange={setEVenueId as any}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={eStatus} onValueChange={setEStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 items-center">
                <Input type="file" accept="image/*" onChange={(e)=>setEImageFile(e.target.files?.[0] || null)} />
                <Button type="button" variant="secondary" onClick={uploadEditImage}>Upload image</Button>
                {eImageUrl && <span className="text-xs text-muted-foreground truncate" title={eImageUrl}>Uploaded ✓</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Button>
              <Button onClick={saveEdit}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Attendees dialog */}
        <Dialog open={attendeesOpen} onOpenChange={setAttendeesOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Attendees ({attendees.length})</DialogTitle>
            </DialogHeader>
            <div className="mb-3">
              <Input placeholder="Search by name or email" value={attendeesSearch} onChange={(e)=>setAttendeesSearch(e.target.value)} />
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Seat</th>
                    <th className="py-2 pr-3">Zone</th>
                    <th className="py-2 pr-3">Checked in</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.map(a => (
                    <tr key={a.id} className="border-b">
                      <td className="py-2 pr-3">{a.name || '-'}</td>
                      <td className="py-2 pr-3">{a.email || '-'}</td>
                      <td className="py-2 pr-3">{a.seat || '-'}</td>
                      <td className="py-2 pr-3">{a.zone || '-'}</td>
                      <td className="py-2 pr-3">{a.checked_in_at ? new Date(a.checked_in_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={exportAttendeesCsv}>Export CSV</Button>
              <Button variant="secondary" onClick={()=>setAttendeesOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={venueEditOpen} onOpenChange={setVenueEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit venue</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name" value={vName} onChange={(e)=>setVName(e.target.value)} />
              <Input placeholder="Address" value={vAddress} onChange={(e)=>setVAddress(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={()=>setVenueEditOpen(false)}>Cancel</Button>
              <Button onClick={saveVenueEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <VenueCreateDialog
          open={venueDialogOpen}
          onOpenChange={setVenueDialogOpen}
          onCreated={handleVenueCreated}
        />
      </main>
    </AdminRoute>
  );
};

export default AdminEvents;
