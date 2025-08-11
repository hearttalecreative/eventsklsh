import { useEffect, useMemo, useState } from "react";
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

interface Venue { id: string; name: string; address?: string | null; }

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

  // Sorting for events table
  const [evOrderBy, setEvOrderBy] = useState<'upcoming'|'past'|'title-asc'|'title-desc'>("upcoming");

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

  // Tickets advanced fields
  const [showAdvancedTicketFields, setShowAdvancedTicketFields] = useState(false);

  // Venue create dialog state
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const location = useLocation();

  const handleVenueCreated = (venue: Venue) => {
    setVenues((arr) => [...arr, venue]);
    setVenueId(venue.id);
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

  // Auto-open edit dialog when coming from dashboard with ?edit=<id>
  useEffect(() => {
    if (!loading) {
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit');
      if (editId) {
        const ev = events.find(e => e.id === editId);
        if (ev) openEdit(ev);
      }
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
    setEditOpen(true);
  };
  const createVenue = async () => {
    setVenueDialogOpen(true);
  };

  const createEvent = async () => {
    if (!title || !startsAt) return alert("Title and start are required");
    const { data: session } = await supabase.auth.getSession();
    const created_by = session.session?.user?.id || null;
    const payload: any = {
      title,
      short_description: shortDesc,
      description: longDesc || null,
      instructions: instructions || null,
      starts_at: startsAt,
      ends_at: endsAt || null,
      venue_id: venueId || null,
      status: status as any,
      image_url: imageUrl || null,
      created_by,
    };
    const { data, error } = await supabase.from("events").insert(payload as any).select("*").single();
    if (error) return alert(error.message);
    setEvents((arr) => [data!, ...arr]);
    setTitle(""); setShortDesc(""); setLongDesc(""); setInstructions(""); setStartsAt(""); setEndsAt(""); setVenueId(undefined); setStatus("draft"); setImageUrl("");
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
    };
    const { data, error } = await supabase.from('events').update(payload).eq('id', editingEvent.id).select('*').single();
    if (error) return alert(error.message);
    setEvents(arr => arr.map(e => e.id === editingEvent.id ? { ...e, ...data } : e));
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
  };

  const updateAddonField = async (id: string, patch: Partial<{ name: string; unit_amount_cents: number }>) => {
    const { error } = await supabase.from('addons').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.map(a => a.id===id ? { ...a, ...patch } : a));
  };

  const deleteAddon = async (id: string) => {
    if (!confirm('Delete this add-on?')) return;
    const { error } = await supabase.from('addons').delete().eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.filter(a => a.id !== id));
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
  };

  const deleteTicket = async (id: string) => {
    if (!confirm('Delete this ticket?')) return;
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) return alert(error.message);
    setTickets(arr => arr.filter(t => t.id !== id));
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

  // Events ordering
  const sortedEvents = useMemo(() => {
    const now = Date.now();
    const arr = [...events];
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
  }, [events, evOrderBy]);
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
            <CardHeader><CardTitle>Quick create</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <Textarea placeholder="Short description" value={shortDesc} onChange={(e)=>setShortDesc(e.target.value)} />
              <Textarea placeholder="Long description (Basic Markdown allowed)" value={longDesc} onChange={(e)=>setLongDesc(e.target.value)} />
              <Textarea placeholder="Event instructions (shown to buyers after purchase)" value={instructions} onChange={(e)=>setInstructions(e.target.value)} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Input type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)} />
                <Input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)} />
              </div>
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
            <CardContent className="space-y-3">
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
                <Button variant="secondary" onClick={()=> manageEventId && openTickets(manageEventId)} disabled={!manageEventId}>Manage tickets</Button>
                <Button variant="outline" onClick={()=> manageEventId && openAddons(manageEventId)} disabled={!manageEventId}>Manage add-ons</Button>
              </div>
              <p className="text-xs text-muted-foreground">Use these tools to define ticket types and optional add-ons for the selected event.</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All events</h2>
            <div className="flex items-center gap-2">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Start</th>
                  <th className="py-3 pr-4">Venue</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map(ev => (
                  <tr key={ev.id} className="border-b">
                    <td className="py-3 pr-4 font-medium">{ev.title}</td>
                    <td className="py-3 pr-4">{new Date(ev.starts_at).toLocaleString()}</td>
                    <td className="py-3 pr-4">{ev.venues?.name || '-'}</td>
                    <td className="py-3 pr-4 capitalize">{ev.status}</td>
                    <td className="py-3 pr-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={async ()=>{
                        const next = ev.status === 'published' ? 'draft' : 'published';
                        const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                        if (!error) setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                      }}>Toggle publish</Button>
                      <Button size="sm" variant="outline" onClick={()=>openEdit(ev)} disabled={isEventPast(ev)}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={()=>openTickets(ev.id)}>Manage tickets</Button>
                      <Button size="sm" variant="secondary" onClick={()=>openAddons(ev.id)}>Manage add-ons</Button>
                      <Button size="sm" variant="outline" onClick={()=>openAttendees(ev.id)}>Attendees</Button>
                      <Button size="sm" asChild><a href={`/event/${ev.id}`} target="_blank" rel="noopener noreferrer">View</a></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Dialog open={addonsOpen} onOpenChange={setAddonsOpen}>
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
        <Dialog open={ticketsOpen} onOpenChange={setTicketsOpen}>
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
                        <Input type="number" step="0.01" min="0" defaultValue={(t.unit_amount_cents/100).toFixed(2)}
                          onBlur={(e)=>updateTicketField(t.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                        />
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
              <Textarea placeholder="Short description" value={eShort} onChange={(e)=>setEShort(e.target.value)} />
              <Textarea placeholder="Long description (Basic Markdown allowed)" value={eLong} onChange={(e)=>setELong(e.target.value)} />
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
                  {attendees.map(a => (
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
