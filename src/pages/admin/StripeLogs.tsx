import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Calendar, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StripeLog {
  id: string;
  created_at: string;
  event_type: string;
  stripe_session_id: string | null;
  stripe_event_id: string | null;
  customer_name: string | null;
  customer_email: string;
  amount_cents: number | null;
  currency: string | null;
  status: string;
  order_id: string | null;
  event_id: string | null;
  event_title: string | null;
  tickets_count: number | null;
  metadata: any;
  error_message: string | null;
  processing_time_ms: number | null;
}

const StripeLogs = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [logs, setLogs] = useState<StripeLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<StripeLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<StripeLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('stripe_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500); // Last 500 logs

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching Stripe logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // Search by name, email, or Stripe IDs
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.customer_name?.toLowerCase().includes(term) ||
        log.customer_email?.toLowerCase().includes(term) ||
        log.stripe_session_id?.toLowerCase().includes(term) ||
        log.stripe_event_id?.toLowerCase().includes(term) ||
        // Also search within metadata which often contains the payment_intent ID
        (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(term))
      );
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(log => new Date(log.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.created_at) <= end);
    }

    setFilteredLogs(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'duplicate':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      success: 'default',
      error: 'destructive',
      duplicate: 'secondary',
      processing: 'outline'
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const formatCurrency = (cents: number | null, currency: string | null) => {
    if (!cents) return '$0.00';
    const amount = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(date));
  };

  const viewDetails = (log: StripeLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <AdminRoute>
        <AdminHeader />
        <main className="container mx-auto py-8 px-4">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </main>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-8 px-4 space-y-6">
        <Helmet>
          <title>Stripe Payment Logs | Admin Dashboard</title>
          <meta name="description" content="View all Stripe payment events and transaction logs" />
          <link rel="canonical" href={`${baseUrl}/admin/stripe-logs`} />
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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Stripe Payment Logs
          </h1>
          <p className="text-muted-foreground">
            Complete audit trail of all Stripe payment events and processing
          </p>
        </header>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search by Name or Email</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Clear Filters
              </Button>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Badge variant="secondary" className="ml-auto">
                {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No logs found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className="text-sm">{log.event_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.customer_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{log.customer_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate" title={log.event_title || ''}>
                            {log.event_title || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(log.amount_cents, log.currency)}
                        </TableCell>
                        <TableCell className="text-center">
                          {log.tickets_count || '—'}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewDetails(log)}
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

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Details</DialogTitle>
              <DialogDescription>
                Complete information about this Stripe event
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Date & Time</Label>
                    <p className="font-mono text-sm">{formatDate(selectedLog.created_at)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Event Type</Label>
                    <p className="text-sm">{selectedLog.event_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Processing Time</Label>
                    <p className="text-sm">{selectedLog.processing_time_ms ? `${selectedLog.processing_time_ms}ms` : '—'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="text-sm">{selectedLog.customer_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="text-sm">{selectedLog.customer_email}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Payment Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Amount</Label>
                      <p className="text-sm font-mono">{formatCurrency(selectedLog.amount_cents, selectedLog.currency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tickets</Label>
                      <p className="text-sm">{selectedLog.tickets_count || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Stripe Session ID</Label>
                      <p className="text-xs font-mono break-all">{selectedLog.stripe_session_id || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Stripe Event ID</Label>
                      <p className="text-xs font-mono break-all">{selectedLog.stripe_event_id || '—'}</p>
                    </div>
                  </div>
                </div>

                {selectedLog.event_title && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Event</h4>
                    <p className="text-sm">{selectedLog.event_title}</p>
                  </div>
                )}

                {selectedLog.order_id && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Order</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono">{selectedLog.order_id}</p>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/event-purchase-details/${selectedLog.event_id}`}>
                          View Order
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {selectedLog.error_message && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2 text-destructive">Error Message</h4>
                    <p className="text-sm bg-destructive/10 p-3 rounded">{selectedLog.error_message}</p>
                  </div>
                )}

                {selectedLog.metadata && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Additional Metadata</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </AdminRoute>
  );
};

export default StripeLogs;
