import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Ticket, Users, BarChart3, FileText, StickyNote, History, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FilterX } from "lucide-react";



interface AttendeeWithNotes {
  id: string;
  name: string | null;
  email: string | null;
  ticket_label: string | null;
  internal_notes: string | null;
}

interface TicketSalesData {
  event_id: string;
  event_title: string;
  event_capacity: number;
  ticket_id: string;
  ticket_name: string;
  ticket_capacity: number;
  tickets_sold: number;
  unit_price_cents: number;
  total_revenue_cents: number;
  participants_per_ticket: number;
}

interface EventSalesData {
  event_id: string;
  event_title: string;
  event_starts_at: string;
  event_ends_at: string | null;
  event_capacity: number;
  total_tickets_sold: number;
  total_revenue_cents: number;
  tickets: Array<{
    ticket_id: string;
    ticket_name: string;
    ticket_capacity: number;
    tickets_sold: number;
    unit_price_cents: number;
    total_revenue_cents: number;
    participants_per_ticket: number;
  }>;
  attendees_with_notes: AttendeeWithNotes[];
}

const TicketSales = () => {
  const isMobile = useIsMobile();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [salesData, setSalesData] = useState<EventSalesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const now = new Date();


  useEffect(() => {
    fetchTicketSales();
  }, []);

  const fetchTicketSales = async () => {
    try {
      setIsLoading(true);
      
      // Query to get published and sold out events
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          capacity_total,
          starts_at,
          ends_at,
          status
        `)
        .in('status', ['published', 'sold_out', 'archived', 'paused'])

        .order('starts_at', { ascending: true });

      if (error) throw error;

      // For each event, call the database function to get ticket sales
      const salesDataPromises = data?.map(async (event) => {
        // Try RPC first (bypasses RLS, includes revenue + comped row)
        const { data: ticketSales, error: salesError } = await supabase
          .rpc('get_ticket_sales_for_event_admin', { ev_id: event.id });

        if (salesError) {
          console.error(`Error fetching sales for event ${event.id}:`, salesError);
        }

        let ticketsSalesData: any[] = [];

        if (!salesError && Array.isArray(ticketSales) && ticketSales.length > 0) {
          ticketsSalesData = ticketSales.map((sale: any) => ({
            ticket_id: sale.ticket_id || 'comped-unassigned',
            ticket_name: sale.ticket_name,
            ticket_capacity: sale.ticket_capacity,
            tickets_sold: sale.tickets_sold,
            unit_price_cents: sale.unit_price_cents || 0,
            total_revenue_cents: sale.total_revenue_cents || 0,
            participants_per_ticket: sale.participants_per_ticket || 1,
          }));
        } else {
          // Fallback path: build analytics on the client using tables
          // 1) Fetch tickets
          const { data: tickets } = await supabase
            .from('tickets')
            .select('id, name, capacity_total, participants_per_ticket, unit_amount_cents')
            .eq('event_id', event.id)
            .order('display_order', { ascending: true });

          // 2) Fetch paid orders and their items
          const { data: paidOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('event_id', event.id)
            .eq('status', 'paid');

          let orderItems: any[] = [];
          if (paidOrders && paidOrders.length) {
            const orderIds = paidOrders.map(o => o.id);
            const { data: items } = await supabase
              .from('order_items')
              .select('ticket_id, quantity, total_amount_cents')
              .in('order_id', orderIds);
            orderItems = items || [];
          }

          // 3) Count comped attendees by ticket
          const { data: compedAttendees } = await supabase
            .from('attendees')
            .select('comped_ticket_id')
            .eq('event_id', event.id)
            .eq('is_comped', true);

          const compedByTicket: Record<string, number> = {};
          let compedUnassigned = 0;
          (compedAttendees || []).forEach(a => {
            if (a.comped_ticket_id) {
              compedByTicket[a.comped_ticket_id] = (compedByTicket[a.comped_ticket_id] || 0) + 1;
            } else {
              compedUnassigned += 1;
            }
          });

          ticketsSalesData = (tickets || []).map((t: any) => {
            const parts = t.participants_per_ticket || 1;
            const capacity = t.capacity_total || 0;
            const paidSeats = orderItems
              .filter(oi => oi.ticket_id === t.id)
              .reduce((sum, oi) => sum + (oi.quantity * parts), 0);
            const paidRevenue = orderItems
              .filter(oi => oi.ticket_id === t.id)
              .reduce((sum, oi) => sum + (oi.total_amount_cents || 0), 0);
            const compedSeats = compedByTicket[t.id] || 0;
            return {
              ticket_id: t.id,
              ticket_name: t.name,
              ticket_capacity: capacity,
              tickets_sold: paidSeats + compedSeats,
              unit_price_cents: t.unit_amount_cents || 0,
              total_revenue_cents: paidRevenue,
              participants_per_ticket: parts,
            };
          });

          // Add comped-unassigned bucket if needed
          if (compedUnassigned > 0) {
            ticketsSalesData.push({
              ticket_id: 'comped-unassigned',
              ticket_name: 'Comped / Credited (Custom)',
              ticket_capacity: 0,
              tickets_sold: compedUnassigned,
              unit_price_cents: 0,
              total_revenue_cents: 0,
              participants_per_ticket: 1,
            });
          }
        }

        // Get attendees with internal notes using the admin edge function
        const { data: attendeesResponse, error: attendeesError } = await supabase.functions.invoke(
          'admin-list-attendees',
          { body: { eventId: event.id } }
        );

        if (attendeesError) {
          console.error(`Error fetching attendees for event ${event.id}:`, attendeesError);
        }

        // Filter attendees that have internal notes
        const attendeesData = attendeesResponse?.attendees
          ?.filter((a: any) => a.internal_notes)
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            email: a.email,
            ticket_label: a.ticket?.name || null,
            internal_notes: a.internal_notes
          })) || [];

        const totalTicketsSold = ticketsSalesData.reduce((sum: number, ticket: any) => sum + ticket.tickets_sold, 0);
        const totalRevenue = ticketsSalesData.reduce((sum: number, ticket: any) => sum + ticket.total_revenue_cents, 0);

        return {
          event_id: event.id,
          event_title: event.title,
          event_starts_at: event.starts_at,
          event_ends_at: event.ends_at,
          event_capacity: event.capacity_total || ticketsSalesData
            .filter((t: any) => t.ticket_id !== 'comped-unassigned')
            .reduce((sum: number, t: any) => sum + (t.ticket_capacity * (t.participants_per_ticket || 1)), 0),
          total_tickets_sold: totalTicketsSold,
          total_revenue_cents: totalRevenue,
          tickets: ticketsSalesData,
          attendees_with_notes: attendeesData || []
        };
      }) || [];

      const salesData = (await Promise.all(salesDataPromises)).filter(Boolean);
      setSalesData(salesData as EventSalesData[]);
    } catch (error) {
      console.error('Error fetching ticket sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPercentage = (sold: number, total: number) => {
    if (total === 0) return '0%';
    return `${Math.round((sold / total) * 100)}%`;
  };

  const getProgressVariant = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Filter by Month and Year BEFORE splitting into current vs past
  const filteredSalesData = salesData.filter(event => {
    const eventStart = new Date(event.event_starts_at);
    const matchesMonth = selectedMonth === "all" || (eventStart.getMonth() + 1).toString() === selectedMonth;
    const matchesYear = selectedYear === "all" || eventStart.getFullYear().toString() === selectedYear;
    return matchesMonth && matchesYear;
  });

  // Separate current and past events based on filtered data
  const currentEvents = filteredSalesData.filter(event => {
    // If no end time, check if start time is in the future or within last 24 hours
    if (!event.event_ends_at) {
      const eventStart = new Date(event.event_starts_at);
      const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      return hoursSinceStart < 24; // Show events that started less than 24 hours ago
    }
    return new Date(event.event_ends_at) >= now;
  });
  
  const pastEvents = filteredSalesData.filter(event => {
    if (!event.event_ends_at) {
      const eventStart = new Date(event.event_starts_at);
      const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      return hoursSinceStart >= 24;
    }
    return new Date(event.event_ends_at) < now;
  });

  const eventsToDisplay = showPastEvents ? pastEvents : currentEvents;
  
  // Apply pagination to the final list
  const totalItems = eventsToDisplay.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = eventsToDisplay.slice(indexOfFirstItem, indexOfLastItem);

  // Generate Year options based on data, plus fallback current/next year
  const years = Array.from(new Set([
    ...salesData.map(e => new Date(e.event_starts_at).getFullYear().toString()),
    new Date().getFullYear().toString(),
    (new Date().getFullYear() + 1).toString()
  ])).sort((a, b) => b.localeCompare(a));

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const resetFilters = () => {
    setSelectedMonth("all");
    setSelectedYear("all");
    setCurrentPage(1);
  };

  const viewTotals = eventsToDisplay.reduce(
    (acc, event) => {
      acc.capacity += event.event_capacity;
      acc.sold += event.total_tickets_sold;
      acc.revenue += event.total_revenue_cents;
      return acc;
    },
    { capacity: 0, sold: 0, revenue: 0 }
  );
  const fillRate = viewTotals.capacity > 0 ? Math.round((viewTotals.sold / viewTotals.capacity) * 100) : 0;

  if (isLoading) {
    return (
      <AdminRoute>
        <main className="container mx-auto py-8 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </main>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto px-4 py-8 space-y-6 md:space-y-8 overflow-x-clip">
        <Helmet>
          <title>Ticket Sales Analytics | Admin Dashboard</title>
          <meta name="description" content="Monitor ticket sales performance by event and ticket type with detailed analytics" />
          <link rel="canonical" href={`${baseUrl}/admin/ticket-sales`} />
        </Helmet>

        <header className="space-y-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-white via-[hsl(35_50%_97%)] to-[hsl(30_45%_94%)] p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Sales Analytics: {showPastEvents ? 'Past Events' : 'Current Events'}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground truncate">
                Monitor ticket sales performance and attendee metrics
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="flex gap-2">
                <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[120px] bg-white/50 backdrop-blur-sm border-primary/20">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-white/50 backdrop-blur-sm border-primary/20">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Tabs 
                  value={showPastEvents ? "past" : "current"} 
                  onValueChange={(v) => { setShowPastEvents(v === "past"); setCurrentPage(1); }}
                  className="flex-1 sm:flex-none"
                >
                  <TabsList className="grid w-full grid-cols-2 h-10">
                    <TabsTrigger value="current" className="text-xs md:text-sm">
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      Current ({currentEvents.length})
                    </TabsTrigger>
                    <TabsTrigger value="past" className="text-xs md:text-sm">
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      Past ({pastEvents.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                {(selectedMonth !== "all" || selectedYear !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={resetFilters}
                    title="Clear Filters"
                    className="h-10 w-10 text-muted-foreground hover:text-primary"
                  >
                    <FilterX className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>



        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-white/80 border-primary/10">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Events in View</p>
              <p className="text-xl md:text-2xl font-bold">{eventsToDisplay.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 border-primary/10">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Seats Sold</p>
              <p className="text-xl md:text-2xl font-bold">{viewTotals.sold}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 border-primary/10">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Fill Rate</p>
              <p className="text-xl md:text-2xl font-bold">{fillRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 border-primary/10 col-span-2 md:col-span-1">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl md:text-2xl font-bold text-primary">{formatCurrency(viewTotals.revenue)}</p>
            </CardContent>
          </Card>
        </section>

        {/* Events Grid */}
        <div className="grid gap-6">
          {eventsToDisplay.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-medium">
                    {showPastEvents ? 'No past events found' : 'No current events found'}
                  </h3>
                  <p className="text-muted-foreground">
                    {selectedMonth !== "all" || selectedYear !== "all"
                      ? 'No events match your current month/year filters.'
                      : (showPastEvents 
                        ? 'No completed events with ticket sales data available.'
                        : 'No current events with ticket sales data available.')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            currentItems.map((event) => {

              const overallPercentage = (event.total_tickets_sold / event.event_capacity) * 100;
              
              return (
                <Card key={event.event_id} className="overflow-hidden border-primary/10 bg-white/85">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg md:text-xl mb-2 break-words">
                          {event.event_title}
                        </CardTitle>
                        <p className="text-xs md:text-sm text-muted-foreground mb-2">
                          {new Date(event.event_starts_at).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-white/70 px-2.5 py-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {event.total_tickets_sold} seat{event.total_tickets_sold !== 1 ? 's' : ''} / {event.event_capacity}
                            </span>
                          </div>
                          <Badge variant="outline" className="bg-white/70">
                            {formatPercentage(event.total_tickets_sold, event.event_capacity)} filled
                          </Badge>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild className="w-full md:w-auto min-h-10">
                        <Link to={`/admin/events/${event.event_id}/purchases`}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Purchase Details
                        </Link>
                      </Button>
                    </div>
                    
                    {/* Overall Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs md:text-sm">
                        <span>Overall Progress</span>
                        <span className="font-medium">
                          {event.total_tickets_sold} / {event.event_capacity}
                        </span>
                      </div>
                      <Progress 
                        value={overallPercentage} 
                        className="h-2 [&>div]:bg-green-500"
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                      <h4 className="font-medium flex items-center gap-2 text-sm md:text-base">
                        <Ticket className="h-4 w-4" />
                        Sales by Ticket Type
                      </h4>
                      <Badge variant="outline" className="text-sm font-semibold">
                        Total: {formatCurrency(event.total_revenue_cents)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {event.tickets.map((ticket) => {
                        const isUnassignedComped = ticket.ticket_id === 'comped-unassigned';
                        // Calculate actual attendee capacity: ticket_capacity × participants_per_ticket
                        const attendeeCapacity = ticket.ticket_capacity * ticket.participants_per_ticket;
                        const ticketPercentage = attendeeCapacity > 0 
                          ? (ticket.tickets_sold / attendeeCapacity) * 100 
                          : 0;
                        
                        return (
                          <div key={ticket.ticket_id} className="space-y-2 rounded-lg border border-border/60 bg-white/70 p-3">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium break-words text-sm md:text-base">
                                  {!isUnassignedComped 
                                    ? `${Math.floor(ticket.tickets_sold / ticket.participants_per_ticket)} x ${ticket.ticket_name}`
                                    : ticket.ticket_name}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-muted-foreground mt-0.5">
                                  <span className="font-mono">
                                    {ticket.tickets_sold} seat{ticket.tickets_sold !== 1 ? 's' : ''}{!isUnassignedComped && ` / ${attendeeCapacity}`}
                                  </span>
                                  {!isUnassignedComped && (
                                    <>
                                      <span>•</span>
                                      <span>{formatCurrency(ticket.unit_price_cents)} each</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-1.5">
                                <Badge variant="default" className="font-semibold text-xs md:text-sm">
                                  {formatCurrency(ticket.total_revenue_cents)}
                                </Badge>
                                {!isUnassignedComped && (
                                  <Badge variant="secondary" className="text-xs">
                                    {formatPercentage(ticket.tickets_sold, attendeeCapacity)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {!isUnassignedComped && (
                              <Progress 
                                value={ticketPercentage} 
                                className="h-1.5"
                              />
                            )}
                          </div>
                          );
                        })}
                      </div>

                      {/* Attendees with Internal Notes */}
                      {event.attendees_with_notes.length > 0 && (
                        <div className="mt-6 pt-6 border-t space-y-3">
                          <h4 className="font-medium flex items-center gap-2 text-sm md:text-base">
                            <StickyNote className="h-4 w-4" />
                            Attendees with Internal Notes ({event.attendees_with_notes.length})
                          </h4>
                          <div className="space-y-2">
                            {event.attendees_with_notes.map((attendee) => (
                              <div key={attendee.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium break-words text-sm">{attendee.name || 'No name'}</p>
                                    <p className="text-xs text-muted-foreground break-all">{attendee.email}</p>
                                    {attendee.ticket_label && (
                                      <Badge variant="outline" className="mt-1 text-xs">
                                        {attendee.ticket_label}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {attendee.internal_notes && (
                                  <p className="text-xs md:text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2 break-words">
                                    {attendee.internal_notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )
          }
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center pt-8 pb-12">
            <Pagination>
              <PaginationContent className="bg-white/70 backdrop-blur-sm border border-primary/10 rounded-full px-2 py-1 shadow-sm">
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page} className="hidden sm:inline-block">
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>
    </AdminRoute>

    );
  };

export default TicketSales;
