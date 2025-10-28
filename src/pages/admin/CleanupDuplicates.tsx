import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2, AlertTriangle } from "lucide-react";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
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

interface DuplicateAttendee {
  event_id: string;
  event_title: string;
  email: string;
  paid_count: number;
  comped_count: number;
  comped_attendee_ids: string[];
  attendee_names: string[];
}

const CleanupDuplicates = () => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [duplicates, setDuplicates] = useState<DuplicateAttendee[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const fetchDuplicates = async () => {
    try {
      setIsLoading(true);

      // Find attendees with both paid and comped tickets
      const { data: attendeesData, error } = await supabase.functions.invoke(
        'admin-list-attendees',
        { body: { eventId: 'all' } }
      );

      if (error) throw error;

      // Get all events to group by
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, starts_at')
        .order('starts_at', { ascending: true });

      if (!eventsData) throw new Error('No events found');

      // Process duplicates by event and email
      const duplicateMap = new Map<string, DuplicateAttendee>();

      for (const event of eventsData) {
        // Filter attendees for this event
        const { data: attendeesResponse, error: attendeesError } = await supabase.functions.invoke(
          'admin-list-attendees',
          { body: { eventId: event.id } }
        );

        if (attendeesError || !attendeesResponse?.attendees) continue;

        const attendees = attendeesResponse.attendees;

        // Group by email (case-insensitive)
        const emailMap = new Map<string, any[]>();
        for (const attendee of attendees) {
          if (!attendee.email) continue;
          const emailKey = attendee.email.toLowerCase();
          const list = emailMap.get(emailKey) || [];
          list.push(attendee);
          emailMap.set(emailKey, list);
        }

        // Find duplicates (paid + comped for same email)
        for (const [email, group] of emailMap.entries()) {
          const paid = group.filter(a => !a.is_comped && a.order_item_id);
          const comped = group.filter(a => a.is_comped);

          if (paid.length > 0 && comped.length > 0) {
            const key = `${event.id}-${email}`;
            duplicateMap.set(key, {
              event_id: event.id,
              event_title: event.title,
              email,
              paid_count: paid.length,
              comped_count: comped.length,
              comped_attendee_ids: comped.map(a => a.id),
              attendee_names: group.map(a => a.name || 'No name').filter((v, i, arr) => arr.indexOf(v) === i)
            });
          }
        }
      }

      setDuplicates(Array.from(duplicateMap.values()));
    } catch (error: any) {
      console.error('Error fetching duplicates:', error);
      toast.error('Failed to load duplicates');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAll = (duplicate: DuplicateAttendee) => {
    const newSelected = new Set(selectedIds);
    const allSelected = duplicate.comped_attendee_ids.every(id => selectedIds.has(id));

    if (allSelected) {
      duplicate.comped_attendee_ids.forEach(id => newSelected.delete(id));
    } else {
      duplicate.comped_attendee_ids.forEach(id => newSelected.add(id));
    }

    setSelectedIds(newSelected);
  };

  const toggleSingle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (selectedIds.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      setDeleting(true);
      const idsToDelete = Array.from(selectedIds);

      // Delete attendees
      const { error } = await supabase
        .from('attendees')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast.success(`Deleted ${idsToDelete.length} comped ticket(s)`);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      
      // Refresh list
      await fetchDuplicates();
    } catch (error: any) {
      console.error('Error deleting duplicates:', error);
      toast.error('Failed to delete tickets');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminRoute>
        <AdminHeader />
        <main className="container mx-auto py-8 px-4">
          <div className="text-center">Loading duplicates...</div>
        </main>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-8 px-4 space-y-6">
        <Helmet>
          <title>Cleanup Duplicate Tickets | Admin Dashboard</title>
          <meta name="description" content="Remove duplicate comped tickets for attendees with paid tickets" />
          <link rel="canonical" href={`${baseUrl}/admin/cleanup-duplicates`} />
        </Helmet>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/events">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Link>
          </Button>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            Cleanup Duplicate Tickets
          </h1>
          <p className="text-muted-foreground">
            Remove comped tickets for attendees who already have paid tickets for the same event
          </p>
        </header>

        {duplicates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg font-medium text-green-600">No duplicates found!</p>
              <p className="text-sm text-muted-foreground mt-2">
                All attendees have unique tickets per event
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Found {duplicates.length} duplicate(s) across events
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {selectedIds.size} selected
                    </Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedIds.size === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {duplicates.map((dup, idx) => {
                  const allSelected = dup.comped_attendee_ids.every(id => selectedIds.has(id));
                  const someSelected = dup.comped_attendee_ids.some(id => selectedIds.has(id));

                  return (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{dup.event_title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {dup.attendee_names.join(', ')} ({dup.email})
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="default" className="bg-blue-500">
                              {dup.paid_count} Paid
                            </Badge>
                            <Badge variant="outline" className="border-orange-500 text-orange-700">
                              {dup.comped_count} Comped (duplicate{dup.comped_count > 1 ? 's' : ''})
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`select-all-${idx}`}
                            checked={allSelected}
                            ref={(el) => {
                              if (el) {
                                (el as any).indeterminate = someSelected && !allSelected;
                              }
                            }}
                            onCheckedChange={() => toggleAll(dup)}
                          />
                          <label
                            htmlFor={`select-all-${idx}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            Select all comped
                          </label>
                        </div>
                      </div>

                      <div className="ml-6 space-y-2 text-sm">
                        {dup.comped_attendee_ids.map((id, i) => (
                          <div key={id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`attendee-${id}`}
                              checked={selectedIds.has(id)}
                              onCheckedChange={() => toggleSingle(id)}
                            />
                            <label
                              htmlFor={`attendee-${id}`}
                              className="cursor-pointer text-muted-foreground"
                            >
                              Comped ticket #{i + 1}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-900">Important</p>
                    <p className="text-orange-800 mt-1">
                      This tool removes comped tickets for attendees who already have paid tickets.
                      The paid tickets will remain. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} comped ticket(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the selected comped tickets. The attendees will still have
                their paid tickets. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete Comped Tickets'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AdminRoute>
  );
};

export default CleanupDuplicates;
