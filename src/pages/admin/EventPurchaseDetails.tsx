import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, ShoppingCart, Calendar, DollarSign, Mail, Send } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { SendEmailDialog } from "@/components/admin/SendEmailDialog";

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
    unit_amount_cents: number;
  }>;
  total_amount_cents: number;
  ticket_amount_cents: number;
  addons_amount_cents: number;
  processing_fee_cents: number;
  is_comped: boolean;
}

const EventPurchaseDetails = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const isMobile = useIsMobile();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const [eventTitle, setEventTitle] = useState<string>("");
  const [purchases, setPurchases] = useState<PurchaseDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<{ email: string | string[]; name: string | null; isBulk: boolean }>({ 
    email: "", 
    name: null,
    isBulk: false
  });

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
          order_item_id,
          is_comped,
          ticket_label
        `)
        .eq('event_id', eventId);

      if (attendeesError) throw attendeesError;

      // For each attendee, get their order details
      const purchaseDetailsPromises = attendeesData?.map(async (attendee) => {
        // Handle comped attendees (no order)
        if (!attendee.order_item_id) {
          if (attendee.is_comped) {
            return {
              attendee_id: attendee.id,
              attendee_name: attendee.name,
              attendee_email: attendee.email,
              attendee_phone: attendee.phone,
              order_id: '',
              purchase_date: '',
              ticket_name: attendee.ticket_label || 'Comped',
              ticket_quantity: 1,
              addons: [],
              total_amount_cents: 0,
              ticket_amount_cents: 0,
              addons_amount_cents: 0,
              processing_fee_cents: 0,
              is_comped: true,
            };
          }
          return null;
        }

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

        // Get ticket name and price
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('name, unit_amount_cents')
          .eq('id', orderItemData.ticket_id)
          .single();

        // Get ticket items for this order to calculate ticket revenue
        const { data: ticketOrderItem } = await supabase
          .from('order_items')
          .select('total_amount_cents')
          .eq('order_id', orderItemData.order_id)
          .eq('id', orderItemData.id)
          .single();

        // Get addons for this order
        const { data: addonItems } = await supabase
          .from('order_items')
          .select(`
            addon_id,
            quantity,
            unit_amount_cents,
            total_amount_cents,
            addons:addon_id (name)
          `)
          .eq('order_id', orderItemData.order_id)
          .not('addon_id', 'is', null);

        const addons = addonItems?.map(item => ({
          name: (item.addons as any)?.name || 'Unknown',
          quantity: item.quantity,
          unit_amount_cents: item.unit_amount_cents || 0
        })) || [];

        // Calculate amounts
        const ticketAmount = ticketOrderItem?.total_amount_cents || 0;
        const addonsAmount = addonItems?.reduce((sum, item) => sum + (item.total_amount_cents || 0), 0) || 0;
        const totalAmount = orderData?.total_amount_cents || 0;
        const processingFee = totalAmount - ticketAmount - addonsAmount;

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
          total_amount_cents: totalAmount,
          ticket_amount_cents: ticketAmount,
          addons_amount_cents: addonsAmount,
          processing_fee_cents: processingFee,
          is_comped: attendee.is_comped || false
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

  // Calculate ticket breakdown
  const ticketBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    purchases.forEach(purchase => {
      const current = breakdown.get(purchase.ticket_name) || 0;
      breakdown.set(purchase.ticket_name, current + purchase.ticket_quantity);
    });
    return Array.from(breakdown.entries()).map(([name, count]) => ({ name, count }));
  }, [purchases]);

  // Calculate addon breakdown
  const addonBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();
    purchases.forEach(purchase => {
      purchase.addons.forEach(addon => {
        const current = breakdown.get(addon.name) || 0;
        breakdown.set(addon.name, current + addon.quantity);
      });
    });
    return Array.from(breakdown.entries()).map(([name, count]) => ({ name, count }));
  }, [purchases]);

  const handleEmailClick = (email: string, name: string | null) => {
    setSelectedRecipient({ email, name, isBulk: false });
    setEmailDialogOpen(true);
  };

  const handleBulkEmail = () => {
    const allEmails = purchases
      .filter(p => p.attendee_email)
      .map(p => p.attendee_email!);
    
    if (allEmails.length === 0) {
      return;
    }
    
    setSelectedRecipient({ email: allEmails, name: null, isBulk: true });
    setEmailDialogOpen(true);
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

        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Purchase Details</h1>
            <p className="text-muted-foreground">{eventTitle}</p>
          </div>
          
          <Button 
            onClick={handleBulkEmail}
            disabled={purchases.filter(p => p.attendee_email).length === 0}
            className="self-start sm:self-auto"
          >
            <Send className="h-4 w-4 mr-2" />
            Email All Attendees
          </Button>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(purchases.reduce((sum, p) => sum + p.ticket_amount_cents, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Tickets Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-purple-500/10">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(purchases.reduce((sum, p) => sum + p.addons_amount_cents, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Add-ons Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-orange-500/10">
                  <DollarSign className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(purchases.reduce((sum, p) => sum + p.processing_fee_cents, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Processing Fees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tickets and Add-ons Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tickets Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tickets Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {ticketBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tickets sold</p>
              ) : (
                <div className="space-y-3">
                  {ticketBreakdown.map((ticket, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{ticket.name}</span>
                      <Badge variant="secondary">{ticket.count} sold</Badge>
                    </div>
                  ))}
                  <div className="pt-3 border-t flex justify-between items-center">
                    <span className="text-sm font-bold">Total</span>
                    <Badge variant="default">
                      {ticketBreakdown.reduce((sum, t) => sum + t.count, 0)} tickets
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add-ons Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add-ons Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {addonBreakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm">No add-ons sold</p>
              ) : (
                <div className="space-y-3">
                  {addonBreakdown.map((addon, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{addon.name}</span>
                      <Badge variant="secondary">{addon.count} sold</Badge>
                    </div>
                  ))}
                  <div className="pt-3 border-t flex justify-between items-center">
                    <span className="text-sm font-bold">Total</span>
                    <Badge variant="default">
                      {addonBreakdown.reduce((sum, a) => sum + a.count, 0)} add-ons
                    </Badge>
                  </div>
                </div>
              )}
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
                         <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{purchase.attendee_name || 'No name'}</h3>
                          {purchase.is_comped && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                              Comped
                            </Badge>
                          )}
                        </div>
                        {purchase.attendee_email ? (
                          <button
                            onClick={() => handleEmailClick(purchase.attendee_email!, purchase.attendee_name)}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {purchase.attendee_email}
                          </button>
                        ) : (
                          <p className="text-sm text-muted-foreground">No email</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {purchase.is_comped ? 'Free' : formatCurrency(purchase.total_amount_cents)}
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
                         <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span>{purchase.attendee_name || '-'}</span>
                            {purchase.is_comped && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                                Comped
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-sm">
                          {purchase.attendee_email ? (
                            <button
                              onClick={() => handleEmailClick(purchase.attendee_email!, purchase.attendee_name)}
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              {purchase.attendee_email}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
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
                        <td className="py-3 text-sm">
                          {purchase.is_comped ? '-' : formatDate(purchase.purchase_date)}
                        </td>
                        <td className="py-3 text-right font-semibold">
                          {purchase.is_comped ? (
                            <span className="text-green-600">Free</span>
                          ) : (
                            formatCurrency(purchase.total_amount_cents)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          recipientEmail={selectedRecipient.email}
          recipientName={selectedRecipient.name}
          isBulk={selectedRecipient.isBulk}
        />
      </main>
    </AdminRoute>
  );
};

export default EventPurchaseDetails;
