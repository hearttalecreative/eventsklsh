import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { toast } from "sonner";

interface CheckoutLog {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  total_amount_cents: number;
  event_id: string | null;
  event_title: string | null;
  created_at: string;
}

const CheckoutLogs = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [logs, setLogs] = useState<CheckoutLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      
      // Fetch logs from last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { data, error } = await supabase
        .from('checkout_logs')
        .select('*')
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching checkout logs:', error);
      toast.error('Failed to load checkout logs');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    if (logs.length === 0) {
      toast.error('No data to download');
      return;
    }

    // Create CSV content
    const headers = ['Date', 'First Name', 'Last Name', 'Email', 'Phone', 'Total Amount', 'Event'];
    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.first_name || '',
      log.last_name || '',
      log.email,
      log.phone || '',
      `$${(log.total_amount_cents / 100).toFixed(2)}`,
      log.event_title || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fileName = `checkout-logs-${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV downloaded successfully');
  };

  if (isLoading) {
    return (
      <AdminRoute>
        <main className="container mx-auto py-8 space-y-8">
          <Skeleton className="h-8 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </main>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-8 space-y-8">
        <Helmet>
          <title>Checkout Logs | Admin Dashboard</title>
          <meta name="description" content="View all checkout initiations from the last 90 days" />
          <link rel="canonical" href={`${baseUrl}/admin/checkout-logs`} />
        </Helmet>

        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/ticket-sales">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Analytics
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Checkout Logs</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              All checkout initiations from the last 90 days
            </p>
          </div>
          
          <Button onClick={downloadCSV} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Checkout Attempts ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No checkout logs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
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
                        <TableCell>
                          {[log.first_name, log.last_name].filter(Boolean).join(' ') || 'N/A'}
                        </TableCell>
                        <TableCell>{log.email}</TableCell>
                        <TableCell>{log.phone || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">
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
      </main>
    </AdminRoute>
  );
};

export default CheckoutLogs;
