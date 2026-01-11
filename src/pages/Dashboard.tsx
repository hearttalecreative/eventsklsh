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
  Calendar as CalendarIcon,
  Package,
  Banknote
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
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
  ticketRevenue: number;
  addonRevenue: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

const Dashboard = () => {
  const { data: events } = useSupabaseEventsList();
  
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [compareVenue, setCompareVenue] = useState<string>("all");
  const [analytics, setAnalytics] = useState<EventAnalytics[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date range state
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const fetchAnalytics = async (start?: Date, end?: Date) => {
    setLoading(true);
    try {
      // Use the new detailed analytics function with date filters
      const { data: analyticsFromDb, error: analyticsError } = await supabase
        .rpc('get_dashboard_analytics_detailed', {
          p_start_date: start ? start.toISOString() : null,
          p_end_date: end ? new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() : null // End of day
        });

      if (analyticsError) {
        console.error('Error fetching dashboard analytics:', analyticsError);
        setLoading(false);
        return;
      }

      // Transform the data to match our EventAnalytics interface
      const analyticsData: EventAnalytics[] = (analyticsFromDb || []).map((row: any) => ({
        eventId: row.event_id,
        eventTitle: row.event_title,
        venueId: row.venue_name,
        venueName: row.venue_name,
        startsAt: row.event_starts_at,
        capacity: row.capacity_total,
        ticketsSold: Number(row.seats_sold),
        attendees: Number(row.attendees_count),
        checkedIn: Number(row.checked_in_count),
        revenue: Number(row.total_revenue_cents),
        ticketRevenue: Number(row.ticket_revenue_cents),
        addonRevenue: Number(row.addon_revenue_cents),
      }));

      setAnalytics(analyticsData);

      // Calculate monthly revenue with date filters
      let ordersQuery = supabase
        .from('orders')
        .select('created_at, total_amount_cents')
        .eq('status', 'paid');
      
      if (start) {
        ordersQuery = ordersQuery.gte('created_at', start.toISOString());
      }
      if (end) {
        ordersQuery = ordersQuery.lte('created_at', new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString());
      }

      const { data: orders } = await ordersQuery;

      const revenueByMonth: Record<string, number> = {};
      (orders || []).forEach((o: any) => {
        const month = new Date(o.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
        });
        revenueByMonth[month] = (revenueByMonth[month] || 0) + o.total_amount_cents;
      });

      const monthlyData = Object.entries(revenueByMonth)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => {
          const dateA = new Date(a.month);
          const dateB = new Date(b.month);
          return dateA.getTime() - dateB.getTime();
        });

      setMonthlyRevenue(monthlyData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(startDate, endDate);
  }, [startDate, endDate]);

  // Filtered analytics based on venue only (dates are filtered by the DB function)
  const filteredAnalytics = useMemo(() => {
    let filtered = analytics;

    if (venueFilter !== "all") {
      filtered = filtered.filter((a) => a.venueName === venueFilter);
    }

    return filtered;
  }, [analytics, venueFilter]);

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
  const totalTicketRevenue = filteredAnalytics.reduce((sum, a) => sum + a.ticketRevenue, 0);
  const totalAddonRevenue = filteredAnalytics.reduce((sum, a) => sum + a.addonRevenue, 0);
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

  // Revenue breakdown pie chart
  const revenueBreakdownData = [
    { name: 'Tickets', value: totalTicketRevenue },
    { name: 'Add-ons', value: totalAddonRevenue },
  ].filter(d => d.value > 0);

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

  const clearDateRange = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

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
        <section className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
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
          </div>
          
          {/* Date Range Picker */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-wrap gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd MMM yyyy", { locale: es }) : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <span className="text-muted-foreground">—</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd MMM yyyy", { locale: es }) : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={clearDateRange}>
                  Limpiar
                </Button>
              )}
            </div>
            
            {(startDate || endDate) && (
              <p className="text-sm text-muted-foreground">
                {startDate && endDate 
                  ? `Mostrando eventos del ${format(startDate, "dd MMM yyyy", { locale: es })} al ${format(endDate, "dd MMM yyyy", { locale: es })}`
                  : startDate 
                    ? `Mostrando eventos desde ${format(startDate, "dd MMM yyyy", { locale: es })}`
                    : `Mostrando eventos hasta ${format(endDate!, "dd MMM yyyy", { locale: es })}`
                }
              </p>
            )}
          </div>
        </section>

        {/* KPI Cards - 6 cards now */}
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Vendidos</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalTicketsSold}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredAnalytics.length} evento{filteredAnalytics.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Asistentes (Check-in)</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalCheckedIn}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAttendees > 0 ? Math.round((totalCheckedIn / totalAttendees) * 100) : 0}% de {totalAttendees} registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(totalTicketRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalRevenue > 0 ? Math.round((totalTicketRevenue / totalRevenue) * 100) : 0}% del total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Add-ons</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(totalAddonRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalRevenue > 0 ? Math.round((totalAddonRevenue / totalRevenue) * 100) : 0}% del total
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-2 lg:col-span-1 xl:col-span-2 bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <Banknote className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                De {filteredAnalytics.length} evento{filteredAnalytics.length !== 1 ? 's' : ''}
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
                      No events to display. Try adjusting the date range.
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
                  {filteredAnalytics.length > 0 
                    ? `Attendance rate and check-in status for ${filteredAnalytics.length} event${filteredAnalytics.length !== 1 ? 's' : ''}`
                    : 'No events match the selected filters'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {attendeesChartData.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No events found. Try changing the filters above.
                  </p>
                )}
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
                  <CardTitle>Desglose de Ingresos</CardTitle>
                  <CardDescription>Tickets vs Add-ons</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {revenueBreakdownData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueBreakdownData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {revenueBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No hay datos de ingresos
                    </div>
                  )}
                </CardContent>
              </Card>

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
            </div>

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
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-bold">
                            {formatCurrency(event.revenue)}
                          </span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>Tickets: {formatCurrency(event.ticketRevenue)}</span>
                            <span>Add-ons: {formatCurrency(event.addonRevenue)}</span>
                          </div>
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
