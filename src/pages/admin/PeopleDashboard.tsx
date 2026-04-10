import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { SendEmailDialog } from "@/components/admin/SendEmailDialog";
import {
  Download,
  Filter,
  LinkIcon,
  Loader2,
  Mail,
  NotebookPen,
  Search,
  Calendar as CalendarIcon,
  PhoneCall,
} from "lucide-react";

type RecordType = "event" | "training";

interface PersonMeta {
  eventTitle?: string | null;
  eventDate?: string | null;
  preferredDates?: string | null;
}

interface PeopleRecord {
  id: string;
  recordType: RecordType;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  productId: string | null;
  productName: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  stripeSessionId: string | null;
  confirmationCode: string | null;
  internalNotes: string | null;
  notesUpdatedAt: string | null;
  meta?: PersonMeta;
}

interface Summary {
  totalRecords: number;
  eventRecords: number;
  trainingRecords: number;
  paidCount: number;
  pendingCount: number;
  revenueCents: number;
}

interface ProductsResponse {
  events: { id: string; title: string; starts_at: string | null }[];
  trainings: { id: string; name: string; active: boolean }[];
}

interface DashboardResponse {
  records: PeopleRecord[];
  products?: ProductsResponse;
  pagination: PaginationState;
}

interface NotesUpdateResponse {
  ok: boolean;
  notesUpdatedAt?: string | null;
}

interface PaginationState {
  page: number;
  pageSize: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

const defaultSummary: Summary = {
  totalRecords: 0,
  eventRecords: 0,
  trainingRecords: 0,
  paidCount: 0,
  pendingCount: 0,
  revenueCents: 0,
};

const defaultPagination: PaginationState = {
  page: 1,
  pageSize: 25,
  hasPrevPage: false,
  hasNextPage: false,
};

const currencyFormatter = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatCurrency = (cents: number) => currencyFormatter.format((cents || 0) / 100);

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
};

const normalizePhoneForSms = (phone?: string | null) => {
  if (!phone) return null;
  const sanitized = phone.replace(/[^+\d]/g, "");
  return sanitized || null;
};

const formatDateBoundary = (value?: string, endOfDay = false) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
};

const statusLabel = (status?: string) => {
  if (!status) return "Pending";
  const normalized = status.toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "pending") return "Pending";
  if (normalized === "refunded") return "Refunded";
  return status;
};

const formatPreferredDates = (meta?: PersonMeta) => {
  if (!meta?.preferredDates) return null;
  return String(meta.preferredDates)
    .split(",")
    .map((part: string) => part.trim())
    .filter(Boolean)
    .join(" · ");
};

const createSmsHref = (record: PeopleRecord) => {
  const normalized = normalizePhoneForSms(record.phone);
  if (!normalized) return null;
  const greeting = record.fullName ? `Hi ${record.fullName}` : "Hi there";
  const body = `${greeting}, we’re following up about your ${record.productName} purchase.`;
  return `sms:${normalized}?&body=${encodeURIComponent(body)}`;
};

const friendlyErrorMessage = (message?: string | null) => {
  if (!message) return "Something went wrong. Please try again.";
  if (message.includes("Failed to send a request to the Edge Function")) {
    return "Couldn’t reach the Supabase Edge Function. Be sure the new functions are deployed and your local env keys are set.";
  }
  return message;
};

