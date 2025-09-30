import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, ShoppingCart, Calendar, DollarSign } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";

interface PurchaseDetail {
  attendee_id: string;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  order_id: string;
  purchase_date: string;
  ticket_name: string;
  ticket_quantity: number;
  addons: Array<{
    name: string;
    quantity: number;
  }>;
  total_amount_cents: number;
}

const EventPurchaseDetails = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const isMobile = useIsMobile();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const [eventTitle, setEventTitle] = useState<string>("");
  const [purchases, setPurchases] = useState<PurchaseDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (eventId) {
      fetchPurchaseDetails();
    }
  }, [eventId]);

  const fetchPurchaseDetails = async () => {
    try {
      setIsLoading(true);

      // Get event title
      const { data: eventData } = await supabase
        .from('events')
        .select('title')
        .eq('id', eventId)
        .single();

      if (eventData) {
        setEventTitle(eventData.title);
      }

      // Get all attendees for this event with their order information
      const { data: attendeesData, error: attendeesError } = await supabase
        .from('attendees')
        .select(`
          id,
          name,
          email,
          phone,
          order_item_id
        `)
        .eq('event_id', eventId);

      if (attendeesError) throw attendeesError;

      // For each attendee, get their order details
      const purchaseDetailsPromises = attendeesData?.map(async (attendee) => {
        if (!attendee.order_item_id) return null;

        // Get order item details
        const { data: orderItemData } = await supabase
          .from('order_items')
          .select(`
            id,
            order_id,
            ticket_id,
            quantity
          `)
          .eq('id', attendee.order_item_id)
          .single();

        if (!orderItemData) return null;

        // Get order details
        const { data: orderData } = await supabase
          .from('orders')
          .select('created_at, total_amount_cents')
          .eq('id', orderItemData.order_id)
          .single();

        // Get ticket name
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('name')
          .eq('id', orderItemData.ticket_id)
          .single();

        // Get addons for this order
        const { data: addonItems } = await supabase
          .from('order_items')
          .select(`
            addon_id,
            quantity,
            addons:addon_id (name)
          `)
          .eq('order_id', orderItemData.order_id)
          .not('addon_id', 'is', null);

        const addons = addonItems?.map(item => ({
          name: (item.addons as any)?.name || 'Unknown',
          quantity: item.quantity
        })) || [];

        return {
          attendee_id: attendee.id,
          attendee_name: attendee.name,
          attendee_email: attendee.email,
          attendee_phone: attendee.phone,
          order_id: orderItemData.order_id,
          purchase_date: orderData?.created_at || '',
          ticket_name: ticketData?.name || 'Unknown',
          ticket_quantity: orderItemData.quantity,
          addons,
          total_amount_cents: orderData?.total_amount_cents || 0,
        };
      }) || [];

      const purchaseDetails = (await Promise.all(purchaseDetailsPromises)).filter(Boolean) as PurchaseDetail[];
      setPurchases(purchaseDetails);
    } catch (error) {
      console.error('Error fetching purchase details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    
    const query = searchQuery.toLowerCase();
    return purchases.filter(purchase =>
      (purchase.attendee_name || '').toLowerCase().includes(query) ||
      (purchase.attendee_email || '').toLowerCase().includes(query)
    );
  }, [purchases, searchQuery]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <AdminRoute>
        <AdminHeader />
        <main className="container mx-auto py-8 space-y-6">
          <Skeleton className="h-8 w-96" />
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
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
      <main className="container mx-auto py-8 space-y-6 px-4">
        <Helmet>
          <title>Purchase Details - {eventTitle} | Admin Dashboard</title>
          <meta name="description" content="View detailed purchase information for event attendees" />
          <link rel="canonical" href={`${baseUrl}/admin/events/${eventId}/purchases`} />
        </Helmet>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/ticket-sales">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sales Analytics
            </Link>
          </Button>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Purchase Details</h1>
          <p className="text-muted-foreground">{eventTitle}</p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <ShoppingCart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{purchases.length}</p>
                  <p className="text-sm text-muted-foreground">Total Purchases</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(purchases.reduce((sum, p) => sum + p.total_amount_cents, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {purchases.reduce((sum, p) => sum + p.ticket_quantity, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Tickets Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by attendee name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Purchase Details Table/Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Details ({filteredPurchases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'No purchases match your search' : 'No purchases found for this event'}
              </div>
            ) : isMobile ? (
              // Mobile Card Layout
              <div className="space-y-4">
                {filteredPurchases.map((purchase) => (
                  <div key={purchase.attendee_id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{purchase.attendee_name || 'No name'}</h3>
                        <p className="text-sm text-muted-foreground">{purchase.attendee_email || 'No email'}</p>
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {formatCurrency(purchase.total_amount_cents)}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Phone:</span> {purchase.attendee_phone || '-'}
                      </div>
                      <div>
                        <span className="font-medium">Ticket:</span> {purchase.ticket_name} (x{purchase.ticket_quantity})
                      </div>
                      {purchase.addons.length > 0 && (
                        <div>
                          <span className="font-medium">Add-ons:</span>
                          <ul className="ml-4 mt-1">
                            {purchase.addons.map((addon, idx) => (
                              <li key={idx}>• {addon.name} (x{addon.quantity})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Purchase Date:</span> {formatDate(purchase.purchase_date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Desktop Table Layout
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Phone</th>
                      <th className="pb-3 font-medium">Ticket</th>
                      <th className="pb-3 font-medium">Add-ons</th>
                      <th className="pb-3 font-medium">Purchase Date</th>
                      <th className="pb-3 font-medium text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((purchase) => (
                      <tr key={purchase.attendee_id} className="border-b">
                        <td className="py-3">{purchase.attendee_name || '-'}</td>
                        <td className="py-3 text-sm">{purchase.attendee_email || '-'}</td>
                        <td className="py-3 text-sm">{purchase.attendee_phone || '-'}</td>
                        <td className="py-3">
                          <Badge variant="outline">
                            {purchase.ticket_name} (x{purchase.ticket_quantity})
                          </Badge>
                        </td>
                        <td className="py-3">
                          {purchase.addons.length === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            <div className="space-y-1">
                              {purchase.addons.map((addon, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs mr-1">
                                  {addon.name} (x{addon.quantity})
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-sm">{formatDate(purchase.purchase_date)}</td>
                        <td className="py-3 text-right font-semibold">
                          {formatCurrency(purchase.total_amount_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AdminRoute>
  );
};

export default EventPurchaseDetails;
