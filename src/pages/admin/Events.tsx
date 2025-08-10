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
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venueId, setVenueId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState("draft");
  
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: v } = await supabase.from("venues").select("id,name").order("name");
      setVenues(v || []);
      const { data: ev } = await supabase.from("events").select("*, venues:venue_id(name)").order("created_at", { ascending: false });
      setEvents(ev || []);
      setLoading(false);
    };
    load();
  }, []);

  function isEventPast(ev: any) {
    const endOrStart = ev.ends_at ? new Date(ev.ends_at) : new Date(ev.starts_at);
    return endOrStart < new Date();
  }

  const editEvent = async (ev: any) => {
    if (isEventPast(ev)) { alert('No se puede modificar un evento pasado.'); return; }
    const nextTitle = prompt('Nuevo título', ev.title) ?? ev.title;
    const nextShort = prompt('Descripción corta', ev.short_description || '') ?? (ev.short_description || '');
    const nextLong = prompt('Descripción larga (Markdown básico)', ev.description || '') ?? (ev.description || '');
    const starts = prompt('Inicio (YYYY-MM-DDTHH:MM)', ev.starts_at?.slice(0,16)) ?? ev.starts_at;
    const ends = prompt('Fin (YYYY-MM-DDTHH:MM, opcional)', ev.ends_at ? ev.ends_at.slice(0,16) : '') ?? ev.ends_at;
    const payload: any = {
      title: nextTitle,
      short_description: nextShort,
      description: nextLong,
      starts_at: starts ? new Date(starts).toISOString() : null,
      ends_at: ends ? new Date(ends).toISOString() : null,
    };
    const { data, error } = await supabase.from('events').update(payload).eq('id', ev.id).select('*').single();
    if (error) return alert(error.message);
    setEvents(arr => arr.map(e => e.id===ev.id ? { ...e, ...data } : e));
  };
  const createVenue = async () => {
    const name = prompt("Venue name");
    if (!name) return;
    const address = prompt("Venue address (street, city)") || null;
    const { data, error } = await supabase
      .from("venues")
      .insert({ name, address })
      .select("id,name,address")
      .single();
    if (error) return alert(error.message);
    setVenues((arr) => [...arr, data!]);
    setVenueId(data!.id);
  };

  const createEvent = async () => {
    if (!title || !startsAt) return alert("Title and start are required");
    const { data: session } = await supabase.auth.getSession();
    const created_by = session.session?.user?.id || null;
    const payload: any = {
      title,
      short_description: shortDesc,
      description: longDesc || null,
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
    setTitle(""); setShortDesc(""); setStartsAt(""); setEndsAt(""); setVenueId(undefined); setStatus("draft"); setImageUrl("");
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
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone')
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
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [data!, ...arr]);
  };

  const addTicketCombo = async () => {
    if (!ticketsEventId) return;
    const { data, error } = await supabase
      .from('tickets')
      .insert({ event_id: ticketsEventId, name: 'Combo (2 participantes)', unit_amount_cents: 3500, capacity_total: 100, currency: 'usd', participants_per_ticket: 2, zone: null })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [data!, ...arr]);
  };

  const addTicketByZone = async () => {
    if (!ticketsEventId) return;
    const { data, error } = await supabase
      .from('tickets')
      .insert({ event_id: ticketsEventId, name: 'Por ubicación', unit_amount_cents: 2500, capacity_total: 100, currency: 'usd', participants_per_ticket: 1, zone: 'General' })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [data!, ...arr]);
  };

  const updateTicketField = async (id: string, patch: Partial<{ name: string; unit_amount_cents: number; capacity_total: number; participants_per_ticket: number; zone: string | null }>) => {
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
              <Textarea placeholder="Long description (Markdown básico permitido)" value={longDesc} onChange={(e)=>setLongDesc(e.target.value)} />
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
            <CardHeader><CardTitle>Tips</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>- After creating an event, add Tickets and Add-ons from the event editor (coming next).</p>
              <p>- Publish to make it visible on the public site.</p>
              <p>- Use Dashboard for analytics and exports.</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">All events</h2>
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
                {events.map(ev => (
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
                      <Button size="sm" variant="outline" onClick={()=>editEvent(ev)} disabled={isEventPast(ev)}>Edit</Button>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage tickets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {tickets.length === 0 && (
                <p className="text-sm text-muted-foreground">No tickets yet.</p>
              )}
              {tickets.map((t) => (
                <div key={t.id} className="p-3 border rounded-md bg-card">
                  <div className="grid sm:grid-cols-6 gap-2 items-center">
                    <Input defaultValue={t.name} onBlur={(e)=>updateTicketField(t.id, { name: e.currentTarget.value })} />
                    <Input type="number" step="0.01" min="0" defaultValue={(t.unit_amount_cents/100).toFixed(2)}
                      onBlur={(e)=>updateTicketField(t.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                    />
                    <Input type="number" min={0} defaultValue={t.capacity_total || 0}
                      onBlur={(e)=>updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                    />
                    <Input type="number" min={1} defaultValue={t.participants_per_ticket || 1}
                      onBlur={(e)=>updateTicketField(t.id, { participants_per_ticket: parseInt(e.currentTarget.value || '1', 10) })}
                    />
                    <Input defaultValue={t.zone || ''}
                      onBlur={(e)=>updateTicketField(t.id, { zone: e.currentTarget.value || null })}
                    />
                    <div className="flex justify-end">
                      <Button variant="destructive" size="sm" onClick={()=>deleteTicket(t.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={addTicketSimple}>Agregar ticket simple</Button>
              <Button variant="secondary" onClick={addTicketCombo}>Agregar combo (multi-participante)</Button>
              <Button variant="secondary" onClick={addTicketByZone}>Agregar ticket por ubicación</Button>
              <Button variant="secondary" onClick={()=>setTicketsOpen(false)} className="ml-auto">Close</Button>
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
              <Button variant="secondary" onClick={()=>setAttendeesOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AdminRoute>
  );
};

export default AdminEvents;
