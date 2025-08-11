import { useMemo, useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";

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

  const [orderBy, setOrderBy] = useState<'upcoming'|'past'|'title-asc'|'title-desc'>('upcoming');

  const source = useMemo(() => (supa && supa.length ? supa : mockEvents), [supa]);
  const usingSupabase = Boolean(supa && supa.length);

  const [attendeesMap, setAttendeesMap] = useState<Record<string, number>>({});
  const [ticketsSoldMap, setTicketsSoldMap] = useState<Record<string, number>>({});
  const [ticketRevenueMap, setTicketRevenueMap] = useState<Record<string, number>>({});
  const [addonRevenueMap, setAddonRevenueMap] = useState<Record<string, number>>({});
  const [summaryMap, setSummaryMap] = useState<Record<string, { total: number; ordersPaid: number; ordersTotal: number }>>({});


  useEffect(() => {
    async function loadAgg() {
      if (!supa || supa.length === 0) return;
      const eventIds = supa.map((e) => e.id);
      const [{ data: attendees }, { data: orders }, { data: items }] = await Promise.all([
        supabase.from('attendees').select('event_id').in('event_id', eventIds),
        supabase.from('orders').select('id,event_id,status').in('event_id', eventIds),
        supabase.from('order_items').select('order_id,quantity,total_amount_cents,ticket_id,addon_id'),
      ]);
      const paidOrders = new Set((orders || []).filter((o:any)=>o.status==='paid').map((o:any)=>o.id));
      const attendeesBy: Record<string, number> = {};
      (attendees || []).forEach((a:any) => { attendeesBy[a.event_id] = (attendeesBy[a.event_id]||0) + 1; });
      setAttendeesMap(attendeesBy);
      const ticketsSoldBy: Record<string, number> = {};
      const ticketRevenueBy: Record<string, number> = {};
      const addonRevenueBy: Record<string, number> = {};
      (items || []).forEach((it:any) => {
        if (!paidOrders.has(it.order_id)) return;
        const evId = (orders || []).find((o:any)=>o.id===it.order_id)?.event_id;
        if (!evId) return;
        if (it.ticket_id) {
          ticketsSoldBy[evId] = (ticketsSoldBy[evId]||0) + (it.quantity||0);
          ticketRevenueBy[evId] = (ticketRevenueBy[evId]||0) + (it.total_amount_cents||0);
        } else if (it.addon_id) {
          addonRevenueBy[evId] = (addonRevenueBy[evId]||0) + (it.total_amount_cents||0);
        }
      });
      setTicketsSoldMap(ticketsSoldBy);
      setTicketRevenueMap(ticketRevenueBy);
      setAddonRevenueMap(addonRevenueBy);

      // Admin-only financial summary via secure RPC
      try {
        const { data: summary, error: summaryError } = await (supabase as any).rpc('get_event_sales_summary_admin');
        if (!summaryError && Array.isArray(summary)) {
          const map: Record<string, { total: number; ordersPaid: number; ordersTotal: number }> = {};
          summary.forEach((row: any) => {
            if (row?.event_id && eventIds.includes(row.event_id)) {
              map[row.event_id] = {
                total: Number(row.total_amount_cents) || 0,
                ordersPaid: Number(row.orders_paid) || 0,
                ordersTotal: Number(row.orders_total) || 0,
              };
            }
          });
          setSummaryMap(map);
        }
      } catch (e) {
        console.warn('get_event_sales_summary_admin failed or unauthorized');
      }
    }
    loadAgg();
  }, [supa]);

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

  const paidRevenue = useMemo(() => {
    return filtered.reduce((sum, ev) => sum + (summaryMap[ev.id]?.total || 0), 0);
  }, [filtered, summaryMap]);

  const paidOrders = useMemo(() => {
    return filtered.reduce((sum, ev) => sum + (summaryMap[ev.id]?.ordersPaid || 0), 0);
  }, [filtered, summaryMap]);

  const chartData = useMemo(
    () =>
      filtered.map((ev) => ({
        id: ev.id,
        name: ev.title.length > 14 ? ev.title.slice(0, 14) + "…" : ev.title,
        capacity: capacityForEvent(ev),
        attendees: attendeesMap[ev.id] || 0,
        ticketsSold: ticketsSoldMap[ev.id] || 0,
        remaining: Math.max(0, capacityForEvent(ev) - (attendeesMap[ev.id] || 0)),
        ticketRevenue: ticketRevenueMap[ev.id] || 0,
        addonRevenue: addonRevenueMap[ev.id] || 0,
      })),
    [filtered, attendeesMap, ticketsSoldMap, ticketRevenueMap, addonRevenueMap]
  );

  const sorted = useMemo(() => {
    const now = Date.now();
    const arr = [...filtered];
    switch (orderBy) {
      case 'title-asc':
        return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return arr.sort((a, b) => b.title.localeCompare(a.title));
      case 'past': {
        const past = arr.filter((ev) => new Date(ev.startsAt).getTime() < now)
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
        const future = arr.filter((ev) => new Date(ev.startsAt).getTime() >= now)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        return [...past, ...future];
      }
      case 'upcoming':
      default: {
        const future = arr.filter((ev) => new Date(ev.startsAt).getTime() >= now)
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
        const past = arr.filter((ev) => new Date(ev.startsAt).getTime() < now)
          .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
        return [...future, ...past];
      }
    }
  }, [filtered, orderBy]);

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
          'USD',
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
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><a href="/admin/events">Manage events</a></Button>
          <Button asChild variant="outline"><a href="/admin/venues">Manage venues</a></Button>
          <Button asChild variant="outline"><a href="/admin/coupons">Manage coupons</a></Button>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
            <div className="text-3xl font-semibold">{formatCurrency(kpis.avgMinPrice, 'USD')}</div>
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
        <Card className="bg-card border animate-enter">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Paid revenue (RPC)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{formatCurrency(paidRevenue, 'USD')}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Paid orders (RPC)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{paidOrders}</div>
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
        <div className="h-64 overflow-x-auto">
          <div style={{ minWidth: Math.max(600, chartData.length * 80) }}>
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="capacity" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card border animate-enter">
          <CardHeader><CardTitle>Tickets sold per event</CardTitle></CardHeader>
          <CardContent className="h-64">
            <div className="h-64 overflow-x-auto">
              <div style={{ minWidth: Math.max(600, chartData.length * 80) }}>
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="ticketsSold" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader><CardTitle>Participants per event</CardTitle></CardHeader>
          <CardContent className="h-64">
            <div className="h-64 overflow-x-auto">
              <div style={{ minWidth: Math.max(600, chartData.length * 80) }}>
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="attendees" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader><CardTitle>Remaining spots</CardTitle></CardHeader>
          <CardContent className="h-64">
            <div className="h-64 overflow-x-auto">
              <div style={{ minWidth: Math.max(600, chartData.length * 80) }}>
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="remaining" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter">
          <CardHeader><CardTitle>Revenue: tickets</CardTitle></CardHeader>
          <CardContent className="h-64">
            <div className="h-64 overflow-x-auto">
              <div style={{ minWidth: Math.max(600, chartData.length * 80) }}>
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip formatter={(v:number)=>formatCurrency(v, 'USD')} />
                    <Bar dataKey="ticketRevenue" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border animate-enter lg:col-span-2">
          <CardHeader><CardTitle>Revenue: add-ons</CardTitle></CardHeader>
          <CardContent className="h-64">
            <div className="h-64 overflow-x-auto">
              <div style={{ minWidth: Math.max(600, chartData.length * 80) }}>
                <ResponsiveContainer width="100%" height={256}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip formatter={(v:number)=>formatCurrency(v, 'USD')} />
                    <Bar dataKey="addonRevenue" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
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
