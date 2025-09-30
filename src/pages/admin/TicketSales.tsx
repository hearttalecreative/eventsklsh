import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Ticket, Users, BarChart3, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";

interface TicketSalesData {
  event_id: string;
  event_title: string;
  event_capacity: number;
  ticket_id: string;
  ticket_name: string;
  ticket_capacity: number;
  tickets_sold: number;
}

interface EventSalesData {
  event_id: string;
  event_title: string;
  event_capacity: number;
  total_tickets_sold: number;
  tickets: Array<{
    ticket_id: string;
    ticket_name: string;
    ticket_capacity: number;
    tickets_sold: number;
  }>;
}

const TicketSales = () => {
  const isMobile = useIsMobile();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [salesData, setSalesData] = useState<EventSalesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTicketSales();
  }, []);

  const fetchTicketSales = async () => {
    try {
      setIsLoading(true);
      
      // Query to get ticket sales data per event and ticket type
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          capacity_total,
          starts_at,
          tickets (
            id,
            name,
            capacity_total,
            participants_per_ticket
          )
        `)
        .eq('status', 'published')
        .order('starts_at', { ascending: true });

      if (error) throw error;

      // For each event, get attendee counts per ticket type (including comped)
      const salesDataPromises = data?.map(async (event) => {
        const ticketSalesPromises = event.tickets.map(async (ticket: any) => {
          // Count paid attendees
          const orderItemIds = await supabase
            .from('order_items')
            .select('id')
            .eq('ticket_id', ticket.id)
            .then(({ data }) => data?.map(item => item.id) || []);
          
          const { count: paidCount } = await supabase
            .from('attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .in('order_item_id', orderItemIds.length > 0 ? orderItemIds : ['00000000-0000-0000-0000-000000000000']);

          // Count comped attendees for THIS specific ticket type
          const { count: compedCount } = await supabase
            .from('attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('is_comped', true)
            .eq('comped_ticket_id', ticket.id);

          const totalForThisTicket = (paidCount || 0) + (compedCount || 0);
          
          return {
            ticket_id: ticket.id,
            ticket_name: ticket.name,
            ticket_capacity: ticket.capacity_total,
            tickets_sold: totalForThisTicket,
          };
        });

        const ticketsSales = await Promise.all(ticketSalesPromises);
        
        // Add unassigned comped attendees (those without comped_ticket_id) as a separate category
        const { count: unassignedCompedCount } = await supabase
          .from('attendees')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('is_comped', true)
          .is('comped_ticket_id', null);

        // Add unassigned comped attendees as a separate "ticket type" if there are any
        if (unassignedCompedCount && unassignedCompedCount > 0) {
          ticketsSales.push({
            ticket_id: 'comped-unassigned',
            ticket_name: 'Comped / Credited (Custom)',
            ticket_capacity: 0,
            tickets_sold: unassignedCompedCount,
          });
        }

        const totalTicketsSold = ticketsSales.reduce((sum, ticket) => sum + ticket.tickets_sold, 0);

        return {
          event_id: event.id,
          event_title: event.title,
          event_capacity: event.capacity_total || ticketsSales.reduce((sum, t) => sum + t.ticket_capacity, 0),
          total_tickets_sold: totalTicketsSold,
          tickets: ticketsSales,
        };
      }) || [];

      const salesData = await Promise.all(salesDataPromises);
      setSalesData(salesData);
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
          <h1 className="text-3xl font-bold tracking-tight">Ticket Sales Analytics</h1>
          <p className="text-muted-foreground">
            Monitor ticket sales performance by event and ticket type
          </p>
        </header>

        {/* Events Grid */}
        <div className="grid gap-6">
          {salesData.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="text-lg font-medium">No events found</h3>
                  <p className="text-muted-foreground">
                    No published events with ticket sales data available.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            salesData.map((event) => {
              const overallPercentage = (event.total_tickets_sold / event.event_capacity) * 100;
              
              return (
                <Card key={event.event_id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl mb-2 truncate">
                          {event.event_title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {event.total_tickets_sold}/{event.event_capacity} sold
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
                        className="h-2"
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Ticket className="h-4 w-4" />
                      Sales by Ticket Type
                    </h4>
                    
                    <div className="space-y-3">
                      {event.tickets.map((ticket) => {
                        const isUnassignedComped = ticket.ticket_id === 'comped-unassigned';
                        const ticketPercentage = ticket.ticket_capacity > 0 
                          ? (ticket.tickets_sold / ticket.ticket_capacity) * 100 
                          : 0;
                        
                        return (
                          <div key={ticket.ticket_id} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{ticket.ticket_name}</p>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {isUnassignedComped ? (
                                  <>
                                    <span className="font-mono">
                                      {ticket.tickets_sold} custom comped
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      Not counted in capacity
                                    </Badge>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-mono">
                                      {ticket.tickets_sold}/{ticket.ticket_capacity}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {formatPercentage(ticket.tickets_sold, ticket.ticket_capacity)}
                                    </Badge>
                                  </>
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