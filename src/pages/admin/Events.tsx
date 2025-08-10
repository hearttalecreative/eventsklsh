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

interface Venue { id: string; name: string; }

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

  // Form state for quick create
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venueId, setVenueId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState("draft");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");

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

  const createVenue = async () => {
    const name = prompt("Venue name");
    if (!name) return;
    const { data, error } = await supabase.from("venues").insert({ name }).select("id,name").single();
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
      starts_at: startsAt,
      ends_at: endsAt || null,
      venue_id: venueId || null,
      status: status as any,
      sku: sku || null,
      image_url: imageUrl || null,
      created_by,
    };
    const { data, error } = await supabase.from("events").insert(payload as any).select("*").single();
    if (error) return alert(error.message);
    setEvents((arr) => [data!, ...arr]);
    setTitle(""); setShortDesc(""); setStartsAt(""); setEndsAt(""); setVenueId(undefined); setStatus("draft"); setSku(""); setImageUrl("");
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
              <div className="grid sm:grid-cols-3 gap-3">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="SKU" value={sku} onChange={(e)=>setSku(e.target.value)} />
                <Input placeholder="Image URL" value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} />
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
                    <td className="py-3 pr-4 flex gap-2">
                      <Button size="sm" variant="outline" onClick={async ()=>{
                        const next = ev.status === 'published' ? 'draft' : 'published';
                        const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                        if (!error) setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                      }}>Toggle publish</Button>
                      <Button size="sm" variant="secondary" onClick={()=>openAddons(ev.id)}>Manage add-ons</Button>
                      <Button size="sm" asChild><a href={`/event/${ev.id}`}>View</a></Button>
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
              <DialogTitle>Manage add-on descriptions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {addons.length === 0 && (
                <p className="text-sm text-muted-foreground">No add-ons for this event yet.</p>
              )}
              {addons.map((a) => (
                <div key={a.id} className="p-3 border rounded-md bg-card">
                  <div className="font-medium">{a.name} <span className="text-xs text-muted-foreground">({(a.unit_amount_cents/100).toLocaleString(undefined,{style:'currency',currency:'USD'})})</span></div>
                  <Textarea
                    placeholder="Brief description (max ~30 words)"
                    value={a.description ?? ''}
                    onChange={(e)=>updateAddonDesc(a.id, e.target.value)}
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={()=>setAddonsOpen(false)}>Close</Button>
              <Button onClick={saveAddonDescriptions} disabled={savingAddons || addons.length===0}>{savingAddons? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AdminRoute>
  );
};

export default AdminEvents;
