import { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSupabaseEventsList } from "@/hooks/useSupabaseEvents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AdminHeader from "@/components/admin/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  Users, 
  Ticket, 
  DollarSign,
  CheckCircle2,
  Calendar
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import AdminRoute from "@/routes/AdminRoute";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

interface EventAnalytics {
  eventId: string;
  eventTitle: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  capacity: number;
  ticketsSold: number;
  attendees: number;
  checkedIn: number;
  revenue: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

const Dashboard = () => {
  const { data: events } = useSupabaseEventsList();
  
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("past"); // Default to past events
  const [compareVenue, setCompareVenue] = useState<string>("all");
  const [analytics, setAnalytics] = useState<EventAnalytics[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      if (!events || events.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const eventIds = events.map((e) => e.id);

        // Fetch all data in parallel
        const [
          { data: attendees },
          { data: orders },
          { data: orderItems },
        ] = await Promise.all([
          supabase
            .from('attendees')
            .select('event_id, checked_in_at')
            .in('event_id', eventIds),
          supabase
            .from('orders')
            .select('id, event_id, status, total_amount_cents, created_at')
            .in('event_id', eventIds),
          supabase
            .from('order_items')
            .select('order_id, quantity, total_amount_cents, ticket_id')
            .not('ticket_id', 'is', null),
        ]);

        const paidOrderIds = new Set(
          (orders || []).filter((o: any) => o.status === 'paid').map((o: any) => o.id)
        );

        // Calculate analytics per event
        const analyticsData: EventAnalytics[] = events.map((event) => {
          const eventAttendees = (attendees || []).filter((a: any) => a.event_id === event.id);
          const eventOrders = (orders || []).filter(
            (o: any) => o.event_id === event.id && o.status === 'paid'
          );
          const eventOrderIds = eventOrders.map((o: any) => o.id);
          const eventOrderItems = (orderItems || []).filter((oi: any) =>
            eventOrderIds.includes(oi.order_id)
          );

          // Calculate tickets sold = sum of quantities in order_items
          const ticketsSold = eventOrderItems.reduce((sum: number, oi: any) => sum + (oi.quantity || 0), 0);
          
          // Calculate attendees count (actual number of people)
          const attendeesCount = eventAttendees.length;
          
          const checkedIn = eventAttendees.filter((a: any) => a.checked_in_at).length;
          const revenue = eventOrders.reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);

          const capacity = event.tickets.reduce((sum, t) => sum + (t.capacityTotal || 0), 0);

          return {
            eventId: event.id,
            eventTitle: event.title,
            venueId: event.venue?.name || '',
            venueName: event.venue?.name || 'Unknown',
            startsAt: event.startsAt,
            capacity,
            ticketsSold, // This is order items quantity (ticket packages sold)
            attendees: attendeesCount, // This is actual people count
            checkedIn,
            revenue,
          };
        });

        setAnalytics(analyticsData);

        // Calculate monthly revenue
        const revenueByMonth: Record<string, number> = {};
        (orders || [])
          .filter((o: any) => o.status === 'paid')
          .forEach((o: any) => {
            const month = new Date(o.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
            });
            revenueByMonth[month] = (revenueByMonth[month] || 0) + (o.total_amount_cents || 0);
          });

        const monthlyData = Object.entries(revenueByMonth)
          .map(([month, revenue]) => ({ month, revenue }))
          .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

        setMonthlyRevenue(monthlyData);
      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [events]);

  // Filtered analytics based on venue and date
  const filteredAnalytics = useMemo(() => {
    let filtered = analytics;

    if (venueFilter !== "all") {
      filtered = filtered.filter((a) => a.venueName === venueFilter);
    }

    if (dateFilter === "upcoming") {
      filtered = filtered.filter((a) => new Date(a.startsAt) >= new Date());
    } else if (dateFilter === "past") {
      filtered = filtered.filter((a) => new Date(a.startsAt) < new Date());
    }

    return filtered;
  }, [analytics, venueFilter, dateFilter]);

  // Venues for filter
  const venues = useMemo(() => {
    const venueSet = new Set<string>();
    analytics.forEach((a) => {
      if (a.venueName) {
        venueSet.add(a.venueName);
      }
    });
    return Array.from(venueSet).sort();
  }, [analytics]);

  // Calculate KPIs
  const totalRevenue = filteredAnalytics.reduce((sum, a) => sum + a.revenue, 0);
  const totalTicketsSold = filteredAnalytics.reduce((sum, a) => sum + a.ticketsSold, 0);
  const totalAttendees = filteredAnalytics.reduce((sum, a) => sum + a.attendees, 0);
  const totalCheckedIn = filteredAnalytics.reduce((sum, a) => sum + a.checkedIn, 0);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  // Format event name with date
  const formatEventName = (title: string, date: string) => {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    return `${title} - ${formattedDate}`;
  };

