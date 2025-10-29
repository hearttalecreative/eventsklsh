import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, RefreshCw, AlertTriangle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

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

const PaymentErrorLogs = () => {
  const [logs, setLogs] = useState<PaymentErrorLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<PaymentErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<PaymentErrorLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
      setFilteredLogs(data || []);
    } catch (err) {
      console.error("Error fetching payment error logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, startDate, endDate, logs]);

  const filterLogs = () => {
    let filtered = [...logs];

    // Search filter
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

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(
        (log) => new Date(log.created_at) >= new Date(startDate)
      );
    }
    if (endDate) {
      filtered = filtered.filter(
        (log) => new Date(log.created_at) <= new Date(endDate + "T23:59:59")
      );
    }

    setFilteredLogs(filtered);
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

  const viewDetails = (log: PaymentErrorLog) => {
    setSelectedLog(log);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
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
        <title>Payment Error Logs - Admin</title>
      </Helmet>
      <AdminHeader />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Payment Error Logs</h1>
            <p className="text-muted-foreground">
              View and debug payment processing errors
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
                  placeholder="Error message, email, name..."
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
              <Button onClick={fetchLogs} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Error Logs ({filteredLogs.length} of {logs.length})
            </CardTitle>
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
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        No error logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
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
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Details
            </DialogTitle>
            <DialogDescription>
              {selectedLog && formatDate(selectedLog.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Error Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <div className="font-medium">{selectedLog.error_type}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Message:</span>
                    <div className="font-medium">{selectedLog.error_message}</div>
                  </div>
                </div>
              </div>

              {selectedLog.buyer_email && (
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <div className="font-medium">{selectedLog.buyer_name}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-medium">{selectedLog.buyer_email}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedLog.error_stack && (
                <div>
                  <h3 className="font-semibold mb-2">Stack Trace</h3>
                  <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
                    {selectedLog.error_stack}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Technical Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedLog.event_id && (
                    <div>
                      <span className="text-muted-foreground">Event ID:</span>
                      <div className="font-mono text-xs">{selectedLog.event_id}</div>
                    </div>
                  )}
                  {selectedLog.ticket_id && (
                    <div>
                      <span className="text-muted-foreground">Ticket ID:</span>
                      <div className="font-mono text-xs">{selectedLog.ticket_id}</div>
                    </div>
                  )}
                  {selectedLog.user_agent && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">User Agent:</span>
                      <div className="font-mono text-xs">{selectedLog.user_agent}</div>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div>
                      <span className="text-muted-foreground">IP Address:</span>
                      <div className="font-mono text-xs">{selectedLog.ip_address}</div>
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

export default PaymentErrorLogs;
