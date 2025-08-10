import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { events as mockEvents } from "@/data/events";
import { EventItem, TicketType } from "@/types/events";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSupabaseEventsList } from "@/hooks/useSupabaseEvents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";

function effectiveUnitAmount(ticket: TicketType, now = new Date()): number {
  if (
    ticket.earlyBirdAmountCents &&
    ticket.earlyBirdStart &&
    ticket.earlyBirdEnd &&
    now >= new Date(ticket.earlyBirdStart) &&
    now <= new Date(ticket.earlyBirdEnd)
  ) {
    return ticket.earlyBirdAmountCents;
  }
  return ticket.unitAmountCents;
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function capacityForEvent(ev: EventItem) {
  if (typeof ev.capacityTotal === "number") return ev.capacityTotal;
  return ev.tickets.reduce((sum, t) => sum + (t.capacityTotal || 0), 0);
}

const Dashboard = () => {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const { data: supa } = useSupabaseEventsList();

  const source = useMemo(() => (supa && supa.length ? supa : mockEvents), [supa]);
  const usingSupabase = Boolean(supa && supa.length);

  const filtered = useMemo(() => {
    return source.filter((ev) => {
      const matchesQ = q
        ? ev.title.toLowerCase().includes(q.toLowerCase()) ||
          ev.shortDescription.toLowerCase().includes(q.toLowerCase())
        : true;
      const matchesStatus = status === "all" ? true : ev.status === (status as any);
      const start = new Date(ev.startsAt).getTime();
      const fromOk = from ? start >= new Date(from).getTime() : true;
      const toOk = to ? start <= new Date(to).getTime() : true;
      return matchesQ && matchesStatus && fromOk && toOk;
    });
  }, [source, q, status, from, to]);

  const kpis = useMemo(() => {
    const totalEvents = filtered.length;
    const totalCapacity = filtered.reduce((s, ev) => s + capacityForEvent(ev), 0);
    const minPrices = filtered.map((ev) => Math.min(...ev.tickets.map((t) => effectiveUnitAmount(t))));
    const avgMinPrice = minPrices.length ? Math.round(minPrices.reduce((a, b) => a + b, 0) / minPrices.length) : 0;
    const published = filtered.filter((e) => e.status === "published").length;
    return { totalEvents, totalCapacity, avgMinPrice, published };
  }, [filtered]);

  const chartData = useMemo(
    () =>
      filtered.map((ev) => ({
        name: ev.title.length > 18 ? ev.title.slice(0, 18) + "…" : ev.title,
        capacity: capacityForEvent(ev),
      })),
    [filtered]
  );

  // Sort events by the nearest upcoming first; past events are listed after future ones
  const sorted = useMemo(() => {
    const now = Date.now();
    const future = filtered
      .filter((ev) => new Date(ev.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    const past = filtered
      .filter((ev) => new Date(ev.startsAt).getTime() < now)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
    return [...future, ...past];
  }, [filtered]);

  function exportCsv() {
    const rows = [
      [
        "id",
        "title",
        "startsAt",
        "endsAt",
        "venueName",
        "venueAddress",
        "status",
        "capacity",
        "minPriceCents",
        "currency",
        "couponCode",
      ],
      ...filtered.map((ev) => {
        const minTicket = ev.tickets.reduce((acc, t) =>
          effectiveUnitAmount(t) < effectiveUnitAmount(acc) ? t : acc
        );
        return [
          ev.id,
          ev.title,
          ev.startsAt,
          ev.endsAt,
          ev.venue.name,
          ev.venue.address,
          ev.status,
          capacityForEvent(ev).toString(),
          effectiveUnitAmount(minTicket).toString(),
          minTicket.currency.toUpperCase(),
          ev.couponCode || "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="container mx-auto py-10 space-y-8">
      <Helmet>
        <title>Dashboard | Events Admin</title>
        <meta name="description" content="Admin dashboard to manage events, filters, analytics and CSV export." />
        <link rel="canonical" href={`${baseUrl}/dashboard`} />
      </Helmet>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Events Dashboard</h1>
          {usingSupabase ? (
            <p className="text-muted-foreground text-sm">Conectado a Supabase. Administra tus eventos y datos reales.</p>
          ) : (
            <p className="text-muted-foreground text-sm">Para crear/editar eventos, inicia sesión y conecta Supabase.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><a href="/admin/events">Manage events</a></Button>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border animate-enter">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.totalEvents}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.totalCapacity}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Avg. min price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatCurrency(kpis.avgMinPrice, filtered[0]?.tickets[0]?.currency?.toUpperCase?.() || "USD")}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{kpis.published}</div>
          </CardContent>
        </Card>
      </section>

      <section className="p-4 border rounded-lg bg-card space-y-4 animate-enter">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search by title" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="capacity" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3 animate-enter">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Events</h2>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/">Back to site</Link>
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-3 pr-4">Title</th>
                <th className="py-3 pr-4">Start</th>
                <th className="py-3 pr-4">End</th>
                <th className="py-3 pr-4">Venue</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Capacity</th>
                <th className="py-3 pr-4">From</th>
                <th className="py-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ev) => {
                const min = Math.min(...ev.tickets.map((t) => effectiveUnitAmount(t)));
                const currency = ev.tickets[0]?.currency || "usd";
                return (
                  <tr key={ev.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 pr-4 font-medium">{ev.title}</td>
                    <td className="py-3 pr-4">{new Date(ev.startsAt).toLocaleString()}</td>
                    <td className="py-3 pr-4">{new Date(ev.endsAt).toLocaleString()}</td>
                    <td className="py-3 pr-4">{ev.venue.name}</td>
                    <td className="py-3 pr-4 capitalize">{ev.status}</td>
                    <td className="py-3 pr-4">{capacityForEvent(ev)}</td>
                    <td className="py-3 pr-4">{formatCurrency(min, currency.toUpperCase())}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-2">
                        <Button asChild size="sm">
                          <Link to={`/event/${ev.id}`}>View</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/events?edit=${ev.id}`}>Edit</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {usingSupabase ? null : (
        <section className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">
            To manage events (create/edit/archive), view real participants and revenue, and send emails, please connect Supabase.
          </p>
        </section>
      )}
    </main>
  );
};

export default Dashboard;
