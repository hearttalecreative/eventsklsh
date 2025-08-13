import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import AdminRoute from "@/routes/AdminRoute";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  event_title: string | null;
  venue_name: string | null;
}

const ParticipantsPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [venueId, setVenueId] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: v } = await supabase.from("venues").select("id,name").order("name");
      setVenues(v || []);
      const { data } = await supabase
        .from("attendees")
        .select("id, name, email, phone, created_at, event_id")
        .order("created_at", { ascending: false });
      const eventIds = Array.from(new Set((data || []).map((r: any) => r.event_id)));
      const [{ data: evs }, { data: vmap }] = await Promise.all([
        supabase.from("events").select("id,title,venue_id").in("id", eventIds),
        supabase.from("venues").select("id,name").in("id", Array.from(new Set((data || []).map((r: any) => r.event_id))) as any),
      ]);
      const evTitle = new Map((evs || []).map((e: any) => [e.id, { title: e.title, venue_id: e.venue_id }]));
      const venueNameById = new Map((v || []).map((vv: any) => [vv.id, vv.name]));
      setRows(
        (data || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          created_at: a.created_at,
          event_title: evTitle.get(a.event_id)?.title || null,
          venue_name: venueNameById.get(evTitle.get(a.event_id)?.venue_id) || null,
        }))
      );
    })();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) =>
      (venueId === "all" || r.venue_name === venues.find((v) => v.id === venueId)?.name) &&
      (!ql || [r.name, r.email, r.phone, r.event_title, r.venue_name].some((f) => (f || "").toLowerCase().includes(ql)))
    );
  }, [rows, q, venueId, venues]);

  const exportCsv = () => {
    const header = ["Name","Email","Phone","Event","Venue","Created_at"];
    const lines = [header.join(",")].concat(
      filtered.map((r) => [r.name||'', r.email||'', r.phone||'', r.event_title||'', r.venue_name||'', r.created_at].map((x)=>`"${String(x).replace(/"/g,'""')}"`).join(","))
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participants.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminRoute>
      <main className="container mx-auto py-10 space-y-6">
        <Helmet>
          <title>Participants | Admin</title>
          <meta name="description" content="View and export all event participants, filterable by venue." />
          <link rel="canonical" href={`${baseUrl}/admin/participants`} />
        </Helmet>
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-semibold">Participants</h1>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name, email, phone, event…" value={q} onChange={(e)=>setQ(e.target.value)} className="w-64" />
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All venues" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All venues</SelectItem>
                {venues.map(v=> <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={exportCsv}>Export CSV</Button>
          </div>
        </header>
        <section className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Event</th>
                  <th className="py-2 px-3">Venue</th>
                  <th className="py-2 px-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r)=> (
                  <tr key={r.id} className="border-b">
                    <td className="py-2 px-3">{r.name || '-'}</td>
                    <td className="py-2 px-3">{r.email || '-'}</td>
                    <td className="py-2 px-3">{r.phone || '-'}</td>
                    <td className="py-2 px-3">{r.event_title || '-'}</td>
                    <td className="py-2 px-3">{r.venue_name || '-'}</td>
                    <td className="py-2 px-3">{new Date(r.created_at).toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">No participants found.</div>
          )}
        </section>
      </main>
    </AdminRoute>
  );
};

export default ParticipantsPage;