const PeopleDashboard = () => {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [people, setPeople] = useState<PeopleRecord[]>([]);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [products, setProducts] = useState<ProductsResponse>({ events: [], trainings: [] });
  const [pagination, setPagination] = useState<PaginationState>(defaultPagination);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productKey, setProductKey] = useState("all");
  const [productFilterType, setProductFilterType] = useState<RecordType | null>(null);
  const [productFilterId, setProductFilterId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PeopleRecord | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailContext, setEmailContext] = useState<{ email: string; name: string | null } | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (selectedPerson) {
      setNotesValue(selectedPerson.internalNotes || "");
    }
  }, [selectedPerson]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      includeCatalog: !catalogLoaded,
    };

    if (debouncedSearch) payload.search = debouncedSearch;
    const fromIso = formatDateBoundary(dateFrom, false);
    const toIso = formatDateBoundary(dateTo, true);
    if (fromIso) payload.dateFrom = fromIso;
    if (toIso) payload.dateTo = toIso;
    if (productFilterId && productFilterType) {
      payload.productId = productFilterId;
      payload.productType = productFilterType;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke<DashboardResponse>(
        "admin-list-customers",
        { body: payload },
      );

      if (fnError) throw fnError;
      if (!data) throw new Error("No data returned from admin-list-customers");

      setPeople(data.records || []);
      setSummary({
        totalRecords: data.records?.length || 0,
        eventRecords: (data.records || []).filter((record) => record.recordType === "event").length,
        trainingRecords: (data.records || []).filter((record) => record.recordType === "training").length,
        paidCount: (data.records || []).filter((record) => (record.status || "").toLowerCase() === "paid").length,
        pendingCount: (data.records || []).filter((record) => (record.status || "").toLowerCase() !== "paid").length,
        revenueCents: (data.records || [])
          .filter((record) => (record.status || "").toLowerCase() === "paid")
          .reduce((sum, record) => sum + (record.amountCents || 0), 0),
      });
      setPagination(data.pagination || defaultPagination);

      if (data.products && !catalogLoaded) {
        setProducts(data.products);
        setCatalogLoaded(true);
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const friendly = friendlyErrorMessage(rawMessage);
      console.error("Failed to load people dashboard", err);
      setError(friendly);
      toast({
        title: "Failed to load data",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [
    catalogLoaded,
    dateFrom,
    dateTo,
    debouncedSearch,
    pagination.page,
    pagination.pageSize,
    productFilterId,
    productFilterType,
    toast,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtersActive = useMemo(() => {
    return Boolean(
      debouncedSearch || dateFrom || dateTo || (productFilterId && productFilterType),
    );
  }, [debouncedSearch, dateFrom, dateTo, productFilterId, productFilterType]);

  const resetFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setProductKey("all");
    setProductFilterId(null);
    setProductFilterType(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleProductChange = (value: string) => {
    setProductKey(value);
    if (value === "all") {
      setProductFilterId(null);
      setProductFilterType(null);
      setPagination((prev) => ({ ...prev, page: 1 }));
      return;
    }

    const [type, id] = value.split(":");
    if (type && id) {
      setProductFilterType(type === "training" ? "training" : "event");
      setProductFilterId(id);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  };

  const handleOpenDetails = (record: PeopleRecord) => {
    setSelectedPerson(record);
    setDetailsOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedPerson) return;

    setSavingNotes(true);
    try {
      const payload = {
        recordId: selectedPerson.id,
        recordType: selectedPerson.recordType,
        internalNotes: notesValue.trim() ? notesValue.trim() : null,
      };

      const { data, error: fnError } = await supabase.functions.invoke<NotesUpdateResponse>("admin-update-person-notes", {
        body: payload,
      });

      if (fnError) throw fnError;
      const notesUpdatedAt = data?.notesUpdatedAt || new Date().toISOString();

      setPeople((prev) =>
        prev.map((record) =>
          record.id === selectedPerson.id && record.recordType === selectedPerson.recordType
            ? { ...record, internalNotes: payload.internalNotes, notesUpdatedAt }
            : record,
        ),
      );

      setSelectedPerson((prev) => (
        prev
          ? {
              ...prev,
              internalNotes: payload.internalNotes || null,
              notesUpdatedAt,
            }
          : prev
      ));

      toast({
        title: "Notes updated",
        description: "Internal notes were saved successfully.",
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to save notes", err);
      toast({
        title: "Could not save notes",
        description: errorMessage || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleOpenEmail = (record: PeopleRecord) => {
    if (!record.email) return;
    setEmailContext({ email: record.email, name: record.fullName });
    setEmailDialogOpen(true);
  };

  const downloadCsv = () => {
    if (!people.length) return;
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Product",
      "Type",
      "Amount",
      "Status",
      "Paid",
      "Code",
      "Stripe Session",
      "Notes",
    ];

    const rows = people.map((record) => [
      record.fullName || "",
      record.email || "",
      record.phone || "",
      record.productName,
      record.recordType,
      formatCurrency(record.amountCents),
      statusLabel(record.status),
      formatDisplayDate(record.paidAt || record.createdAt),
      record.confirmationCode || "",
      record.stripeSessionId || "",
      record.internalNotes ? record.internalNotes.replace(/"/g, "''") : "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((cols) => cols.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `people-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderContactCell = (record: PeopleRecord) => {
    const smsHref = createSmsHref(record);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleOpenEmail(record)}
            disabled={!record.email}
            title={record.email ? `Email ${record.email}` : "No email"}
            className="h-8 w-8"
          >
            {record.email ? <Mail className="h-4 w-4" /> : <Mail className="h-4 w-4 opacity-30" />}
          </Button>
          {smsHref ? (
            <a
              href={smsHref}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dashed text-muted-foreground transition hover:border-primary/60 hover:text-primary"
              title={`Send SMS to ${record.phone}`}
            >
              <PhoneCall className="h-4 w-4" />
            </a>
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground/50">
              <PhoneCall className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          {record.email && <p className="truncate">{record.email}</p>}
          {record.phone && (
            <p className="truncate">
              <span className="font-medium text-foreground">Phone:</span> {record.phone}
            </p>
          )}
        </div>
      </div>
    );
  };

  const heroBadge = `${summary.totalRecords} records on this page · ${summary.paidCount} paid`;

  const renderNotesPreview = (record: PeopleRecord) => {
    if (!record.internalNotes) {
      return <span className="text-muted-foreground text-xs italic">No notes yet</span>;
    }
    return (
      <div className="space-y-1">
        <span className="text-sm line-clamp-2">{record.internalNotes}</span>
        {record.notesUpdatedAt && (
          <p className="text-[11px] text-muted-foreground">Updated {formatDisplayDate(record.notesUpdatedAt)}</p>
        )}
      </div>
    );
  };

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto px-4 py-6 md:py-10 space-y-6 md:space-y-8">
        <Helmet>
          <title>People Dashboard | Admin</title>
          <meta
            name="description"
            content="Central hub for customers across events, trainings, and future products."
          />
          <link rel="canonical" href={`${baseUrl}/admin/people`} />
        </Helmet>

        <section className="rounded-2xl border border-border/60 bg-white/90 p-5 md:p-6 flex flex-col gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">People ops</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">People management workspace</h1>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Search, filter, and contact everyone who has paid through Stripe across events, trainings, and future products—all in one practical view. Most recent purchases appear first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <span className="rounded-full border border-border/70 bg-white px-3 py-1 font-medium text-foreground/80">
              {heroBadge}
            </span>
            <span className="rounded-full border border-border/70 bg-white px-3 py-1 font-medium text-foreground/80">
              {formatCurrency(summary.revenueCents)} in this view
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 bg-white/90 p-4 md:p-5 space-y-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                placeholder="Search by name, email, phone, or payment code"
                className="pl-9 h-11"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="h-11"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="h-11"
              />
              <Select value={productKey} onValueChange={handleProductChange}>
                <SelectTrigger className="h-11 min-w-[220px]">
                  <SelectValue placeholder="Filter by product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.events.length > 0 && (
                    <div className="px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground">Events</div>
                  )}
                  {products.events.map((event) => (
                    <SelectItem key={`event-${event.id}`} value={`event:${event.id}`}>
                      {event.title || "Untitled event"}
                    </SelectItem>
                  ))}
                  {products.trainings.length > 0 && (
                    <div className="px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground">Trainings</div>
                  )}
                  {products.trainings.map((program) => (
                    <SelectItem key={`training-${program.id}`} value={`training:${program.id}`}>
                      {program.name || "Training"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={downloadCsv} disabled={!people.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {filtersActive && (
              <Button type="button" size="sm" variant="ghost" className="h-9" onClick={resetFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Reset filters
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-amber-900/20 bg-white/80 p-4 md:p-6">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-lg font-semibold text-amber-900">We couldn’t load the data</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={fetchData}>
                Try again
              </Button>
            </div>
          ) : people.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <NotebookPen className="h-10 w-10 mx-auto text-amber-400" />
              <p className="text-lg font-semibold">No people match your filters</p>
              <p className="text-sm text-muted-foreground">Adjust the criteria or clear the filters.</p>
              {filtersActive && (
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              )}
            </div>
          ) : isMobile ? (
            <div className="space-y-4">
              {people.map((record) => (
                <div key={`${record.recordType}-${record.id}`} className="rounded-2xl border border-amber-900/20 bg-white/95 p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold leading-tight">{record.fullName || "No name"}</p>
                      <p className="text-[11px] text-muted-foreground">{record.productName}</p>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      {statusLabel(record.status)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Amount:</span> {formatCurrency(record.amountCents)}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Paid:</span> {formatDisplayDate(record.paidAt || record.createdAt)}
                    </p>
                    {record.confirmationCode && (
                      <p className="col-span-2">
                        <span className="font-medium text-foreground">Code:</span> {record.confirmationCode}
                      </p>
                    )}
                    {record.stripeSessionId && (
                      <p className="col-span-2 break-all">
                        <span className="font-medium text-foreground">Stripe:</span> {record.stripeSessionId}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {renderContactCell(record)}
                    <Button variant="outline" size="sm" className="ml-auto" onClick={() => handleOpenDetails(record)}>
                      View details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead className="min-w-[180px]">Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((record) => (
                    <TableRow key={`${record.recordType}-${record.id}`} className="hover:bg-amber-50/40">
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-base font-semibold">{record.fullName || "No name"}</p>
                          <p className="text-xs text-muted-foreground">{record.email || record.phone || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{record.productName}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">{record.recordType}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(record.amountCents)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {statusLabel(record.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDisplayDate(record.paidAt || record.createdAt)}
                        </div>
                        {record.confirmationCode && (
                          <p className="text-xs text-muted-foreground">Code: {record.confirmationCode}</p>
                        )}
                      </TableCell>
                      <TableCell>{renderContactCell(record)}</TableCell>
                      <TableCell>{renderNotesPreview(record)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenDetails(record)}>
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && !error && people.length > 0 && (
            <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} · {people.length} records shown
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rows</span>
                  <Select
                    value={String(pagination.pageSize)}
                    onValueChange={(value) => {
                      const nextSize = Number(value) || 25;
                      setPagination({ page: 1, pageSize: nextSize, hasPrevPage: false, hasNextPage: false });
                    }}
                  >
                    <SelectTrigger className="h-8 w-[84px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!pagination.hasPrevPage || loading}
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!pagination.hasNextPage || loading}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Person details</DialogTitle>
              <DialogDescription>
                Full payment context plus internal follow-up tools.
              </DialogDescription>
            </DialogHeader>
            {selectedPerson && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Name</p>
                    <p className="text-lg font-semibold">{selectedPerson.fullName || "No name"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Product</p>
                    <p className="text-sm font-medium">{selectedPerson.productName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedPerson.recordType}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Amount</p>
                    <p className="text-base font-semibold">{formatCurrency(selectedPerson.amountCents)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
                    <Badge variant="outline" className="capitalize w-fit">
                      {statusLabel(selectedPerson.status)}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{formatDisplayDate(selectedPerson.paidAt || selectedPerson.createdAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {selectedPerson.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" /> {selectedPerson.email}
                    </p>
                  )}
                  {selectedPerson.phone && (
                    <p className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-muted-foreground" />
                      {createSmsHref(selectedPerson) ? (
                        <a href={createSmsHref(selectedPerson) || "#"} className="text-primary hover:underline">
                          {selectedPerson.phone}
                        </a>
                      ) : (
                        selectedPerson.phone
                      )}
                    </p>
                  )}
                  {selectedPerson.stripeSessionId && (
                    <p className="col-span-2 break-all flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      {selectedPerson.stripeSessionId}
                    </p>
                  )}
                  {selectedPerson.confirmationCode && (
                    <p className="flex items-center gap-2">
                      <NotebookPen className="h-4 w-4 text-muted-foreground" />
                      Code: {selectedPerson.confirmationCode}
                    </p>
                  )}
                  {formatPreferredDates(selectedPerson.meta) && (
                    <p className="col-span-2 text-muted-foreground">
                      <CalendarIcon className="inline h-4 w-4 mr-1" />
                      Preferred dates: {formatPreferredDates(selectedPerson.meta)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Internal notes</p>
                    {selectedPerson.internalNotes && (
                      <Badge variant="secondary" className="text-[11px]">
                        {selectedPerson.notesUpdatedAt
                          ? `Saved ${formatDisplayDate(selectedPerson.notesUpdatedAt)}`
                          : "Saved"}
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    rows={5}
                    placeholder="Add follow-up context for the team..."
                    value={notesValue}
                    onChange={(event) => setNotesValue(event.target.value)}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={handleSaveNotes} disabled={savingNotes}>
                      {savingNotes ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <NotebookPen className="h-4 w-4 mr-2" />}
                      Save notes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {emailContext && (
          <SendEmailDialog
            open={emailDialogOpen}
            onOpenChange={(open) => {
              setEmailDialogOpen(open);
              if (!open) {
                setEmailContext(null);
              }
            }}
            recipientEmail={emailContext.email}
            recipientName={emailContext.name}
          />
        )}
      </main>
    </AdminRoute>
  );
};

export default PeopleDashboard;
