import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AdminRoute from "@/routes/AdminRoute";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { CheckCircle, XCircle, Search, Filter, ArrowLeft, Trash2, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AdminHeader from "@/components/admin/AdminHeader";

interface Event {
  id: string;
  title: string;
  starts_at: string;
  venue?: { name: string };
}

interface Attendee {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  confirmation_code: string;
  checked_in_at: string | null;
  qr_code: string | null;
  ticket?: {
    name: string;
  } | null;
  addons?: Array<{
    name: string;
    quantity: number;
  }>;
}

const EventAttendeesPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(eventId || "");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [totalCapacity, setTotalCapacity] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkInFilter, setCheckInFilter] = useState<"all" | "checked-in" | "not-checked-in">("all");
  const [processingCheckIn, setProcessingCheckIn] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attendeeToDelete, setAttendeeToDelete] = useState<Attendee | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Load events for selector
  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, venues:venue_id(name)")
        .order("starts_at", { ascending: true });
      
      setEvents(data || []);
      if (!eventId && data && data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    };
    loadEvents();
  }, [eventId]);

  // Load attendees for selected event
  useEffect(() => {
    if (!selectedEventId) return;

    const loadAttendees = async () => {
      setLoading(true);
      
      try {
        // Fetch attendees via admin edge function (bypasses RLS safely)
        const { data, error } = await supabase.functions.invoke("admin-list-attendees", {
          body: { eventId: selectedEventId },
        });
        if (error) throw error as any;

        const attendeesData = (data?.attendees || []) as any[];
        console.log("Loaded attendees via function:", attendeesData.length);

        // Sort alphabetically by name in JavaScript to handle nulls properly
        const sortedAttendees = attendeesData.sort((a, b) => {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          if (!nameA && !nameB) return 0;
          if (!nameA) return 1;
          if (!nameB) return -1;
          return nameA.localeCompare(nameB);
        });
        
        // Load total capacity for this event
        const { data: ticketsData } = await supabase
          .from("tickets")
          .select("capacity_total")
          .eq("event_id", selectedEventId);
        
        const capacity = ticketsData?.reduce((sum, ticket) => sum + (ticket.capacity_total || 0), 0) || 0;
        
        setAttendees(sortedAttendees as any);
        setTotalCapacity(capacity);
      } catch (error) {
        console.error("Failed to load attendees:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAttendees();
  }, [selectedEventId]);

  const filteredAttendees = useMemo(() => {
    let filtered = attendees;

    // Filter by check-in status
    if (checkInFilter === "checked-in") {
      filtered = filtered.filter(a => a.checked_in_at !== null);
    } else if (checkInFilter === "not-checked-in") {
      filtered = filtered.filter(a => a.checked_in_at === null);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(a =>
        (a.name || "").toLowerCase().includes(query) ||
        (a.email || "").toLowerCase().includes(query) ||
        (a.phone || "").toLowerCase().includes(query) ||
        (a.confirmation_code || "").toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [attendees, searchQuery, checkInFilter]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const checkedInCount = attendees.filter(a => a.checked_in_at !== null).length;
  const totalCount = attendees.length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleManualCheckIn = async (attendeeId: string, isChecked: boolean) => {
    setProcessingCheckIn(prev => ({ ...prev, [attendeeId]: true }));
    
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ 
          checked_in_at: isChecked ? new Date().toISOString() : null 
        })
        .eq('id', attendeeId);
      
      if (error) throw error;
      
      // Update local state
      setAttendees(prev => prev.map(attendee => 
        attendee.id === attendeeId 
          ? { ...attendee, checked_in_at: isChecked ? new Date().toISOString() : null }
          : attendee
      ));
    } catch (error: any) {
      alert(`Failed to update check-in status: ${error.message}`);
    } finally {
      setProcessingCheckIn(prev => ({ ...prev, [attendeeId]: false }));
    }
  };

  const handleDeleteClick = (attendee: Attendee) => {
    setAttendeeToDelete(attendee);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!attendeeToDelete || !selectedEventId) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-attendee', {
        body: { attendeeId: attendeeToDelete.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setDeleteDialogOpen(false);
      setAttendeeToDelete(null);
      
      // Reload attendees to reflect updated counts
      setLoading(true);
      const { data: attendeesData, error: reloadError } = await supabase.functions.invoke("admin-list-attendees", {
        body: { eventId: selectedEventId },
      });
      
      if (reloadError) throw reloadError;
      
      const attendeesList = (attendeesData?.attendees || []) as any[];
      const sortedAttendees = attendeesList.sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB);
      });
      
      setAttendees(sortedAttendees as any);
      setLoading(false);
    } catch (error: any) {
      alert(`Failed to delete attendee: ${error.message}`);
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    // CSV headers
    const headers = ['Name', 'Email', 'Phone', 'Ticket Tier', 'Confirmation Code', 'Check-in Status'];
    
    // CSV rows
    const rows = filteredAttendees.map(attendee => [
      attendee.name || '',
      attendee.email || '',
      attendee.phone || '',
      attendee.ticket?.name || 'N/A',
      attendee.confirmation_code,
      attendee.checked_in_at ? 'Checked In' : 'Pending'
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const eventDate = selectedEvent?.starts_at ? new Date(selectedEvent.starts_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const fileName = `attendees-${selectedEvent?.title || 'event'}-${eventDate}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && selectedEventId) {
    return (
      <AdminRoute>
        <div className="container mx-auto py-10">
          <div className="text-center">Loading attendees...</div>
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-6 px-4 space-y-6">
        <Helmet>
          <title>Event Attendees | Admin Dashboard</title>
          <meta name="description" content="Manage event attendees and check-in status" />
          <link rel="canonical" href={`${baseUrl}/admin/events/${selectedEventId}/attendees`} />
        </Helmet>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Event Attendees</h1>
          <p className="text-muted-foreground">Manage attendees and check-in status</p>
        </header>

        {/* Event Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Event</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an event..." />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{event.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(event.starts_at)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedEventId && (
          <>
            {/* Stats Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{totalCount}</div>
                    <div className="text-sm text-muted-foreground">Total Attendees</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{totalCount}/{totalCapacity}</div>
                    <div className="text-sm text-muted-foreground">Tickets Sold</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{checkedInCount}</div>
                    <div className="text-sm text-muted-foreground">Checked In</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{totalCount - checkedInCount}</div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Check-in Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, phone, or confirmation code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="md:w-48">
                    <Select value={checkInFilter} onValueChange={(value: any) => setCheckInFilter(value)}>
                      <SelectTrigger>
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Attendees</SelectItem>
                        <SelectItem value="checked-in">Checked In</SelectItem>
                        <SelectItem value="not-checked-in">Not Checked In</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleDownloadCSV} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Attendees List */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Attendees ({filteredAttendees.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredAttendees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery || checkInFilter !== "all" 
                      ? "No attendees match your filters" 
                      : "No attendees found for this event"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isMobile ? (
                      // Mobile view - card layout
                      filteredAttendees.map((attendee) => (
                        <div key={attendee.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">{attendee.name || "No name"}</h3>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`checkin-mobile-${attendee.id}`}
                                  checked={!!attendee.checked_in_at}
                                  onCheckedChange={(checked) => handleManualCheckIn(attendee.id, !!checked)}
                                  disabled={processingCheckIn[attendee.id]}
                                />
                                <label 
                                  htmlFor={`checkin-mobile-${attendee.id}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  Check-in
                                </label>
                              </div>
                              <Badge variant={attendee.checked_in_at ? "default" : "secondary"} className="flex items-center gap-1">
                                {attendee.checked_in_at ? (
                                  <>
                                    <CheckCircle className="h-3 w-3" />
                                    Checked In
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3" />
                                    Pending
                                  </>
                                )}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(attendee)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="font-mono">{attendee.confirmation_code}</div>
                            {attendee.ticket && (
                              <div className="font-medium text-foreground">
                                🎫 {attendee.ticket.name}
                              </div>
                            )}
                            {attendee.addons && attendee.addons.length > 0 && (
                              <div className="text-foreground">
                                ➕ {attendee.addons.map(a => `${a.name} (x${a.quantity})`).join(", ")}
                              </div>
                            )}
                            {attendee.checked_in_at && (
                              <div className="text-xs">
                                Checked in: {new Date(attendee.checked_in_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Desktop view - table layout
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pb-3 font-medium">Check-in</th>
                              <th className="pb-3 font-medium">Status</th>
                              <th className="pb-3 font-medium">Name</th>
                              <th className="pb-3 font-medium">Email</th>
                              <th className="pb-3 font-medium">Phone</th>
                              <th className="pb-3 font-medium">Ticket Tier</th>
                              <th className="pb-3 font-medium">Add-ons</th>
                              <th className="pb-3 font-medium">Confirmation</th>
                              <th className="pb-3 font-medium">Check-in Time</th>
                              <th className="pb-3 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAttendees.map((attendee) => (
                              <tr key={attendee.id} className="border-b">
                                <td className="py-3">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`checkin-${attendee.id}`}
                                      checked={!!attendee.checked_in_at}
                                      onCheckedChange={(checked) => handleManualCheckIn(attendee.id, !!checked)}
                                      disabled={processingCheckIn[attendee.id]}
                                    />
                                    <label 
                                      htmlFor={`checkin-${attendee.id}`}
                                      className="text-sm cursor-pointer"
                                    >
                                      {processingCheckIn[attendee.id] ? 'Processing...' : 'Check-in'}
                                    </label>
                                  </div>
                                </td>
                                <td className="py-3">
                                  <Badge variant={attendee.checked_in_at ? "default" : "secondary"} className="flex items-center gap-1 w-fit">
                                    {attendee.checked_in_at ? (
                                      <>
                                        <CheckCircle className="h-3 w-3" />
                                        {attendee.checked_in_at.includes('T') && !attendee.qr_code ? 'Manual Checked In' : 'Checked In'}
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="h-3 w-3" />
                                        Pending
                                      </>
                                    )}
                                  </Badge>
                                </td>
                                <td className="py-3">{attendee.name || "-"}</td>
                                <td className="py-3 text-sm">{attendee.email || "-"}</td>
                                <td className="py-3 text-sm">{attendee.phone || "-"}</td>
                                <td className="py-3">
                                  {attendee.ticket ? (
                                    <Badge variant="outline" className="text-sm">
                                      {attendee.ticket.name}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </td>
                                <td className="py-3">
                                  {attendee.addons && attendee.addons.length > 0 ? (
                                    <div className="text-sm space-y-1">
                                      {attendee.addons.map((addon, idx) => (
                                        <div key={idx}>
                                          {addon.name} (x{addon.quantity})
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </td>
                                <td className="py-3">
                                  <code className="bg-muted px-2 py-1 rounded text-sm">
                                    {attendee.confirmation_code}
                                  </code>
                                </td>
                                <td className="py-3 text-sm">
                                  {attendee.checked_in_at 
                                    ? new Date(attendee.checked_in_at).toLocaleString() 
                                    : "-"}
                                </td>
                                <td className="py-3">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClick(attendee)}
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Attendee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {attendeeToDelete?.name || "this attendee"}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AdminRoute>
  );
};

export default EventAttendeesPage;