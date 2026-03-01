import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, ShoppingCart, TrendingUp, Users, Download, Search, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

interface TrainingPurchase {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  preferred_dates: string;
  amount_cents: number;
  status: string;
  program_id: string;
  stripe_session_id: string | null;
  created_at: string;
}

interface TrainingProgram {
  id: string;
  name: string;
  price_cents: number;
  category_id: string | null;
  active: boolean;
}

interface TrainingCategory {
  id: string;
  name: string;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#14b8a6'];

const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

export default function TrainingSalesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: purchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ['training-purchases-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TrainingPurchase[];
    },
  });

  const { data: programs } = useQuery({
    queryKey: ['training-programs-for-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_programs')
        .select('id, name, price_cents, category_id, active');
      if (error) throw error;
      return data as TrainingProgram[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['training-categories-for-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_categories')
        .select('id, name');
      if (error) throw error;
      return data as TrainingCategory[];
    },
  });

  const programMap = useMemo(() => {
    const map: Record<string, TrainingProgram> = {};
    programs?.forEach(p => { map[p.id] = p; });
    return map;
  }, [programs]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories?.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!purchases) return [];
    return purchases.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (programFilter !== 'all' && p.program_id !== programFilter) return false;
      if (categoryFilter !== 'all') {
        const prog = programMap[p.program_id];
        if (!prog || prog.category_id !== categoryFilter) return false;
      }
      if (startDate) {
        const d = parseISO(p.created_at);
        if (d < parseISO(startDate)) return false;
      }
      if (endDate) {
        const d = parseISO(p.created_at);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          (programMap[p.program_id]?.name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [purchases, statusFilter, programFilter, categoryFilter, startDate, endDate, searchTerm, programMap]);

  // KPIs
  const totalSales = filtered.length;
  const paidSales = filtered.filter(p => p.status === 'paid');
  const pendingSales = filtered.filter(p => p.status === 'pending');
  const totalRevenue = paidSales.reduce((sum, p) => sum + p.amount_cents, 0);
  const avgOrderValue = paidSales.length > 0 ? totalRevenue / paidSales.length : 0;

  // Sales by program
  const salesByProgram = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    filtered.forEach(p => {
      const prog = programMap[p.program_id];
      const name = prog?.name || 'Unknown';
      if (!map[p.program_id]) map[p.program_id] = { name, count: 0, revenue: 0 };
      map[p.program_id].count++;
      if (p.status === 'paid') map[p.program_id].revenue += p.amount_cents;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, programMap]);

  // Sales by category
  const salesByCategory = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    filtered.forEach(p => {
      const prog = programMap[p.program_id];
      const catId = prog?.category_id;
      const catName = catId ? (categoryMap[catId] || 'Uncategorized') : 'Uncategorized';
      if (!map[catName]) map[catName] = { name: catName, count: 0, revenue: 0 };
      map[catName].count++;
      if (p.status === 'paid') map[catName].revenue += p.amount_cents;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, programMap, categoryMap]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { month: string; count: number; revenue: number }> = {};
    filtered.forEach(p => {
      const month = format(parseISO(p.created_at), 'yyyy-MM');
      if (!map[month]) map[month] = { month, count: 0, revenue: 0 };
      map[month].count++;
      if (p.status === 'paid') map[month].revenue += p.amount_cents;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      label: format(parseISO(m.month + '-01'), 'MMM yyyy'),
      revenueDollars: m.revenue / 100,
    }));
  }, [filtered]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setProgramFilter('all');
    setCategoryFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const hasFilters = searchTerm || statusFilter !== 'all' || programFilter !== 'all' || categoryFilter !== 'all' || startDate || endDate;

  const downloadCSV = () => {
    const headers = ['Date', 'Name', 'Email', 'Phone', 'Program', 'Category', 'Amount', 'Status', 'Preferred Dates'];
    const rows = filtered.map(p => {
      const prog = programMap[p.program_id];
      const catName = prog?.category_id ? (categoryMap[prog.category_id] || '') : '';
      return [
        format(parseISO(p.created_at), 'yyyy-MM-dd HH:mm'),
        p.full_name,
        p.email,
        p.phone,
        prog?.name || 'Unknown',
        catName,
        formatCurrency(p.amount_cents),
        p.status,
        p.preferred_dates,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-sales-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingPurchases) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">{totalSales}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg. Order Value</p>
                <p className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid / Pending</p>
                <p className="text-2xl font-bold">{paidSales.length} <span className="text-sm font-normal text-muted-foreground">/ {pendingSales.length}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, email, program..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Program</Label>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programs?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1 flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Program */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Program</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByProgram.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={salesByProgram} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Sales by Category (Pie) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={salesByCategory}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, count }) => `${name}: ${count}`}
                  >
                    {salesByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenueDollars" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Table by Program */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sales Breakdown by Program</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Sales</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesByProgram.map((row, i) => {
                const prog = programs?.find(p => p.name === row.name);
                const catName = prog?.category_id ? (categoryMap[prog.category_id] || '—') : '—';
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{catName}</TableCell>
                    <TableCell className="text-center">{row.count}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                );
              })}
              {salesByProgram.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No sales data</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed Purchases Table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">All Purchases ({filtered.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preferred Dates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map(p => {
                  const prog = programMap[p.program_id];
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-sm">{format(parseISO(p.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{prog?.name || 'Unknown'}</TableCell>
                      <TableCell className="font-medium text-sm">{formatCurrency(p.amount_cents)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'paid' ? 'default' : 'secondary'} className={p.status === 'paid' ? 'bg-green-500/10 text-green-700 hover:bg-green-500/20' : ''}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.preferred_dates}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No purchases found</TableCell>
                  </TableRow>
                )}
                {filtered.length > 100 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-2 text-sm">
                      Showing first 100 of {filtered.length} results. Use filters or export CSV for full data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
