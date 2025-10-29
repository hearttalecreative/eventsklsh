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

  useEffect(() => {
    fetchTicketSales();
  }, []);

  const fetchTicketSales = async () => {
    try {
      setIsLoading(true);
      
      // Query to get published events
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          capacity_total,
          starts_at,
          ends_at
        `)
        .eq('status', 'published')
        .order('starts_at', { ascending: true });

      if (error) throw error;

      // For each event, call the database function to get ticket sales
      const salesDataPromises = data?.map(async (event) => {
        // Use the database function that bypasses RLS
        const { data: ticketSales, error: salesError } = await supabase
          .rpc('get_ticket_sales_for_event_admin', { ev_id: event.id });

        if (salesError) {
          console.error(`Error fetching sales for event ${event.id}:`, salesError);
          return null;
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

        const ticketsSalesData = ticketSales?.map((sale: any) => ({
          ticket_id: sale.ticket_id || 'comped-unassigned',
          ticket_name: sale.ticket_name,
          ticket_capacity: sale.ticket_capacity,
          tickets_sold: sale.tickets_sold,
          unit_price_cents: sale.unit_price_cents || 0,
          total_revenue_cents: sale.total_revenue_cents || 0,
          participants_per_ticket: sale.participants_per_ticket || 1,
        })) || [];

        const totalTicketsSold = ticketsSalesData.reduce((sum: number, ticket: any) => sum + ticket.tickets_sold, 0);
        const totalRevenue = ticketsSalesData.reduce((sum: number, ticket: any) => sum + ticket.total_revenue_cents, 0);

        return {
          event_id: event.id,
          event_title: event.title,
          event_starts_at: event.starts_at,
          event_ends_at: event.ends_at,
          event_capacity: event.capacity_total || ticketsSalesData.reduce((sum: number, t: any) => sum + t.ticket_capacity, 0),
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

  // Separate current and past events
  const now = new Date();
  const currentEvents = salesData.filter(event => {
    // If no end time, check if start time is in the future or within last 24 hours
    if (!event.event_ends_at) {
      const eventStart = new Date(event.event_starts_at);
      const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      return hoursSinceStart < 24; // Show events that started less than 24 hours ago
    }
    return new Date(event.event_ends_at) >= now;
  });
  
  const pastEvents = salesData.filter(event => {
    if (!event.event_ends_at) {
      const eventStart = new Date(event.event_starts_at);
      const hoursSinceStart = (now.getTime() - eventStart.getTime()) / (1000 * 60 * 60);
      return hoursSinceStart >= 24;
    }
    return new Date(event.event_ends_at) < now;
  });

  const eventsToDisplay = showPastEvents ? pastEvents : currentEvents;

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
      <main className="container mx-auto py-8 space-y-8">
        <Helmet>
          <title>Ticket Sales Analytics | Admin Dashboard</title>
          <meta name="description" content="Monitor ticket sales performance by event and ticket type with detailed analytics" />
          <link rel="canonical" href={`${baseUrl}/admin/ticket-sales`} />
        </Helmet>

        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Ticket Sales Analytics</h1>
                <p className="text-muted-foreground">
                  Monitor ticket sales performance by event and ticket type
                </p>
              </div>
              <Button
                variant={showPastEvents ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPastEvents(!showPastEvents)}
                className="ml-4"
              >
                {showPastEvents ? (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Current Events ({currentEvents.length})
                  </>
                ) : (
                  <>
                    <History className="h-4 w-4 mr-2" />
                    Past Events ({pastEvents.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

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
                    {showPastEvents 
                      ? 'No completed events with ticket sales data available.'
                      : 'No current events with ticket sales data available.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            eventsToDisplay.map((event) => {
              const overallPercentage = (event.total_tickets_sold / event.event_capacity) * 100;
              
              return (
                <Card key={event.event_id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-2 truncate">
                          {event.event_title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mb-2">
                          {new Date(event.event_starts_at).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {event.total_tickets_sold} seat{event.total_tickets_sold !== 1 ? 's' : ''} / {event.event_capacity}
                            </span>
                          </div>
                          <Badge variant="outline">
                            {formatPercentage(event.total_tickets_sold, event.event_capacity)} filled
                          </Badge>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/events/${event.event_id}/purchases`}>
                          <FileText className="h-4 w-4 mr-2" />
                          View Purchase Details
                        </Link>
                      </Button>
                    </div>
                    
                    {/* Overall Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
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
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium flex items-center gap-2">
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
                          <div key={ticket.ticket_id} className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{ticket.ticket_name}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
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
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="default" className="font-semibold">
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
                          <h4 className="font-medium flex items-center gap-2">
                            <StickyNote className="h-4 w-4" />
                            Attendees with Internal Notes ({event.attendees_with_notes.length})
                          </h4>
                          <div className="space-y-2">
                            {event.attendees_with_notes.map((attendee) => (
                              <div key={attendee.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{attendee.name || 'No name'}</p>
                                    <p className="text-sm text-muted-foreground truncate">{attendee.email}</p>
                                    {attendee.ticket_label && (
                                      <Badge variant="outline" className="mt-1 text-xs">
                                        {attendee.ticket_label}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {attendee.internal_notes && (
                                  <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-2">
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
            )}
          </div>
        </main>
      </AdminRoute>
    );
  };

export default TicketSales;