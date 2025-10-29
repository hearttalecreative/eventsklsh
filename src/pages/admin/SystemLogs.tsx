import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Search, RefreshCw, Download, Database, AlertTriangle, FileText } from "lucide-react";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface StripeLog {
  id: string;
  created_at: string;
  event_type: string;
  customer_email: string | null;
  customer_name: string | null;
  amount_cents: number | null;
  currency: string | null;
  tickets_count: number | null;
  status: string;
  error_message: string | null;
  stripe_session_id: string | null;
  event_id: string | null;
  event_title: string | null;
  order_id: string | null;
}

interface PaymentErrorLog {
  id: string;
  created_at: string;
  event_id: string | null;
  ticket_id: string | null;
  ticket_qty: number | null;
  buyer_email: string | null;
  buyer_name: string | null;
  error_type: string;
  error_message: string;
  error_stack: string | null;
  request_payload: any;
  validation_errors: any;
  user_agent: string | null;
  ip_address: string | null;
}

interface CheckoutLog {
  id: string;
  total_amount_cents: number;
  event_id: string | null;
  event_title: string | null;
  created_at: string;
}

const SystemLogs = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  // Stripe logs state
  const [stripeLogs, setStripeLogs] = useState<StripeLog[]>([]);
  const [filteredStripeLogs, setFilteredStripeLogs] = useState<StripeLog[]>([]);
  
  // Payment error logs state
  const [paymentErrorLogs, setPaymentErrorLogs] = useState<PaymentErrorLog[]>([]);
  const [filteredPaymentErrorLogs, setFilteredPaymentErrorLogs] = useState<PaymentErrorLog[]>([]);
  
  // Checkout logs state
  const [checkoutLogs, setCheckoutLogs] = useState<CheckoutLog[]>([]);
  
  // Common state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedStripeLog, setSelectedStripeLog] = useState<StripeLog | null>(null);
  const [selectedPaymentErrorLog, setSelectedPaymentErrorLog] = useState<PaymentErrorLog | null>(null);

  useEffect(() => {
    fetchAllLogs();
  }, []);

  useEffect(() => {
    filterStripeLogs();
    filterPaymentErrorLogs();
  }, [searchTerm, startDate, endDate, stripeLogs, paymentErrorLogs]);

  const fetchAllLogs = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStripeLogs(),
        fetchPaymentErrorLogs(),
        fetchCheckoutLogs()
      ]);
    } catch (err) {
      console.error("Error fetching logs:", err);
      toast.error("Error loading logs");
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeLogs = async () => {
    const { data, error } = await supabase
      .from("stripe_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    setStripeLogs(data as StripeLog[] || []);
    setFilteredStripeLogs(data as StripeLog[] || []);
  };

  const fetchPaymentErrorLogs = async () => {
    const { data, error } = await supabase
      .from("payment_error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    setPaymentErrorLogs(data || []);
    setFilteredPaymentErrorLogs(data || []);
  };

  const fetchCheckoutLogs = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('checkout_logs')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    setCheckoutLogs(data || []);
  };

  const filterStripeLogs = () => {
    let filtered = [...stripeLogs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.event_type?.toLowerCase().includes(term) ||
          log.customer_email?.toLowerCase().includes(term) ||
          log.customer_name?.toLowerCase().includes(term) ||
          log.status?.toLowerCase().includes(term) ||
          log.error_message?.toLowerCase().includes(term)
      );
    }

    if (startDate) {
      filtered = filtered.filter((log) => new Date(log.created_at) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((log) => new Date(log.created_at) <= new Date(endDate + "T23:59:59"));
    }

    setFilteredStripeLogs(filtered);
  };

  const filterPaymentErrorLogs = () => {
    let filtered = [...paymentErrorLogs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.error_message?.toLowerCase().includes(term) ||
          log.buyer_email?.toLowerCase().includes(term) ||
          log.buyer_name?.toLowerCase().includes(term) ||
          log.error_type?.toLowerCase().includes(term)
      );
    }

    if (startDate) {
      filtered = filtered.filter((log) => new Date(log.created_at) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((log) => new Date(log.created_at) <= new Date(endDate + "T23:59:59"));
    }

    setFilteredPaymentErrorLogs(filtered);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✓";
      case "error":
        return "✗";
      default:
        return "•";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const downloadCheckoutCSV = () => {
    if (checkoutLogs.length === 0) {
      toast.error('No data to download');
      return;
    }

    const headers = ['Date', 'Total Amount', 'Event'];
    const rows = checkoutLogs.map(log => [
      new Date(log.created_at).toLocaleString(),
      `$${(log.total_amount_cents / 100).toFixed(2)}`,
      log.event_title || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `checkout-metrics-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV downloaded successfully');
  };

  if (loading) {
    return (
      <AdminRoute>
        <AdminHeader />
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <Helmet>
        <title>System Logs - Admin</title>
        <meta name="description" content="View and monitor all system logs including Stripe, payment errors, and checkout analytics" />
        <link rel="canonical" href={`${baseUrl}/admin/system-logs`} />
      </Helmet>
      <AdminHeader />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Logs</h1>
            <p className="text-muted-foreground">
              Monitor all system activity, payments, and errors
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Email, name, error message..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={clearFilters} variant="outline" size="sm">
                Clear Filters
              </Button>
              <Button onClick={fetchAllLogs} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="stripe" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Stripe Logs ({filteredStripeLogs.length})
            </TabsTrigger>
            <TabsTrigger value="errors" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Payment Errors ({filteredPaymentErrorLogs.length})
            </TabsTrigger>
            <TabsTrigger value="checkout" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Checkout Metrics ({checkoutLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* Stripe Logs Tab */}
          <TabsContent value="stripe">
            <Card>
              <CardHeader>
                <CardTitle>Stripe Payment Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Tickets</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStripeLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            No Stripe logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStripeLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(log.created_at)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.event_type}
                            </TableCell>
                            <TableCell>
                              {log.customer_email ? (
                                <div className="space-y-1">
                                  <div className="font-medium">{log.customer_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {log.customer_email}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatCurrency(log.amount_cents)}
                            </TableCell>
                            <TableCell>
                              {log.tickets_count || "N/A"}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(log.status)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedStripeLog(log)}
                              >
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Errors Tab */}
          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle>Payment Error Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Error Type</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPaymentErrorLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            No error logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPaymentErrorLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(log.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                {log.error_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {log.error_message}
                            </TableCell>
                            <TableCell>
                              {log.buyer_email ? (
                                <div className="space-y-1">
                                  <div className="font-medium">{log.buyer_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {log.buyer_email}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPaymentErrorLog(log)}
                              >
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checkout Metrics Tab */}
          <TabsContent value="checkout">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Checkout Metrics (Last 30 Days)</CardTitle>
                  <Button onClick={downloadCheckoutCSV} disabled={checkoutLogs.length === 0} size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {checkoutLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No checkout data available</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checkoutLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-sm">
                              {new Date(log.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell className="max-w-md truncate">
                              {log.event_title || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${(log.total_amount_cents / 100).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Stripe Log Details Dialog */}
      <Dialog open={!!selectedStripeLog} onOpenChange={() => setSelectedStripeLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Stripe Log Details
            </DialogTitle>
            <DialogDescription>
              {selectedStripeLog && formatDate(selectedStripeLog.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedStripeLog && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Event Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Event Type:</span>
                    <div className="font-medium font-mono">{selectedStripeLog.event_type}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="font-medium">{getStatusBadge(selectedStripeLog.status)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <div className="font-medium">{formatCurrency(selectedStripeLog.amount_cents)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tickets:</span>
                    <div className="font-medium">{selectedStripeLog.tickets_count || "N/A"}</div>
                  </div>
                </div>
              </div>

              {selectedStripeLog.customer_email && (
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <div className="font-medium">{selectedStripeLog.customer_name}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-medium">{selectedStripeLog.customer_email}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedStripeLog.stripe_session_id && (
                <div>
                  <h3 className="font-semibold mb-2">Session ID</h3>
                  <div className="font-mono text-xs bg-muted p-2 rounded">
                    {selectedStripeLog.stripe_session_id}
                  </div>
                </div>
              )}

              {selectedStripeLog.error_message && (
                <div>
                  <h3 className="font-semibold mb-2">Error Message</h3>
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                    {selectedStripeLog.error_message}
                  </div>
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Error Details Dialog */}
      <Dialog open={!!selectedPaymentErrorLog} onOpenChange={() => setSelectedPaymentErrorLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Details
            </DialogTitle>
            <DialogDescription>
              {selectedPaymentErrorLog && formatDate(selectedPaymentErrorLog.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedPaymentErrorLog && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Error Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <div className="font-medium">{selectedPaymentErrorLog.error_type}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Message:</span>
                    <div className="font-medium">{selectedPaymentErrorLog.error_message}</div>
                  </div>
                </div>
              </div>

              {selectedPaymentErrorLog.buyer_email && (
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <div className="font-medium">{selectedPaymentErrorLog.buyer_name}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-medium">{selectedPaymentErrorLog.buyer_email}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedPaymentErrorLog.error_stack && (
                <div>
                  <h3 className="font-semibold mb-2">Stack Trace</h3>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                    {selectedPaymentErrorLog.error_stack}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Technical Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedPaymentErrorLog.event_id && (
                    <div>
                      <span className="text-muted-foreground">Event ID:</span>
                      <div className="font-mono text-xs">{selectedPaymentErrorLog.event_id}</div>
                    </div>
                  )}
                  {selectedPaymentErrorLog.ticket_id && (
                    <div>
                      <span className="text-muted-foreground">Ticket ID:</span>
                      <div className="font-mono text-xs">{selectedPaymentErrorLog.ticket_id}</div>
                    </div>
                  )}
                  {selectedPaymentErrorLog.user_agent && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">User Agent:</span>
                      <div className="font-mono text-xs">{selectedPaymentErrorLog.user_agent}</div>
                    </div>
                  )}
                  {selectedPaymentErrorLog.ip_address && (
                    <div>
                      <span className="text-muted-foreground">IP Address:</span>
                      <div className="font-mono text-xs">{selectedPaymentErrorLog.ip_address}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminRoute>
  );
};

export default SystemLogs;