  // Chart data for tickets sold by event (showing capacity utilization)
  const ticketsSoldChartData = filteredAnalytics.map((a) => ({
    name: formatEventName(a.eventTitle, a.startsAt),
    shortName: a.eventTitle.length > 20 ? a.eventTitle.slice(0, 20) + '...' : a.eventTitle,
    date: new Date(a.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    seats: a.attendees, // Use attendees (actual people) for seats
    capacity: a.capacity,
    percentage: a.capacity > 0 ? Math.round((a.attendees / a.capacity) * 100) : 0,
  }));

  // Chart data for attendees by event
  const attendeesChartData = filteredAnalytics.map((a) => ({
    name: formatEventName(a.eventTitle, a.startsAt),
    shortName: a.eventTitle.length > 15 ? a.eventTitle.slice(0, 15) + '...' : a.eventTitle,
    date: new Date(a.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    attendees: a.attendees,
    ticketsSold: a.ticketsSold,
    checkedIn: a.checkedIn,
    attendeePercentage: a.ticketsSold > 0 ? Math.round((a.attendees / a.ticketsSold) * 100) : 0,
    checkinPercentage: a.attendees > 0 ? Math.round((a.checkedIn / a.attendees) * 100) : 0,
  }));

  // Pie chart data for revenue by event
  const revenuePieData = filteredAnalytics.slice(0, 5).map((a) => ({
    name: formatEventName(a.eventTitle, a.startsAt),
    value: a.revenue,
  }));

  // Historical comparison: Compare each event with previous events at the same venue
  const historicalComparison = useMemo(() => {
    const pastEvents = analytics.filter((a) => new Date(a.startsAt) < new Date());
    
    return filteredAnalytics.map((currentEvent) => {
      // Find previous events at the same venue
      const previousEventsAtVenue = pastEvents.filter(
        (e) => e.venueName === currentEvent.venueName && e.eventId !== currentEvent.eventId
      );

      if (previousEventsAtVenue.length === 0) {
        return {
          current: currentEvent,
          hasHistory: false,
          avgRevenue: 0,
          avgAttendees: 0,
          avgTicketsSold: 0,
          revenueChange: 0,
          attendeesChange: 0,
          ticketsChange: 0,
        };
      }

      const avgRevenue = previousEventsAtVenue.reduce((sum, e) => sum + e.revenue, 0) / previousEventsAtVenue.length;
      const avgAttendees = previousEventsAtVenue.reduce((sum, e) => sum + e.attendees, 0) / previousEventsAtVenue.length;
      const avgTicketsSold = previousEventsAtVenue.reduce((sum, e) => sum + e.ticketsSold, 0) / previousEventsAtVenue.length;

      return {
        current: currentEvent,
        hasHistory: true,
        previousCount: previousEventsAtVenue.length,
        avgRevenue: Math.round(avgRevenue),
        avgAttendees: Math.round(avgAttendees),
        avgTicketsSold: Math.round(avgTicketsSold),
        revenueChange: avgRevenue > 0 ? Math.round(((currentEvent.revenue - avgRevenue) / avgRevenue) * 100) : 0,
        attendeesChange: avgAttendees > 0 ? Math.round(((currentEvent.attendees - avgAttendees) / avgAttendees) * 100) : 0,
        ticketsChange: avgTicketsSold > 0 ? Math.round(((currentEvent.ticketsSold - avgTicketsSold) / avgTicketsSold) * 100) : 0,
      };
    });
  }, [filteredAnalytics, analytics]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto px-4 py-6 md:py-10 space-y-6 md:space-y-8">
        <Helmet>
          <title>Analytics Dashboard | Events Management</title>
          <meta name="description" content="Comprehensive analytics dashboard with event metrics, revenue tracking, and attendance data." />
          <link rel="canonical" href={`${baseUrl}/dashboard`} />
        </Helmet>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Comprehensive event analytics - Use filters below to view different time periods
          </p>
        </div>

        {/* Filters */}
        <section className="flex flex-col sm:flex-row gap-3">
          <Select value={venueFilter} onValueChange={setVenueFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue} value={venue}>
                  {venue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="past">Completed Events</SelectItem>
              <SelectItem value="upcoming">Upcoming Events</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {/* KPI Cards */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {filteredAnalytics.length} events
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalTicketsSold}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredAnalytics.length} event{filteredAnalytics.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalAttendees}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalTicketsSold > 0 ? Math.round((totalAttendees / totalTicketsSold) * 100) : 0}% of tickets sold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalCheckedIn}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAttendees > 0 ? Math.round((totalCheckedIn / totalAttendees) * 100) : 0}% of attendees
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Tabs for different analytics */}
        <Tabs defaultValue="comparison" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="attendees">Attendees</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          {/* Historical Comparison Tab */}
          <TabsContent value="comparison" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Performance vs Historical Average</CardTitle>
                <CardDescription>
                  Compare each completed event with previous events at the same venue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {historicalComparison.map((comp, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-base">
                            {comp.current.eventTitle}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(comp.current.startsAt).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })} • {comp.current.venueName}
                          </p>
                        </div>
                        {comp.hasHistory && (
                          <div className="text-xs text-muted-foreground">
                            Compared with {comp.previousCount} previous event{comp.previousCount > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      {comp.hasHistory ? (
                        <div className="grid gap-4 sm:grid-cols-3">
                          {/* Revenue Comparison */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Revenue</div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(comp.current.revenue)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {formatCurrency(comp.avgRevenue)}
                            </div>
                            <div className={`text-sm font-medium flex items-center gap-1 ${
                              comp.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {comp.revenueChange >= 0 ? '↑' : '↓'} {Math.abs(comp.revenueChange)}%
                            </div>
                          </div>

                          {/* Attendees Comparison */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Attendees</div>
                            <div className="text-2xl font-bold">
                              {comp.current.attendees}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {comp.avgAttendees}
                            </div>
                            <div className={`text-sm font-medium flex items-center gap-1 ${
                              comp.attendeesChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {comp.attendeesChange >= 0 ? '↑' : '↓'} {Math.abs(comp.attendeesChange)}%
                            </div>
                          </div>

                          {/* Tickets Sold Comparison */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Tickets Sold</div>
                            <div className="text-2xl font-bold">
                              {comp.current.ticketsSold}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {comp.avgTicketsSold}
                            </div>
                            <div className={`text-sm font-medium flex items-center gap-1 ${
                              comp.ticketsChange >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {comp.ticketsChange >= 0 ? '↑' : '↓'} {Math.abs(comp.ticketsChange)}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          No previous events at this venue for comparison
                        </div>
                      )}
                    </div>
                  ))}

                  {historicalComparison.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No completed events to display. Change filter to see data.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Capacity Utilization by Event</CardTitle>
                <CardDescription>
                  {filteredAnalytics.length > 0 
                    ? `Showing ${filteredAnalytics.length} event${filteredAnalytics.length !== 1 ? 's' : ''}`
                    : 'No events match the selected filters'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsSoldChartData.length > 0 ? (
                  <div className="space-y-4">
                    {ticketsSoldChartData.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                          <span className="font-medium text-sm">{item.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.seats} / {item.capacity} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No events found. Try changing the filters above.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capacity Chart</CardTitle>
                <CardDescription>Seats filled compared to total capacity</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ticketsSoldChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="shortName"
                      angle={-45} 
                      textAnchor="end" 
                      height={120}
                      interval={0}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-sm mb-2">{payload[0].payload.name}</p>
                              <p className="text-sm">Seats: {payload[0].payload.seats}</p>
                              <p className="text-sm">Capacity: {payload[0].payload.capacity}</p>
                              <p className="text-sm">Filled: {payload[0].payload.percentage}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="seats" fill={COLORS[0]} name="Seats Filled" />
                    <Bar dataKey="capacity" fill={COLORS[3]} name="Total Capacity" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendees Tab */}
          <TabsContent value="attendees" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attendees by Event</CardTitle>
                <CardDescription>
                  Attendance rate and check-in status per event
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {attendeesChartData.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">{item.name}</span>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Attendees: {item.attendees}/{item.ticketsSold}</span>
                          <span>Checked: {item.checkedIn}/{item.attendees}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Attendance: {item.attendeePercentage}%
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${item.attendeePercentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Check-in: {item.checkinPercentage}%
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-secondary transition-all"
                            style={{ width: `${item.checkinPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendeesChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="shortName"
                      angle={-45} 
                      textAnchor="end" 
                      height={120}
                      interval={0}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-sm mb-2">{payload[0].payload.name}</p>
                              <p className="text-sm">Attendees: {payload[0].payload.attendees}</p>
                              <p className="text-sm">Checked In: {payload[0].payload.checkedIn}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="attendees" fill={COLORS[0]} name="Attendees" />
                    <Bar dataKey="checkedIn" fill={COLORS[1]} name="Checked In" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Event</CardTitle>
                  <CardDescription>Top 5 revenue-generating events</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenuePieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name.slice(0, 15)}...`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {revenuePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue</CardTitle>
                  <CardDescription>
                    {venueFilter === "all" ? "All venues" : venueFilter}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke={COLORS[0]} 
                        strokeWidth={2}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAnalytics
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((event, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {event.eventTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.startsAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })} • {event.venueName}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold">
                            {formatCurrency(event.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </AdminRoute>
  );
};

export default Dashboard;
