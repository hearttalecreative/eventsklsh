import { useMemo, useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
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
  Banknote,
  ArrowUpRight,
  AlertTriangle,
  Clock3,
  Download
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

const LAST_SELECTED_EVENT_STORAGE_KEY = "admin:event-attendees:last-event-id";


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
  const attendeesPath = useMemo(() => {
    if (typeof window === "undefined") return "/admin/attendees";
    const savedEventId = window.localStorage.getItem(LAST_SELECTED_EVENT_STORAGE_KEY);
    return savedEventId ? `/admin/events/${savedEventId}/attendees` : "/admin/attendees";
  }, []);
  
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [compareVenue, setCompareVenue] = useState<string>("all");
  const [analytics, setAnalytics] = useState<EventAnalytics[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date range state
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [periodPreset, setPeriodPreset] = useState<"today" | "7d" | "30d" | "90d" | "ytd" | "all" | "custom">("all");

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
        checkedIn: Number(row.checked_in_count ?? row.checked_in ?? 0),
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
    setPeriodPreset("all");
  };

  const applyDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    start.setDate(end.getDate() - (days - 1));
    setStartDate(start);
    setEndDate(end);
    setPeriodPreset(days === 7 ? "7d" : days === 30 ? "30d" : "90d");
  };

  const applyTodayPreset = () => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    setStartDate(start);
    setEndDate(end);
    setPeriodPreset("today");
  };

  const applyYtdPreset = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    setStartDate(start);
    setEndDate(end);
    setPeriodPreset("ytd");
  };

  const resetToAllTime = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPeriodPreset("all");
  };

  const avgFillRate = filteredAnalytics.length
    ? Math.round(
        filteredAnalytics.reduce((sum, event) => {
          if (!event.capacity) return sum;
          return sum + (event.attendees / event.capacity) * 100;
        }, 0) / filteredAnalytics.length,
      )
    : 0;

  const checkInRate = totalAttendees > 0 ? Math.round((totalCheckedIn / totalAttendees) * 100) : 0;

  const topPerformers = [...filteredAnalytics]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const revenueBreakdownTotal = revenueBreakdownData.reduce((sum, item) => sum + item.value, 0);
  const topRevenueTotal = revenuePieData.reduce((sum, item) => sum + item.value, 0);

  const comparableEvents = historicalComparison.filter((item) => item.hasHistory);
  const avgRevenueGrowth = comparableEvents.length
    ? Math.round(comparableEvents.reduce((sum, item) => sum + item.revenueChange, 0) / comparableEvents.length)
    : 0;
  const avgTicketGrowth = comparableEvents.length
    ? Math.round(comparableEvents.reduce((sum, item) => sum + item.ticketsChange, 0) / comparableEvents.length)
    : 0;
  const avgAttendanceGrowth = comparableEvents.length
    ? Math.round(comparableEvents.reduce((sum, item) => sum + item.attendeesChange, 0) / comparableEvents.length)
    : 0;

  const venueGrowthInsights = useMemo(() => {
    const grouped = new Map<string, EventAnalytics[]>();
    filteredAnalytics.forEach((event) => {
      const key = event.venueName || "Unknown Venue";
      const list = grouped.get(key) || [];
      list.push(event);
      grouped.set(key, list);
    });

    return Array.from(grouped.entries())
      .map(([venue, list]) => {
        const sorted = [...list].sort(
          (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
        );
        const latest = sorted[0];
        const historical = sorted.slice(1);
        if (!latest || historical.length === 0) {
          return {
            venue,
            latest,
            hasHistory: false,
            revenueGrowth: 0,
            ticketsGrowth: 0,
            attendeesGrowth: 0,
          };
        }

        const avgRevenue = historical.reduce((sum, event) => sum + event.revenue, 0) / historical.length;
        const avgTickets = historical.reduce((sum, event) => sum + event.ticketsSold, 0) / historical.length;
        const avgAttendees = historical.reduce((sum, event) => sum + event.attendees, 0) / historical.length;

        return {
          venue,
          latest,
          hasHistory: true,
          revenueGrowth: avgRevenue > 0 ? Math.round(((latest.revenue - avgRevenue) / avgRevenue) * 100) : 0,
          ticketsGrowth: avgTickets > 0 ? Math.round(((latest.ticketsSold - avgTickets) / avgTickets) * 100) : 0,
          attendeesGrowth: avgAttendees > 0 ? Math.round(((latest.attendees - avgAttendees) / avgAttendees) * 100) : 0,
        };
      })
      .sort((a, b) => Math.abs(b.revenueGrowth) - Math.abs(a.revenueGrowth));
  }, [filteredAnalytics]);

  const actionItems = useMemo(() => {
    const now = new Date();
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const lowFillUpcoming = filteredAnalytics
      .filter((event) => {
        const starts = new Date(event.startsAt);
        const fillRate = event.capacity > 0 ? event.attendees / event.capacity : 0;
        return starts >= now && starts <= in14Days && fillRate < 0.5;
      })
      .slice(0, 3)
      .map((event) => ({
        type: "fill" as const,
        title: event.eventTitle,
        detail: `${Math.round((event.attendees / Math.max(event.capacity, 1)) * 100)}% filled at ${event.venueName}`,
      }));

    const checkInLag = filteredAnalytics
      .filter((event) => {
        const starts = new Date(event.startsAt);
        const sinceStartHours = (now.getTime() - starts.getTime()) / (1000 * 60 * 60);
        const checkin = event.attendees > 0 ? event.checkedIn / event.attendees : 1;
        return sinceStartHours >= 0 && sinceStartHours <= 24 && checkin < 0.7;
      })
      .slice(0, 3)
      .map((event) => ({
        type: "checkin" as const,
        title: event.eventTitle,
        detail: `${Math.round((event.checkedIn / Math.max(event.attendees, 1)) * 100)}% check-in (${event.checkedIn}/${event.attendees})`,
      }));

    return [...lowFillUpcoming, ...checkInLag].slice(0, 5);
  }, [filteredAnalytics]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto px-4 py-6 md:py-10 pb-10 space-y-6 md:space-y-8 overflow-x-clip">
        <Helmet>
          <title>Analytics Dashboard | Events Management</title>
          <meta name="description" content="Comprehensive analytics dashboard with event metrics, revenue tracking, and attendance data." />
          <link rel="canonical" href={`${baseUrl}/dashboard`} />
        </Helmet>

        <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-white via-[hsl(35_50%_97%)] to-[hsl(30_45%_94%)] p-6 md:p-8 shadow-horizon-lg">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-[hsl(30_70%_55%/.14)] blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Analytics Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                Track event performance, ticket movement, check-ins, and revenue trends across your venues.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
              <span className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 font-medium">{filteredAnalytics.length} events</span>
              <span className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 font-medium">{totalAttendees} attendees</span>
              <span className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 font-semibold text-primary">{formatCurrency(totalRevenue)} total</span>
              <span className="rounded-full border border-primary/20 bg-white/70 px-3 py-1 font-medium">{checkInRate}% checked in</span>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-white/70 p-4 md:p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row gap-3">
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger className="w-full sm:w-[220px] bg-white min-h-11 text-sm">
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
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[180px] justify-start text-left font-normal bg-white min-h-11">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
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
                  <Button variant="outline" className="w-full sm:w-[180px] justify-start text-left font-normal bg-white min-h-11">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
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
                  Clear
                </Button>
              )}
            </div>
            
            {(startDate || endDate) && (
              <p className="text-sm text-muted-foreground">
                {startDate && endDate 
                  ? `Showing events from ${format(startDate, "MMM dd, yyyy")} to ${format(endDate, "MMM dd, yyyy")}`
                  : startDate 
                    ? `Showing events from ${format(startDate, "MMM dd, yyyy")}`
                    : `Showing events until ${format(endDate!, "MMM dd, yyyy")}`
                }
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
            <Button type="button" variant="outline" size="sm" className="bg-white min-h-10" onClick={() => applyDatePreset(7)}>Last 7 days</Button>
            <Button type="button" variant="outline" size="sm" className="bg-white min-h-10" onClick={() => applyDatePreset(30)}>Last 30 days</Button>
            <Button type="button" variant="outline" size="sm" className="bg-white min-h-10" onClick={() => applyDatePreset(90)}>Last 90 days</Button>
            <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={resetToAllTime}>All time</Button>
          </div>
        </section>

        {/* KPI Cards - 6 cards now */}
        <section className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="border-primary/10 bg-white/80">
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

          <Card className="border-primary/10 bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{totalCheckedIn}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalAttendees > 0 ? Math.round((totalCheckedIn / totalAttendees) * 100) : 0}% of {totalAttendees} registered
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Revenue</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(totalTicketRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalRevenue > 0 ? Math.round((totalTicketRevenue / totalRevenue) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Add-on Revenue</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(totalAddonRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalRevenue > 0 ? Math.round((totalAddonRevenue / totalRevenue) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card className="col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-2 border-primary/25 bg-gradient-to-br from-primary/10 to-[hsl(30_70%_55%/.15)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <Banknote className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {filteredAnalytics.length} event{filteredAnalytics.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card className="border-primary/15 bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Average Fill Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgFillRate}%</div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(avgFillRate, 100)}%` }} />
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/15 bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Check-In Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{checkInRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">{totalCheckedIn} of {totalAttendees} attendees</p>
            </CardContent>
          </Card>
          <Card className="border-primary/15 bg-white/80 sm:col-span-3 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top Event (Revenue)</CardTitle>
            </CardHeader>
            <CardContent>
              {topPerformers[0] ? (
                <>
                  <div className="font-semibold leading-tight">{topPerformers[0].eventTitle}</div>
                  <p className="text-xs text-muted-foreground mt-1">{topPerformers[0].venueName}</p>
                  <p className="text-lg font-bold text-primary mt-2">{formatCurrency(topPerformers[0].revenue)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No events in selected period.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="md:hidden">
          <Card className="border-primary/10 bg-white/80">
            <CardHeader>
              <CardTitle>Mobile Event Snapshot</CardTitle>
              <CardDescription>Fast overview optimized for phone management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPerformers.length > 0 ? topPerformers.map((event) => {
                const fill = event.capacity > 0 ? Math.round((event.attendees / event.capacity) * 100) : 0;
                return (
                  <div key={event.eventId} className="rounded-xl border border-border/80 bg-white/70 p-3 space-y-2">
                    <p className="font-semibold text-sm leading-tight">{event.eventTitle}</p>
                    <p className="text-xs text-muted-foreground">{event.venueName}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span>{event.attendees}/{event.capacity} seats</span>
                      <span>{fill}% full</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(fill, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-semibold">{formatCurrency(event.revenue)}</span>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground">No events to display. Adjust filters above.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-8 border-primary/10 bg-white/85">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Growth Panorama by Venue
              </CardTitle>
              <CardDescription>
                Latest event performance compared with previous events in the same venue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border/70 bg-white/70 p-3">
                  <p className="text-xs text-muted-foreground">Comparable Events</p>
                  <p className="text-xl font-bold">{comparableEvents.length}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-white/70 p-3">
                  <p className="text-xs text-muted-foreground">Revenue Growth</p>
                  <p className={`text-xl font-bold ${avgRevenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{avgRevenueGrowth >= 0 ? '+' : ''}{avgRevenueGrowth}%</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-white/70 p-3">
                  <p className="text-xs text-muted-foreground">Tickets Growth</p>
                  <p className={`text-xl font-bold ${avgTicketGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{avgTicketGrowth >= 0 ? '+' : ''}{avgTicketGrowth}%</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-white/70 p-3">
                  <p className="text-xs text-muted-foreground">Attendance Growth</p>
                  <p className={`text-xl font-bold ${avgAttendanceGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{avgAttendanceGrowth >= 0 ? '+' : ''}{avgAttendanceGrowth}%</p>
                </div>
              </div>

              <div className="space-y-2">
                {venueGrowthInsights.filter((venue) => venue.hasHistory).length > 0 ? venueGrowthInsights.filter((venue) => venue.hasHistory).slice(0, 6).map((venue, idx) => (
                  <div key={`${venue.venue}-${idx}`} className="rounded-xl border border-border/70 bg-white/70 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p className="font-semibold text-sm">{venue.venue}</p>
                      <p className="text-xs text-muted-foreground truncate">{venue.latest.eventTitle}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 border ${venue.revenueGrowth >= 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-red-200 text-red-700 bg-red-50'}`}>Revenue {venue.revenueGrowth >= 0 ? '+' : ''}{venue.revenueGrowth}%</span>
                      <span className={`rounded-full px-2 py-1 border ${venue.ticketsGrowth >= 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-red-200 text-red-700 bg-red-50'}`}>Tickets {venue.ticketsGrowth >= 0 ? '+' : ''}{venue.ticketsGrowth}%</span>
                      <span className={`rounded-full px-2 py-1 border ${venue.attendeesGrowth >= 0 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-red-200 text-red-700 bg-red-50'}`}>Attendees {venue.attendeesGrowth >= 0 ? '+' : ''}{venue.attendeesGrowth}%</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No venue growth data available for the selected filters.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="xl:col-span-4 space-y-4">
            <Card className="border-primary/10 bg-white/85">
              <CardHeader>
                <CardTitle className="text-base">Operations Queue</CardTitle>
                <CardDescription>Events that need attention right now.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {actionItems.length > 0 ? actionItems.map((item, idx) => (
                  <div key={`${item.type}-${idx}`} className="rounded-lg border border-border/70 bg-white/70 p-3">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {item.type === 'fill' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <Clock3 className="h-3.5 w-3.5 text-blue-600" />}
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No urgent operational alerts in the selected period.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/10 bg-white/85">
              <CardHeader>
                <CardTitle className="text-base">Quick Access</CardTitle>
                <CardDescription>Jump directly to key admin workflows.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                <Button asChild variant="outline" className="justify-between min-h-11">
                  <Link to="/admin/events">Manage events <ArrowUpRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="justify-between min-h-11">
                  <Link to={attendeesPath}>Attendees & check-in <ArrowUpRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="justify-between min-h-11">
                  <Link to="/admin/ticket-sales">Sales analytics <ArrowUpRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="justify-between min-h-11">
                  <Link to="/admin/coupons">Coupons & promos <ArrowUpRight className="h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Tabs for different analytics */}
        <Tabs defaultValue="comparison" className="space-y-4 max-w-full min-w-0">
          <TabsList className="!grid !w-full grid-cols-2 md:grid-cols-4 !h-auto gap-1 bg-white/75 border border-border/80 p-1 rounded-xl max-w-full">
            <TabsTrigger value="comparison" className="min-h-11 text-sm whitespace-normal">Comparison</TabsTrigger>
            <TabsTrigger value="tickets" className="min-h-11 text-sm whitespace-normal">Tickets</TabsTrigger>
            <TabsTrigger value="attendees" className="min-h-11 text-sm whitespace-normal">Attendees</TabsTrigger>
            <TabsTrigger value="revenue" className="min-h-11 text-sm whitespace-normal">Revenue</TabsTrigger>
          </TabsList>

          {/* Historical Comparison Tab */}
          <TabsContent value="comparison" className="space-y-4 overflow-x-hidden">
            <Card className="border-primary/10 bg-white/80">
              <CardHeader>
                <CardTitle>Event Performance vs Historical Average</CardTitle>
                <CardDescription>
                  Compare each completed event with previous events at the same venue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {comparableEvents.map((comp, index) => (
                      <div key={index} className="border border-border/80 rounded-xl p-4 space-y-4 bg-white/70">
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
                    </div>
                  ))}

                  {comparableEvents.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No comparable history available for the selected filters.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4 overflow-x-hidden">
            <Card className="border-primary/10 bg-white/80">
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
                          <span className="font-medium text-sm break-words">{item.name}</span>
                          <span className="text-sm text-muted-foreground break-words">
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

            <Card className="border-primary/10 bg-white/80">
              <CardHeader>
                <CardTitle>Capacity Chart</CardTitle>
                <CardDescription>Seats filled compared to total capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:hidden">
                  {ticketsSoldChartData.slice(0, 6).map((item, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium truncate pr-2">{item.shortName}</span>
                        <span>{item.percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block h-[400px]">
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendees Tab */}
          <TabsContent value="attendees" className="space-y-4 overflow-x-hidden">
            <Card className="border-primary/10 bg-white/80">
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
                          <span className="font-medium text-sm break-words">{item.name}</span>
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

            <Card className="border-primary/10 bg-white/80">
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 md:hidden">
                  {attendeesChartData.slice(0, 6).map((item, index) => (
                    <div key={index} className="rounded-lg border border-border/70 p-2.5 bg-white/60">
                      <p className="text-xs font-medium truncate">{item.shortName}</p>
                      <p className="text-xs text-muted-foreground mt-1">Attendance {item.attendeePercentage}% • Check-in {item.checkinPercentage}%</p>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block h-[400px]">
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-4 overflow-x-hidden">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-primary/10 bg-white/80">
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                  <CardDescription>Tickets vs Add-ons</CardDescription>
                </CardHeader>
                <CardContent className="h-[280px] sm:h-[300px]">
                  {revenueBreakdownData.length > 0 ? (
                    <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueBreakdownData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
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
                    <div className="mt-3 space-y-1.5 text-xs">
                      {revenueBreakdownData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground min-w-0 flex-1 truncate">{item.name}</span>
                          <span className="font-medium">{formatCurrency(item.value)} ({revenueBreakdownTotal ? Math.round((item.value / revenueBreakdownTotal) * 100) : 0}%)</span>
                        </div>
                      ))}
                    </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No revenue data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/10 bg-white/80">
                <CardHeader>
                  <CardTitle>Revenue by Event</CardTitle>
                  <CardDescription>Top 5 revenue-generating events</CardDescription>
                </CardHeader>
                <CardContent className="h-[280px] sm:h-[300px]">
                  <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenuePieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
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
                  <div className="mt-3 space-y-1.5 text-xs">
                    {revenuePieData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground truncate">{item.name}</span>
                        <span className="font-medium shrink-0">{formatCurrency(item.value)} ({topRevenueTotal ? Math.round((item.value / topRevenueTotal) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                  </>
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/10 bg-white/80">
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
                <CardDescription>
                  {venueFilter === "all" ? "All venues" : venueFilter}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 md:hidden">
                  {monthlyRevenue.slice(-6).map((item) => (
                    <div key={item.month} className="flex items-center justify-between rounded-lg border border-border/70 bg-white/60 p-2.5 text-sm">
                      <span>{item.month}</span>
                      <span className="font-semibold">{formatCurrency(item.revenue)}</span>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block h-[300px]">
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
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/10 bg-white/80">
              <CardHeader>
                <CardTitle>Revenue Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredAnalytics
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((event, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-2 border-b last:border-0 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {event.eventTitle}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {new Date(event.startsAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })} • {event.venueName}
                          </p>
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-1">
                          <span className="text-sm font-bold">
                            {formatCurrency(event.revenue)}
                          </span>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
