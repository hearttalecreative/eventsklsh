import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AdminRoute from "@/routes/AdminRoute";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import VenueCreateDialog from "@/components/admin/VenueCreateDialog";
import GoogleMapPicker from "@/components/GoogleMapPicker";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation, Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import RichMarkdownEditor from "@/components/RichMarkdownEditor";
import { Megaphone, Edit3, Ticket, Package, Users, Eye, Trash2, Copy, ChevronUp, ChevronDown, StickyNote, ChevronDown as ChevronDownIcon, Archive, Search, Check } from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/components/admin/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface Venue { id: string; name: string; address?: string | null; }

const logAdmin = async (action: string, entity_type?: string, entity_id?: string, details?: any) => {
  const { data: session } = await supabase.auth.getSession();
  const user_id = session.session?.user?.id || null;
  await supabase.from('admin_activity_logs').insert({ user_id, action, entity_type, entity_id, details });
};

const AdminEvents = () => {
  const isMobile = useIsMobile();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, { ticketsSold: number; totalCapacity: number }>>({});
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Add-ons editor state
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [addonsEventId, setAddonsEventId] = useState<string | null>(null);
  const [addons, setAddons] = useState<any[]>([]);
  const [savingAddons, setSavingAddons] = useState(false);

  // Tickets editor state
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [ticketsEventId, setTicketsEventId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);

  // Remove attendees modal - now handled by separate page
  const [manageEventId, setManageEventId] = useState<string | undefined>(undefined);

  // Form state for quick create
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [instructions, setInstructions] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venueId, setVenueId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState("draft");
  const [timezone, setTimezone] = useState('America/Los_Angeles');

  // External ticket sales state for creation
  const [externalTicketSales, setExternalTicketSales] = useState(false);
  const [externalTicketUrl, setExternalTicketUrl] = useState('');
  const [externalTicketButtonText, setExternalTicketButtonText] = useState('Get Tickets');

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Duplicate event dialog state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicatingEvent, setDuplicatingEvent] = useState<any | null>(null);
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTitle, setNewEventTitle] = useState("");

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any | null>(null);

  // Sorting and filters for events table
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all'); // 'all' | '1'..'12'
  const [filterYear, setFilterYear] = useState<string>('all');   // 'all' | '2025' etc
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedMobileEventId, setExpandedMobileEventId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [workspaceTab, setWorkspaceTab] = useState<'create' | 'manage' | 'list'>('create');
  const [ticketQuery, setTicketQuery] = useState("");
  const [addonQuery, setAddonQuery] = useState("");
  const [lastSaved, setLastSaved] = useState<{ kind: "ticket" | "addon"; id: string; at: number } | null>(null);
  const [previewEmailByTicket, setPreviewEmailByTicket] = useState<Record<string, string>>({});
  const [previewSendingByTicket, setPreviewSendingByTicket] = useState<Record<string, boolean>>({});


  // Edit event dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eShort, setEShort] = useState('');
  const [eLong, setELong] = useState('');
  const [eInstructions, setEInstructions] = useState('');
  const [eStarts, setEStarts] = useState('');
  const [eEnds, setEEnds] = useState('');
  const [eVenueId, setEVenueId] = useState<string | undefined>(undefined);
  const [eStatus, setEStatus] = useState('draft');
  const [eImageUrl, setEImageUrl] = useState('');
  const [eImageFile, setEImageFile] = useState<File | null>(null);
  const [eTimezone, setETimezone] = useState('America/Los_Angeles');
  const [eHidden, setEHidden] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [eImagePreview, setEImagePreview] = useState<string | null>(null);

  // External ticket sales state
  const [eExternalTicketSales, setEExternalTicketSales] = useState(false);
  const [eExternalTicketUrl, setEExternalTicketUrl] = useState('');
  const [eExternalTicketButtonText, setEExternalTicketButtonText] = useState('Get Tickets');

  // Venue create dialog state
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);

  // Venue edit dialog state
  const [venueEditOpen, setVenueEditOpen] = useState(false);
  const [venueEditing, setVenueEditing] = useState<Venue | null>(null);
  const [vName, setVName] = useState("");
  const [vAddress, setVAddress] = useState("");

  const location = useLocation();
  const openedFromParamRef = useRef(false);
  const handleVenueCreated = (venue: Venue) => {
    setVenues((arr) => [...arr, venue]);
    setVenueId(venue.id);
    logAdmin('venue_created', 'venue', venue.id, { name: venue.name });
  };

  // Load events with server-side pagination
  const loadEvents = async (page: number, filters: { tab: string; search: string; month: string; year: string }) => {
    setLoading(true);

    // Build query
    let query = supabase
      .from("events")
      .select("*, venues:venue_id(name)", { count: 'exact' });

    // Apply status filter
    if (filters.tab === 'archived') {
      query = query.eq('status', 'archived');
    } else {
      query = query.neq('status', 'archived');
    }

    // Apply search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      query = query.or(`title.ilike.%${searchTerm}%`);
    }

    // Apply month/year filters
    if (filters.month !== 'all') {
      const monthNum = parseInt(filters.month);
      query = query.gte('starts_at', `${filters.year !== 'all' ? filters.year : new Date().getFullYear()}-${String(monthNum).padStart(2, '0')}-01`)
        .lt('starts_at', `${filters.year !== 'all' ? filters.year : new Date().getFullYear()}-${String(monthNum + 1).padStart(2, '0')}-01`);
    } else if (filters.year !== 'all') {
      query = query.gte('starts_at', `${filters.year}-01-01`)
        .lt('starts_at', `${parseInt(filters.year) + 1}-01-01`);
    }

    // Order by starts_at ascending (upcoming events first)
    query = query.order('starts_at', { ascending: true });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: ev, error, count } = await query;

    if (error) {
      console.error('Error loading events:', error);
      setLoading(false);
      return;
    }

    setEvents(ev || []);
    setTotalCount(count || 0);
    setManageEventId(ev && ev.length ? ev[0].id : undefined);

    // Load tickets sold stats for the current page
    if (ev && ev.length > 0) {
      const eventIds = ev.map(e => e.id);

      const { data: attendeeCounts } = await supabase
        .from("attendees")
        .select("event_id")
        .in("event_id", eventIds);

      const { data: ticketCapacities } = await supabase
        .from("tickets")
        .select("event_id, capacity_total")
        .in("event_id", eventIds);

      const stats: Record<string, { ticketsSold: number; totalCapacity: number }> = {};
      eventIds.forEach(eventId => {
        const ticketsSold = attendeeCounts?.filter(a => a.event_id === eventId).length || 0;
        const totalCapacity = ticketCapacities
          ?.filter(t => t.event_id === eventId)
          .reduce((sum, t) => sum + (t.capacity_total || 0), 0) || 0;

        stats[eventId] = { ticketsSold, totalCapacity };
      });

      setEventStats(stats);
    }

    setLoading(false);
  };

  // Load venues on mount
  useEffect(() => {
    const load = async () => {
      const { data: v } = await supabase.from("venues").select("id,name,address").order("name");
      setVenues(v || []);
    };
    load();
  }, []);

  // Load events when page or filters change
  useEffect(() => {
    loadEvents(currentPage, {
      tab: activeTab,
      search: searchQuery,
      month: filterMonth,
      year: filterYear
    });
  }, [currentPage, activeTab, searchQuery, filterMonth, filterYear]);

  // Auto-open edit dialog when coming from dashboard with ?edit=<id> (only once)
  useEffect(() => {
    if (openedFromParamRef.current) return;
    if (!loading) {
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit');
      if (editId) {
        const ev = events.find(e => e.id === editId);
        if (ev) {
          openEdit(ev);
        }
      }
      openedFromParamRef.current = true;
    }
  }, [loading, location.search, events]);

  function isEventPast(ev: any) {
    const endOrStart = ev.ends_at ? new Date(ev.ends_at) : new Date(ev.starts_at);
    return endOrStart < new Date();
  }

  // Auto-archive past events function
  const archivePastEvents = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('archive-past-events');
      if (error) throw error;

      toast.success(data.message || 'Past events archived successfully');

      // Reload events
      await loadEvents(currentPage, {
        tab: activeTab,
        search: searchQuery,
        month: filterMonth,
        year: filterYear
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive past events');
    }
  };

  const openEdit = (ev: any) => {
    if (ev.status === 'archived') { alert('You cannot modify an archived event.'); return; }
    setEditingEvent(ev);
    setETitle(ev.title || '');
    setEShort(ev.short_description || '');
    setELong(ev.description || '');
    setEInstructions(ev.instructions || '');

    // Convert UTC datetime to timezone-specific datetime for editing
    const formatDateForInput = (isoString: string, timezone: string) => {
      const utcDate = new Date(isoString);

      // Convert UTC date to the event's timezone
      const zonedDate = toZonedTime(utcDate, timezone);

      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      return format(zonedDate, "yyyy-MM-dd'T'HH:mm");
    };

    const eventTimezone = (ev as any).timezone || 'America/Los_Angeles';
    setEStarts(ev.starts_at ? formatDateForInput(ev.starts_at, eventTimezone) : '');
    setEEnds(ev.ends_at ? formatDateForInput(ev.ends_at, eventTimezone) : '');
    setEVenueId(ev.venue_id || undefined);
    setEStatus(ev.status || 'draft');
    setEImageUrl(ev.image_url || '');
    setEImagePreview(null); // Reset image preview
    setEImageFile(null); // Reset file input
    setETimezone((ev as any).timezone || 'America/Los_Angeles');
    setEHidden(ev.hidden ?? false);
    setEExternalTicketSales(ev.external_ticket_sales ?? false);
    setEExternalTicketUrl(ev.external_ticket_url || '');
    setEExternalTicketButtonText(ev.external_ticket_button_text || 'Get Tickets');
    setEditOpen(true);
  };
  const createVenue = async () => {
    setVenueDialogOpen(true);
  };

  const openVenueEdit = (v: Venue) => {
    setVenueEditing(v);
    setVName(v.name || "");
    setVAddress((v as any).address || "");
    setVenueEditOpen(true);
  };

  const saveVenueEdit = async () => {
    if (!venueEditing) return;
    const { error } = await supabase
      .from('venues')
      .update({ name: vName, address: vAddress || null })
      .eq('id', (venueEditing as any).id);
    if (error) return alert(error.message);
    setVenues(arr => arr.map(v => v.id === (venueEditing as any).id ? { ...v, name: vName, address: vAddress } : v));
    await logAdmin('venue_updated', 'venue', (venueEditing as any).id, { name: vName, address: vAddress });
    setVenueEditOpen(false);
    setVenueEditing(null);
  };
  const createEvent = async () => {
    if (!title || !startsAt) return alert("Title and start are required");
    
    // Validate external ticket sales
    if (externalTicketSales && !externalTicketUrl.trim()) {
      toast.error('External ticket URL is required when external sales is enabled');
      return;
    }
    
    const { data: session } = await supabase.auth.getSession();
    const created_by = session.session?.user?.id || null;

    // Convert timezone-specific datetime to UTC for storage
    const startsAtUTC = convertToUTC(startsAt, timezone);
    const endsAtUTC = endsAt ? convertToUTC(endsAt, timezone) : null;

    // Base payload template
    const base: any = {
      title,
      short_description: shortDesc,
      description: longDesc || null,
      instructions: instructions || null,
      venue_id: venueId || null,
      status: status as any,
      timezone,
      image_url: imageUrl || null,
      created_by,
      external_ticket_sales: externalTicketSales,
      external_ticket_url: externalTicketSales ? externalTicketUrl.trim() : null,
      external_ticket_button_text: externalTicketSales && externalTicketButtonText.trim() ? externalTicketButtonText.trim() : 'Get Tickets',
    };

    try {
      const payload = {
        ...base,
        starts_at: startsAtUTC,
        ends_at: endsAtUTC,
      };
      const { data, error } = await supabase.from("events").insert(payload as any).select("*").single();
      if (error) throw error;
      await logAdmin('event_created', 'event', data!.id, { title });

      // Reset form
      setTitle(""); setShortDesc(""); setLongDesc(""); setInstructions(""); setStartsAt(""); setEndsAt(""); setVenueId(undefined); setStatus("draft"); setTimezone('America/Los_Angeles'); setImageUrl("");
      setExternalTicketSales(false); setExternalTicketUrl(""); setExternalTicketButtonText("Get Tickets");

      // Reload events
      await loadEvents(currentPage, {
        tab: activeTab,
        search: searchQuery,
        month: filterMonth,
        year: filterYear
      });
    } catch (error: any) {
      alert(error.message || 'Failed to create event(s)');
    }
  };
  // Convert timezone-specific datetime to UTC for storage
  const convertToUTC = (localDateString: string, timezone: string): string => {
    if (!localDateString) return localDateString;

    // Parse the datetime and treat it as being in the specified timezone
    const [datePart, timePart] = localDateString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    // Create a date object representing the local time in the timezone
    const zonedDate = new Date(year, month - 1, day, hours, minutes);

    // Convert from the specified timezone to UTC
    const utcDate = fromZonedTime(zonedDate, timezone);

    return utcDate.toISOString();
  };

  const saveEdit = async () => {
    if (!editingEvent) return;

    // Validate external ticket sales
    if (eExternalTicketSales && !eExternalTicketUrl.trim()) {
      toast.error('External ticket URL is required when external sales is enabled');
      return;
    }

    const startsAtUTC = eStarts ? convertToUTC(eStarts, eTimezone) : editingEvent.starts_at;
    const endsAtUTC = eEnds ? convertToUTC(eEnds, eTimezone) : editingEvent.ends_at;

    const payload: any = {
      title: eTitle,
      short_description: eShort,
      description: eLong || null,
      instructions: eInstructions || null,
      starts_at: startsAtUTC,
      ends_at: endsAtUTC,
      venue_id: eVenueId || null,
      status: eStatus as any,
      image_url: eImageUrl || editingEvent.image_url,
      timezone: eTimezone,
      hidden: eHidden,
      external_ticket_sales: eExternalTicketSales,
      external_ticket_url: eExternalTicketSales ? eExternalTicketUrl.trim() : null,
      external_ticket_button_text: eExternalTicketSales && eExternalTicketButtonText.trim() ? eExternalTicketButtonText.trim() : 'Get Tickets',
    };
    const { data, error } = await supabase.from('events').update(payload).eq('id', editingEvent.id).select('*').single();
    if (error) return alert(error.message);
    await logAdmin('event_updated', 'event', editingEvent.id, payload);
    setEditOpen(false);
    setEditingEvent(null);

    // Reload events
    await loadEvents(currentPage, {
      tab: activeTab,
      search: searchQuery,
      month: filterMonth,
      year: filterYear
    });
  };

  const openDuplicate = (event: any) => {
    setDuplicatingEvent(event);
    setNewEventDate("");
    setNewEventTitle(`${event.title} (Copy)`);
    setDuplicateOpen(true);
  };

  const duplicateEvent = async () => {
    if (!duplicatingEvent || !newEventDate || !newEventTitle.trim()) {
      alert('Please provide a title and date for the new event');
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const created_by = session.session?.user?.id || null;

      // Calculate duration from original event
      const originalStart = new Date(duplicatingEvent.starts_at);
      const originalEnd = duplicatingEvent.ends_at ? new Date(duplicatingEvent.ends_at) : null;
      const durationMs = originalEnd ? (originalEnd.getTime() - originalStart.getTime()) : 0;

      // Set new dates
      const newStart = new Date(newEventDate);
      const newEnd = durationMs > 0 ? new Date(newStart.getTime() + durationMs) : null;

      // Create new event with same data but new dates
      const eventPayload: any = {
        title: newEventTitle,
        short_description: duplicatingEvent.short_description,
        description: duplicatingEvent.description,
        instructions: duplicatingEvent.instructions,
        starts_at: newStart.toISOString(),
        ends_at: newEnd ? newEnd.toISOString() : null,
        venue_id: duplicatingEvent.venue_id,
        status: 'draft',
        timezone: duplicatingEvent.timezone,
        image_url: duplicatingEvent.image_url,
        created_by,
      };

      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert(eventPayload)
        .select('*')
        .single();

      if (eventError) throw eventError;

      // Duplicate tickets
      const { data: originalTickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('event_id', duplicatingEvent.id);

      if (originalTickets && originalTickets.length > 0) {
        const ticketsPayload = originalTickets.map(ticket => ({
          event_id: newEvent.id,
          name: ticket.name,
          unit_amount_cents: ticket.unit_amount_cents,
          capacity_total: ticket.capacity_total,
          participants_per_ticket: ticket.participants_per_ticket,
          zone: ticket.zone,
          currency: ticket.currency,
          early_bird_amount_cents: ticket.early_bird_amount_cents,
          early_bird_start: ticket.early_bird_start,
          early_bird_end: ticket.early_bird_end,
          description: ticket.description,
          post_purchase_instructions: ticket.post_purchase_instructions,
        }));

        const { error: ticketsError } = await supabase
          .from('tickets')
          .insert(ticketsPayload);

        if (ticketsError) throw ticketsError;
      }

      // Duplicate addons
      const { data: originalAddons } = await supabase
        .from('addons')
        .select('*')
        .eq('event_id', duplicatingEvent.id);

      if (originalAddons && originalAddons.length > 0) {
        const addonsPayload = originalAddons.map(addon => ({
          event_id: newEvent.id,
          name: addon.name,
          unit_amount_cents: addon.unit_amount_cents,
          description: addon.description,
          max_quantity_per_person: addon.max_quantity_per_person,
        }));

        const { error: addonsError } = await supabase
          .from('addons')
          .insert(addonsPayload);

        if (addonsError) throw addonsError;
      }

      // Refresh events list
      await loadEvents(currentPage, {
        tab: activeTab,
        search: searchQuery,
        month: filterMonth,
        year: filterYear
      });
      await logAdmin('event_duplicated', 'event', newEvent.id, {
        original_event_id: duplicatingEvent.id,
        original_title: duplicatingEvent.title,
        new_date: newEventDate
      });

      setDuplicateOpen(false);
      setDuplicatingEvent(null);
      setNewEventDate("");
      setNewEventTitle("");
      toast.success('Event duplicated successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to duplicate event');
    }
  };

  const openAddons = async (eventId: string) => {
    setTicketsOpen(false);
    setAddonQuery("");
    setAddonsEventId(eventId);
    const { data } = await supabase
      .from("addons")
      .select("id,name,unit_amount_cents,description")
      .eq("event_id", eventId)
      .order("name");
    setAddons(data || []);
    setAddonsOpen(true);
  };

  const addAddon = async () => {
    if (!addonsEventId) return;
    const { data, error } = await supabase
      .from('addons')
      .insert({ event_id: addonsEventId, name: 'New add-on', unit_amount_cents: 500, description: '' })
      .select('id,name,unit_amount_cents,description')
      .single();
    if (error) return alert(error.message);
    setAddons((arr) => [data!, ...arr]);
    await logAdmin('addon_created', 'addon', data!.id, { name: data!.name, event_id: addonsEventId });
  };

  const updateAddonField = async (id: string, patch: Partial<{ name: string; unit_amount_cents: number; max_quantity_per_person: number | null }>) => {
    const { error } = await supabase.from('addons').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.map(a => a.id === id ? { ...a, ...patch } : a));
    setLastSaved({ kind: 'addon', id, at: Date.now() });
    await logAdmin('addon_updated', 'addon', id, patch);
  };

  const deleteAddon = async (id: string) => {
    if (!confirm('Delete this add-on?')) return;
    const { error } = await supabase.from('addons').delete().eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.filter(a => a.id !== id));
    await logAdmin('addon_deleted', 'addon', id);
  };

  const updateAddonDesc = (id: string, description: string) => {
    setAddons((arr) => arr.map((a) => (a.id === id ? { ...a, description } : a)));
  };

  const saveAddonDescriptions = async () => {
    if (!addonsEventId) return;
    setSavingAddons(true);
    try {
      for (const a of addons) {
        await supabase.from("addons").update({ description: a.description ?? null }).eq("id", a.id);
      }
      setAddonsOpen(false);
    } finally {
      setSavingAddons(false);
    }
  };

  // Tickets
  const openTickets = async (eventId: string) => {
    setAddonsOpen(false);
    setTicketQuery("");
    setTicketsEventId(eventId);
    const { data } = await supabase
      .from('tickets')
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,description,post_purchase_instructions,internal_notes,display_order,hidden')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true });
    setTickets(data || []);
    setTicketsOpen(true);
  };

  const addTicketSimple = async () => {
    if (!ticketsEventId) return;
    const maxOrder = Math.max(0, ...tickets.map(t => t.display_order || 0));
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        event_id: ticketsEventId,
        name: 'General',
        unit_amount_cents: 2000,
        capacity_total: 100,
        currency: 'usd',
        participants_per_ticket: 1,
        zone: null,
        display_order: maxOrder + 1
      })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,post_purchase_instructions,internal_notes,display_order')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [...arr, data!].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_created', 'ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
  };

  const addTicketCombo = async () => {
    if (!ticketsEventId) return;
    const maxOrder = Math.max(0, ...tickets.map(t => t.display_order || 0));
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        event_id: ticketsEventId,
        name: 'Combo (2 participants)',
        unit_amount_cents: 3500,
        capacity_total: 100,
        currency: 'usd',
        participants_per_ticket: 2,
        zone: null,
        display_order: maxOrder + 1
      })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,post_purchase_instructions,internal_notes,display_order')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [...arr, data!].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_created', 'ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
  };

  const addTicketByZone = async () => {
    if (!ticketsEventId) return;
    const maxOrder = Math.max(0, ...tickets.map(t => t.display_order || 0));
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        event_id: ticketsEventId,
        name: 'By zone',
        unit_amount_cents: 2500,
        capacity_total: 100,
        currency: 'usd',
        participants_per_ticket: 1,
        zone: 'General',
        display_order: maxOrder + 1
      })
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,post_purchase_instructions,internal_notes,display_order')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [...arr, data!].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_created', 'ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
  };

  const updateTicketField = async (
    id: string,
    patch: Partial<{
      name: string;
      unit_amount_cents: number;
      capacity_total: number;
      participants_per_ticket: number;
      zone: string | null;
      early_bird_amount_cents: number | null;
      early_bird_start: string | null;
      early_bird_end: string | null;
      description: string | null;
      post_purchase_instructions: string | null;
      internal_notes: string | null;
      display_order: number;
      hidden: boolean;
    }>
  ) => {
    const { error } = await supabase.from('tickets').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setTickets(arr => arr.map(t => t.id === id ? { ...t, ...patch } : t).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    setLastSaved({ kind: 'ticket', id, at: Date.now() });
    await logAdmin('ticket_updated', 'ticket', id, patch);
  };

  const moveTicketUp = async (ticketId: string) => {
    const currentIndex = tickets.findIndex(t => t.id === ticketId);
    if (currentIndex <= 0) return; // Already at top

    // Normalize display_order values to ensure sequential ordering
    const normalizedTickets = tickets.map((t, idx) => ({
      ...t,
      display_order: idx
    }));

    // Swap with previous ticket
    const temp = normalizedTickets[currentIndex - 1].display_order;
    normalizedTickets[currentIndex - 1].display_order = normalizedTickets[currentIndex].display_order;
    normalizedTickets[currentIndex].display_order = temp;

    // Update database for all tickets to ensure consistency
    await Promise.all(
      normalizedTickets.map(t =>
        supabase.from('tickets').update({ display_order: t.display_order }).eq('id', t.id)
      )
    );

    // Update local state
    setTickets(normalizedTickets.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));

    await logAdmin('ticket_reordered', 'ticket', ticketId, { moved: 'up' });
    toast.success('Ticket moved up');
  };

  const moveTicketDown = async (ticketId: string) => {
    const currentIndex = tickets.findIndex(t => t.id === ticketId);
    if (currentIndex === -1 || currentIndex >= tickets.length - 1) return; // Already at bottom

    // Normalize display_order values to ensure sequential ordering
    const normalizedTickets = tickets.map((t, idx) => ({
      ...t,
      display_order: idx
    }));

    // Swap with next ticket
    const temp = normalizedTickets[currentIndex + 1].display_order;
    normalizedTickets[currentIndex + 1].display_order = normalizedTickets[currentIndex].display_order;
    normalizedTickets[currentIndex].display_order = temp;

    // Update database for all tickets to ensure consistency
    await Promise.all(
      normalizedTickets.map(t =>
        supabase.from('tickets').update({ display_order: t.display_order }).eq('id', t.id)
      )
    );

    // Update local state
    setTickets(normalizedTickets.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));

    await logAdmin('ticket_reordered', 'ticket', ticketId, { moved: 'down' });
    toast.success('Ticket moved down');
  };

  const deleteTicket = async (id: string) => {
    // Check if ticket has any orders
    const { data: orders } = await supabase
      .from('order_items')
      .select('id')
      .eq('ticket_id', id)
      .limit(1);

    if (orders && orders.length > 0) {
      toast.error('Cannot delete this ticket because it has existing orders/purchases.');
      return;
    }

    // Check if ticket is used for comped attendees
    const { data: comped } = await supabase
      .from('attendees')
      .select('id')
      .eq('comped_ticket_id', id)
      .limit(1);

    if (comped && comped.length > 0) {
      toast.error('Cannot delete this ticket because it has comped attendees.');
      return;
    }

    if (!confirm('Delete this ticket?')) return;

    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete ticket: ${error.message}`);
      return;
    }

    setTickets(arr => arr.filter(t => t.id !== id));
    toast.success('Ticket deleted successfully');
    await logAdmin('ticket_deleted', 'ticket', id);
  };

  const sendTicketPreviewEmail = async (ticket: {
    id: string;
    name: string;
    unit_amount_cents: number;
    post_purchase_instructions: string | null;
  }) => {
    const targetEmail = (previewEmailByTicket[ticket.id] || '').trim();
    if (!targetEmail) {
      toast.error('Enter an email address for preview');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      toast.error('Enter a valid email address');
      return;
    }

    if (!ticketsEventId) {
      toast.error('No event selected');
      return;
    }

    setPreviewSendingByTicket((prev) => ({ ...prev, [ticket.id]: true }));
    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id,title,short_description,starts_at,timezone,slug,image_url,instructions,venue_id')
        .eq('id', ticketsEventId)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!event) throw new Error('Event not found');

      const { data: venue } = await supabase
        .from('venues')
        .select('name,address')
        .eq('id', event.venue_id)
        .maybeSingle();

      const instructionsForPreview = ticket.post_purchase_instructions?.trim() || event.instructions;

      const { error: sendError } = await supabase.functions.invoke('send-confirmation', {
        body: {
          name: 'Preview Recipient',
          email: targetEmail,
          eventTitle: event.title,
          eventDescription: event.short_description,
          eventDate: event.starts_at,
          eventTimezone: event.timezone,
          eventVenue: venue ? `${venue.name}${venue.address ? ` — ${venue.address}` : ''}` : 'Location TBD',
          instructions: instructionsForPreview,
          confirmationCode: `PREVIEW-${ticket.id.slice(0, 6).toUpperCase()}`,
          qrCode: `QR-PREVIEW-${ticket.id.slice(0, 6).toUpperCase()}`,
          eventImageUrl: event.image_url,
          eventSlug: event.slug,
          orderDetails: {
            orderId: `PREVIEW-${ticket.id.slice(0, 8).toUpperCase()}`,
            totalAmount: ticket.unit_amount_cents,
            currency: 'usd',
            tickets: [{
              name: ticket.name,
              quantity: 1,
              unitPrice: ticket.unit_amount_cents,
            }],
            addons: [],
            discountInfo: null,
          },
        },
      });

      if (sendError) throw sendError;
      toast.success(`Preview email sent to ${targetEmail}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send preview email');
    } finally {
      setPreviewSendingByTicket((prev) => ({ ...prev, [ticket.id]: false }));
    }
  };

  // Attendees functionality moved to separate page

  // Delete event
  const confirmDeleteEvent = (event: any) => {
    setEventToDelete(event);
    setDeleteConfirmOpen(true);
  };

  const deleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      await supabase.from('tickets').delete().eq('event_id', eventToDelete.id);
      await supabase.from('addons').delete().eq('event_id', eventToDelete.id);
      const { error } = await supabase.from('events').delete().eq('id', eventToDelete.id);
      if (error) throw error;

      await logAdmin('event_deleted', 'event', eventToDelete.id);
      toast.success('Event deleted successfully');

      // Reload events
      await loadEvents(currentPage, {
        tab: activeTab,
        search: searchQuery,
        month: filterMonth,
        year: filterYear
      });
    } catch (error: any) {
      alert(error.message || 'Failed to delete event');
    } finally {
      setDeleteConfirmOpen(false);
      setEventToDelete(null);
    }
  };

  // Bulk actions
  const bulkUpdateStatus = async (next: 'draft' | 'published' | 'archived' | 'sold_out' | 'paused') => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase.from('events').update({ status: next }).in('id', selectedIds as any);
    if (error) return alert(error.message);
    await logAdmin('events_bulk_status', 'event', null as any, { next, count: selectedIds.length });
    setSelectedIds([]);

    // Reload events
    await loadEvents(currentPage, {
      tab: activeTab,
      search: searchQuery,
      month: filterMonth,
      year: filterYear
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected event(s)? This cannot be undone.`)) return;
    await supabase.from('tickets').delete().in('event_id', selectedIds as any);
    await supabase.from('addons').delete().in('event_id', selectedIds as any);
    const { error } = await supabase.from('events').delete().in('id', selectedIds as any);
    if (error) return alert(error.message);
    await logAdmin('events_bulk_deleted', 'event', null as any, { count: selectedIds.length });
    setSelectedIds([]);

    // Reload events
    await loadEvents(currentPage, {
      tab: activeTab,
      search: searchQuery,
      month: filterMonth,
      year: filterYear
    });
  };

  // CSV export functionality moved to EventAttendees page

  // Image upload to Supabase Storage
  const uploadImage = async () => {
    if (!imageFile) return alert('Select an image first');
    const ext = imageFile.name.split('.').pop() || 'jpg';
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, imageFile, { upsert: false });
    if (error) return alert(error.message);
    const { data } = supabase.storage.from('event-images').getPublicUrl(path);
    setImageUrl(data.publicUrl);
    alert('Image uploaded');
  };

  // Image upload for edit dialog
  const uploadEditImage = async () => {
    if (!eImageFile) return alert('Select an image first');
    const ext = eImageFile.name.split('.').pop() || 'jpg';
    const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('event-images').upload(path, eImageFile, { upsert: false });
    if (error) return alert(error.message);
    const { data } = supabase.storage.from('event-images').getPublicUrl(path);
    setEImageUrl(data.publicUrl);
    alert('Image uploaded');
  };
  // Total pages from server count
  const totalPages = Math.ceil(totalCount / pageSize);
  const filteredTickets = useMemo(
    () => tickets.filter((t) => (t.name || "").toLowerCase().includes(ticketQuery.toLowerCase().trim())),
    [tickets, ticketQuery]
  );
  const filteredAddons = useMemo(
    () => addons.filter((a) => ((a.name || "") + " " + (a.description || "")).toLowerCase().includes(addonQuery.toLowerCase().trim())),
    [addons, addonQuery]
  );
  const recentlySaved = (kind: "ticket" | "addon", id: string) =>
    !!lastSaved && lastSaved.kind === kind && lastSaved.id === id && Date.now() - lastSaved.at < 4500;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setExpandedMobileEventId(null);
  }, [activeTab, searchQuery, filterMonth, filterYear]);
  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto px-4 py-8 space-y-8">
        <Helmet>
          <title>Admin Events | Events Management</title>
          <meta name="description" content="Create and manage events from the admin panel." />
          <link rel="canonical" href={`${baseUrl}/admin/events`} />
        </Helmet>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
          <p className="text-muted-foreground">Create and manage your events</p>
        </header>

        <section className="space-y-3">
          <Tabs value={workspaceTab} onValueChange={(v) => setWorkspaceTab(v as 'create' | 'manage' | 'list')}>
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto rounded-xl border border-primary/20 bg-primary/10 p-1">
              <TabsTrigger value="create" className="min-h-11 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Create Event</TabsTrigger>
              <TabsTrigger value="manage" className="min-h-11 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Tickets & Add-ons</TabsTrigger>
              <TabsTrigger value="list" className="min-h-11 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Events List</TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        <section className="space-y-6 min-w-0">
          {workspaceTab === 'create' && (
          <Card className="min-w-0 w-full">
            <CardHeader className="space-y-2">
              <CardTitle>Create New Event</CardTitle>
              <p className="text-sm text-muted-foreground">A cleaner flow: complete each step, then create the event.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="basics" className="space-y-4">
                <TabsList className="grid grid-cols-4 w-full h-auto rounded-lg border border-border/70 bg-muted/30 p-1">
                  <TabsTrigger value="basics" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Basics</TabsTrigger>
                  <TabsTrigger value="content" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Content</TabsTrigger>
                  <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Settings</TabsTrigger>
                  <TabsTrigger value="media" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Media</TabsTrigger>
                </TabsList>

                <TabsContent value="basics" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Short description</Label>
                    <Textarea
                      placeholder="Short description (max 350 characters)"
                      value={shortDesc}
                      disabled={false}
                      readOnly={false}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShortDesc(val.slice(0, 350));
                      }}
                    />
                    <p className="text-xs text-muted-foreground text-right">{shortDesc.length}/350</p>
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                  <div className="space-y-1">
                    <Label>Long description</Label>
                    <RichMarkdownEditor value={longDesc} onChange={setLongDesc} />
                  </div>
                  <div className="space-y-1">
                    <Label>General event instructions (default for post-purchase emails)</Label>
                    <RichMarkdownEditor value={instructions} onChange={setInstructions} />
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                  <div className="grid xl:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Start date & time</Label>
                      <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>End date & time</Label>
                      <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid xl:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Venue</Label>
                      <Select value={venueId} onValueChange={setVenueId as any}>
                        <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                        <SelectContent>
                          {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="opacity-0">New venue</Label>
                      <Button type="button" variant="secondary" className="w-full" onClick={createVenue}>New venue</Button>
                    </div>
                  </div>
                  <div className="grid xl:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="sold_out">Sold Out</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger><SelectValue placeholder="Timezone" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                          <SelectItem value="America/New_York">America/New_York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* External Ticket Sales Configuration */}
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Ticket Sales Configuration</Label>
                    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm">External Ticket Sales</Label>
                          <p className="text-xs text-muted-foreground">
                            Use external platform (Eventbrite, etc.) instead of integrated sales system
                          </p>
                        </div>
                        <Switch 
                          checked={externalTicketSales} 
                          onCheckedChange={setExternalTicketSales} 
                        />
                      </div>
                      
                      {externalTicketSales && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          <div className="space-y-2">
                            <Label htmlFor="external-url" className="text-sm font-medium">
                              External Ticket URL <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="external-url"
                              type="url"
                              placeholder="https://eventbrite.com/your-event"
                              value={externalTicketUrl}
                              onChange={(e) => setExternalTicketUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Where users will be redirected to purchase tickets
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="button-text" className="text-sm font-medium">
                              Button Text
                            </Label>
                            <Input
                              id="button-text"
                              placeholder="Get Tickets"
                              value={externalTicketButtonText}
                              onChange={(e) => setExternalTicketButtonText(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Text displayed on the purchase button
                            </p>
                          </div>
                          
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <p className="text-xs text-blue-800">
                              <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>
                              When external sales is enabled, users will enter their email before being redirected to your external ticketing platform.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="media" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                  <div className="space-y-2">
                    <Label>Event image</Label>
                    <Input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setImageFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setImagePreview(null);
                      }
                    }} />
                    <Button type="button" variant="secondary" onClick={uploadImage}>Upload image</Button>
                    {imageUrl && <span className="text-xs text-muted-foreground truncate" title={imageUrl}>Uploaded ✓</span>}
                  </div>
                  {imagePreview && (
                    <div className="w-40 h-40 rounded-md overflow-hidden bg-muted border">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end border-t pt-4">
                <Button onClick={createEvent} className="min-w-40">Create event</Button>
              </div>
            </CardContent>
          </Card>
          )}

          {workspaceTab === 'manage' && (
          <Card className="min-w-0 w-full">
            <CardHeader>
              <CardTitle>Tickets & add-ons</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1">
                <Label htmlFor="manage-ev">Select event</Label>
                <Select value={manageEventId} onValueChange={(v) => setManageEventId(v)}>
                  <SelectTrigger id="manage-ev"><SelectValue placeholder="Choose an event" /></SelectTrigger>
                  <SelectContent>
                    {events.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} - {new Date(e.starts_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* External Sales Warning */}
              {manageEventId && events.find(e => e.id === manageEventId)?.external_ticket_sales && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-600 text-lg">⚠️</span>
                    <div>
                      <h3 className="font-semibold text-amber-800">External Ticket Sales Enabled</h3>
                      <p className="text-sm text-amber-700 mt-1">
                        Ticket configuration is disabled for this event because external ticket sales is enabled. 
                        To configure tickets here, disable external sales in the Settings tab when editing this event.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  className="w-full" 
                  variant={ticketsOpen ? "secondary" : "outline"} 
                  onClick={() => manageEventId && openTickets(manageEventId!)} 
                  disabled={!manageEventId || (manageEventId && events.find(e => e.id === manageEventId)?.external_ticket_sales)}
                >
                  Tickets
                </Button>
                <Button 
                  className="w-full" 
                  variant={addonsOpen ? "secondary" : "outline"} 
                  onClick={() => manageEventId && openAddons(manageEventId!)} 
                  disabled={!manageEventId || (manageEventId && events.find(e => e.id === manageEventId)?.external_ticket_sales)}
                >
                  Add-ons
                </Button>
              </div>
              {(ticketsOpen || addonsOpen) && (
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setTicketsOpen(false); setAddonsOpen(false); }}>Close editor</Button>
                </div>
              )}

              {manageEventId && (
                <p className="text-xs text-muted-foreground">
                  Editing: <span className="font-medium text-foreground">{events.find((e) => e.id === manageEventId)?.title || 'Selected event'}</span>
                </p>
              )}

              {!manageEventId && (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                  Select an event, then choose <span className="font-medium text-foreground">Manage tickets</span> or <span className="font-medium text-foreground">Manage add-ons</span>.
                </div>
              )}

              {/* Inline editors below – no popups */}
              {ticketsOpen && ticketsEventId === manageEventId && (
                <div className="space-y-4 border rounded-xl p-5 bg-muted/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium text-base">Tickets</h4>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={addTicketSimple}>Add simple ticket</Button>
                      <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={addTicketCombo}>Add combo</Button>
                      <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={addTicketByZone}>Add by zone</Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={ticketQuery}
                      onChange={(e) => setTicketQuery(e.target.value)}
                      placeholder="Search tickets by name..."
                      className="pl-9"
                    />
                  </div>
                  {tickets.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tickets yet.</p>
                  )}
                  {tickets.length > 0 && filteredTickets.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tickets match your search.</p>
                  )}
                  {filteredTickets.map((t, index) => {
                    const earlyEnabled = Boolean(t.early_bird_amount_cents && t.early_bird_start && t.early_bird_end);
                    const absoluteIndex = tickets.findIndex((item) => item.id === t.id);
                    const isFirst = absoluteIndex === 0;
                    const isLast = absoluteIndex === tickets.length - 1;
                    return (
                      <details key={t.id} className="border rounded-xl bg-card" open={index === 0}>
                        <summary className="list-none cursor-pointer p-4 border-b flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{t.name || 'Untitled ticket'}</p>
                            <p className="text-xs text-muted-foreground">{(t.unit_amount_cents / 100).toFixed(2)} • cap {t.capacity_total || 0} • order #{t.display_order || 0}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {t.hidden ? <span className="text-[10px] rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">Hidden</span> : <span className="text-[10px] rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700">Visible</span>}
                              {Boolean(t.early_bird_amount_cents && t.early_bird_start && t.early_bird_end) && <span className="text-[10px] rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700">Early Bird</span>}
                              {(t.name?.toLowerCase().includes('combo') || (t.participants_per_ticket ?? 1) > 1) && <span className="text-[10px] rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-700">Combo</span>}
                              {recentlySaved('ticket', t.id) && <span className="text-[10px] rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary inline-flex items-center gap-1"><Check className="w-3 h-3" />Saved</span>}
                            </div>
                          </div>
                          <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                        </summary>
                        <div className="p-5 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold rounded-full bg-muted px-2 py-1">Order #{t.display_order || 0}</span>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={!t.hidden}
                                onCheckedChange={(checked) => updateTicketField(t.id, { hidden: !checked })}
                              />
                              <span className={`text-xs ${t.hidden ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {t.hidden ? 'Hidden' : 'Visible'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => moveTicketUp(t.id)}
                              disabled={isFirst}
                              title="Move up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => moveTicketDown(t.id)}
                              disabled={isLast}
                              title="Move down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteTicket(t.id)} title="Delete ticket" aria-label="Delete ticket">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 items-end">
                          <div className="space-y-1">
                            <Label>Name</Label>
                            <Input className="w-full" defaultValue={t.name} onBlur={(e) => updateTicketField(t.id, { name: e.currentTarget.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label>Price</Label>
                            {(() => {
                              let priceEl: HTMLInputElement | null = null;
                              return (
                                <Input
                                  ref={(el) => (priceEl = el)}
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0"
                                  defaultValue={(t.unit_amount_cents / 100).toFixed(2)}
                                  className="w-full text-right"
                                  onBlur={() =>
                                    updateTicketField(t.id, {
                                      unit_amount_cents: Math.round(parseFloat(priceEl?.value || '0') * 100),
                                    })
                                  }
                                />
                              );
                            })()}
                          </div>
                          <div className="space-y-1">
                            <Label>Capacity</Label>
                            <Input type="number" inputMode="numeric" min={0} defaultValue={t.capacity_total || 0}
                              className="w-full text-right"
                              onBlur={(e) => updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Zone</Label>
                            <Input placeholder="e.g. General, VIP" defaultValue={t.zone || ''}
                              onBlur={(e) => updateTicketField(t.id, { zone: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
                            />
                          </div>
                          {(t.name?.toLowerCase().includes('combo') || (t.participants_per_ticket ?? 1) > 1) && (
                            <div className="space-y-1">
                              <Label>Participants per ticket</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                defaultValue={t.participants_per_ticket || 1}
                                className="w-full text-right"
                                onBlur={(e) => updateTicketField(t.id, { participants_per_ticket: Math.max(1, parseInt(e.currentTarget.value || '1', 10)) })}
                              />
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label>Ticket description</Label>
                            <Textarea
                              placeholder="Brief description (shown under this ticket)"
                              defaultValue={t.description || ''}
                              onBlur={(e) => updateTicketField(t.id, { description: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Ticket-specific email instructions (optional override)</Label>
                            <Textarea
                              placeholder="If set, this replaces the general event instructions for buyers of this ticket"
                              defaultValue={t.post_purchase_instructions || ''}
                              onBlur={(e) => updateTicketField(t.id, { post_purchase_instructions: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
                            />
                            <div className="flex gap-2">
                              <Input
                                type="email"
                                placeholder="Preview email"
                                value={previewEmailByTicket[t.id] || ''}
                                onChange={(e) => setPreviewEmailByTicket((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                className="h-9"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 shrink-0"
                                onClick={() => sendTicketPreviewEmail(t)}
                                disabled={!!previewSendingByTicket[t.id]}
                              >
                                {previewSendingByTicket[t.id] ? 'Sending...' : 'Send preview'}
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              <StickyNote className="w-4 h-4" />
                              Internal Notes
                            </Label>
                            <Textarea
                              placeholder="Private notes for administrators (not shown to the public)"
                              defaultValue={t.internal_notes || ''}
                              onBlur={(e) => updateTicketField(t.id, { internal_notes: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
                              className="bg-muted/50 border-muted-foreground/20"
                            />
                          </div>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Early bird</Label>
                              <p className="text-xs text-muted-foreground">Limited-time promotional price</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{earlyEnabled ? 'Active' : 'Inactive'}</span>
                              <Switch
                                checked={earlyEnabled}
                                onCheckedChange={(checked) => {
                                  if (!checked) {
                                    updateTicketField(t.id, { early_bird_amount_cents: null, early_bird_start: null, early_bird_end: null });
                                  } else {
                                    const nowIso = new Date().toISOString();
                                    updateTicketField(t.id, { early_bird_amount_cents: Math.max(0, Math.round((t.unit_amount_cents * 0.8))), early_bird_start: nowIso, early_bird_end: nowIso });
                                  }
                                }}
                              />
                            </div>
                          </div>
                          {earlyEnabled && (
                            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label>Early price</Label>
                                <Input type="number" step="0.01" min="0" defaultValue={((t.early_bird_amount_cents || 0) / 100).toFixed(2)}
                                  onBlur={(e) => updateTicketField(t.id, { early_bird_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0') * 100) })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Start</Label>
                                <Input type="datetime-local" defaultValue={t.early_bird_start ? new Date(t.early_bird_start).toISOString().slice(0, 16) : ''}
                                  onBlur={(e) => updateTicketField(t.id, { early_bird_start: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>End</Label>
                                <Input type="datetime-local" defaultValue={t.early_bird_end ? new Date(t.early_bird_end).toISOString().slice(0, 16) : ''}
                                  onBlur={(e) => updateTicketField(t.id, { early_bird_end: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                      </details>
                    );
                  })}
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="secondary" onClick={() => setTicketsOpen(false)}>Close</Button>
                    <Button onClick={() => toast.success('Changes saved')}>Save changes</Button>
                  </div>
                </div>
              )}

              {addonsOpen && addonsEventId === manageEventId && (
                <div className="space-y-4 border rounded-xl p-5 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-base">Add-ons</h4>
                    <Button size="sm" variant="secondary" onClick={addAddon}>Add add-on</Button>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={addonQuery}
                      onChange={(e) => setAddonQuery(e.target.value)}
                      placeholder="Search add-ons by name or description..."
                      className="pl-9"
                    />
                  </div>
                  {addons.length === 0 && (
                    <p className="text-sm text-muted-foreground">No add-ons for this event yet.</p>
                  )}
                  {addons.length > 0 && filteredAddons.length === 0 && (
                    <p className="text-sm text-muted-foreground">No add-ons match your search.</p>
                  )}
                  {filteredAddons.map((a, idx) => (
                    <details key={a.id} className="border rounded-xl bg-card" open={idx === 0}>
                      <summary className="list-none cursor-pointer p-4 border-b flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{a.name || 'Untitled add-on'}</p>
                          <p className="text-xs text-muted-foreground">{(a.unit_amount_cents / 100).toFixed(2)} {a.max_quantity_per_person ? `• max ${a.max_quantity_per_person}/person` : ''}</p>
                          {recentlySaved('addon', a.id) && (
                            <span className="mt-1 inline-flex text-[10px] rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary items-center gap-1"><Check className="w-3 h-3" />Saved</span>
                          )}
                        </div>
                        <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                      </summary>
                      <div className="p-4 space-y-3">
                      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
                        <div>
                        <Input placeholder="Name" defaultValue={a.name} onBlur={(e) => updateAddonField(a.id, { name: e.currentTarget.value })} />
                        </div>
                        <div>
                        <Input type="number" step="0.01" min="0" placeholder="Price" defaultValue={(a.unit_amount_cents / 100).toFixed(2)}
                          onBlur={(e) => updateAddonField(a.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0') * 100) })}
                        />
                        </div>
                        <div>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Max qty per person"
                          defaultValue={a.max_quantity_per_person || ''}
                          onBlur={(e) => updateAddonField(a.id, { max_quantity_per_person: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : null })}
                        />
                        </div>
                        <div className="flex justify-end">
                          <Button variant="destructive" size="icon" onClick={() => deleteAddon(a.id)} title="Delete addon" aria-label="Delete addon">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Brief description (max ~30 words)"
                        value={a.description ?? ''}
                        onChange={(e) => updateAddonDesc(a.id, e.target.value)}
                      />
                      </div>
                    </details>
                  ))}
                  {addons.length > 0 && (
                    <div className="flex justify-end">
                      <Button onClick={saveAddonDescriptions} disabled={savingAddons}>{savingAddons ? 'Saving…' : 'Save descriptions'}</Button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">Use these tools to define ticket types and optional add-ons for the selected event.</p>
            </CardContent>
          </Card>
          )}
        </section>

        {workspaceTab === 'list' && (
        <section className="space-y-3 w-[calc(100vw-2rem)] md:w-[calc(100vw-4rem)] max-w-[1800px] mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">All Events</h2>
            <div className="flex gap-2">
              <Button onClick={archivePastEvents} variant="outline" size="sm">
                <Archive className="w-4 h-4 mr-2" />
                Archive Past Events
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archived')} className="w-full max-w-full min-w-0">
            <TabsList className="!grid !w-full max-w-md grid-cols-2 h-auto rounded-lg border border-border/70 bg-muted/20 p-1">
              <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Active Events</TabsTrigger>
              <TabsTrigger value="archived" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Archived Events</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3 mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:max-w-xs"
                />
                <Label className="text-sm text-muted-foreground">Month</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="all">All</SelectItem>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(m => (
                      <SelectItem key={m} value={m}>{new Date(2025, parseInt(m) - 1, 1).toLocaleString(undefined, { month: 'short' })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-sm text-muted-foreground">Year</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="all">All</SelectItem>
                    {Array.from(new Set(events.map(e => new Date(e.starts_at).getFullYear()))).sort().map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 border rounded-md bg-muted/30">
                  <span className="text-sm">Selected: {selectedIds.length}</span>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('published')}>Publish</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('sold_out')}>Mark Sold Out</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('paused')}>Pause Sales</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('draft')}>Mark draft</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('archived')}>Archive</Button>
                  <Button size="sm" variant="destructive" onClick={bulkDelete}>Delete</Button>
                  <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>Clear</Button>
                </div>
              )}

              {!isMobile ? (
                <div className="max-w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-3 pr-4 w-12">
                          <Checkbox
                            checked={events.length > 0 && events.every(e => selectedIds.includes(e.id))}
                            onCheckedChange={(v) => {
                              const checked = Boolean(v);
                              setSelectedIds(prev => {
                                if (checked) {
                                  return Array.from(new Set([...prev, ...events.map(e => e.id)]));
                                } else {
                                  return prev.filter(id => !events.some(e => e.id === id));
                                }
                              });
                            }}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th className="py-3 pr-4 min-w-80">Title</th>
                        <th className="py-3 pr-4 min-w-40">Start</th>
                        <th className="py-3 pr-4 min-w-56">Venue</th>
                        <th className="py-3 pr-4 min-w-24">Status</th>
                        <th className="py-3 pr-4 min-w-20">Visible</th>
                        <th className="py-3 pr-4 min-w-72">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(ev => {
                        const eventDate = new Date(ev.starts_at);
                        const formattedDate = eventDate.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        });
                        const statusLabel = ev.status === 'sold_out' ? 'Sold Out' : ev.status === 'paused' ? 'Paused' : ev.status.charAt(0).toUpperCase() + ev.status.slice(1);

                        return (
                          <tr key={ev.id} className="border-b border-border/30 transition-colors hover:bg-muted/40 group">
                            <td className="py-3 pl-4 pr-2 w-10">
                              <Checkbox
                                checked={selectedIds.includes(ev.id)}
                                onCheckedChange={(v) => {
                                  const checked = Boolean(v);
                                  setSelectedIds(prev => checked ? Array.from(new Set([...prev, ev.id])) : prev.filter(id => id !== ev.id));
                                }}
                                aria-label={`Select ${ev.title}`}
                              />
                            </td>
                            <td className="py-3 px-4 font-medium max-w-[28rem] text-foreground break-words" title={ev.title}>
                              {ev.title}
                              {ev.hidden && <span className="ml-2 text-xs text-muted-foreground font-normal">(hidden)</span>}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">{formattedDate}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground max-w-72 break-words" title={ev.venues?.name || '-'}>{ev.venues?.name || '-'}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide
                                ${ev.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  ev.status === 'sold_out' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    ev.status === 'paused' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                      'bg-muted text-muted-foreground'}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <Switch
                                checked={!ev.hidden}
                                onCheckedChange={async (checked) => {
                                  const { error } = await supabase.from('events').update({ hidden: !checked }).eq('id', ev.id);
                                  if (!error) {
                                    await logAdmin('event_visibility_changed', 'event', ev.id, { hidden: !checked });
                                    await loadEvents(currentPage, {
                                      tab: activeTab,
                                      search: searchQuery,
                                      month: filterMonth,
                                      year: filterYear
                                    });
                                  }
                                }}
                                aria-label={ev.hidden ? 'Show event' : 'Hide event'}
                              />
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="outline" title="Change status" aria-label="Change status" className="h-8 w-8">
                                      <Megaphone className="w-3 h-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="z-50 bg-popover">
                                    <DropdownMenuItem onClick={async () => {
                                      const next = 'published';
                                      const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                      if (!error) {
                                        await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                        await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                      }
                                    }}>Published</DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      const next = 'sold_out';
                                      const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                      if (!error) {
                                        await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                        await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                      }
                                    }}>Sold Out</DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      const next = 'paused';
                                      const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                      if (!error) {
                                        await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                        await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                      }
                                    }}>Paused</DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      const next = 'draft';
                                      const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                      if (!error) {
                                        await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                        await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                      }
                                    }}>Draft</DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      const next = 'archived';
                                      const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                      if (!error) {
                                        await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                        await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                      }
                                    }}>Archived</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button size="icon" variant="outline" title="Edit" aria-label="Edit" className="h-8 w-8" onClick={() => openEdit(ev)} disabled={ev.status === 'archived'}>
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="outline" title="Duplicate" aria-label="Duplicate" className="h-8 w-8" onClick={() => openDuplicate(ev)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="outline" title="Attendees" aria-label="Attendees" className="h-8 w-8" asChild>
                                  <Link to={`/admin/events/${ev.id}/attendees`}>
                                    <Users className="w-3 h-3" />
                                  </Link>
                                </Button>
                                <Button size="icon" variant="outline" title="View" aria-label="View" className="h-8 w-8" asChild>
                                  <a href={`/event/${ev.id}`} target="_blank" rel="noopener noreferrer">
                                    <Eye className="w-3 h-3" />
                                  </a>
                                </Button>
                                <Button size="icon" variant="destructive" title="Delete" aria-label="Delete" className="h-8 w-8" onClick={() => confirmDeleteEvent(ev)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Checkbox
                      checked={events.length > 0 && events.every(e => selectedIds.includes(e.id))}
                      onCheckedChange={(v) => {
                        const checked = Boolean(v);
                        setSelectedIds(prev => {
                          if (checked) return Array.from(new Set([...prev, ...events.map(e => e.id)]));
                          return prev.filter(id => !events.some(e => e.id === id));
                        });
                      }}
                      aria-label="Select all events on page"
                    />
                    <span className="text-sm text-muted-foreground">Select all on this page</span>
                  </div>

                  {events.map(ev => {
                    const eventDate = new Date(ev.starts_at);
                    const formattedDate = eventDate.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                    const statusLabel = ev.status === 'sold_out' ? 'Sold Out' : ev.status === 'paused' ? 'Paused' : ev.status.charAt(0).toUpperCase() + ev.status.slice(1);
                    const isExpanded = expandedMobileEventId === ev.id;

                    return (
                      <article key={ev.id} className="rounded-xl border border-border/70 bg-card/80 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedMobileEventId((prev) => prev === ev.id ? null : ev.id)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
                          </div>
                          <ChevronDownIcon className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/60 px-3 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedIds.includes(ev.id)}
                                  onCheckedChange={(v) => {
                                    const checked = Boolean(v);
                                    setSelectedIds(prev => checked ? Array.from(new Set([...prev, ev.id])) : prev.filter(id => id !== ev.id));
                                  }}
                                  aria-label={`Select ${ev.title}`}
                                />
                                <span className="text-xs text-muted-foreground">Selected</span>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide
                                ${ev.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  ev.status === 'sold_out' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    ev.status === 'paused' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                      'bg-muted text-muted-foreground'}`}>
                                {statusLabel}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Venue</p>
                                <p className="font-medium truncate" title={ev.venues?.name || '-'}>{ev.venues?.name || '-'}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-2">
                              <span className="text-xs text-muted-foreground">Visible on site</span>
                              <Switch
                                checked={!ev.hidden}
                                onCheckedChange={async (checked) => {
                                  const { error } = await supabase.from('events').update({ hidden: !checked }).eq('id', ev.id);
                                  if (!error) {
                                    await logAdmin('event_visibility_changed', 'event', ev.id, { hidden: !checked });
                                    await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                  }
                                }}
                                aria-label={ev.hidden ? 'Show event' : 'Hide event'}
                              />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="outline" title="Change status" aria-label="Change status" className="h-9 w-9">
                                    <Megaphone className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="z-50 bg-popover">
                                  <DropdownMenuItem onClick={async () => {
                                    const next = 'published';
                                    const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                    if (!error) {
                                      await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                      await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                    }
                                  }}>Published</DropdownMenuItem>
                                  <DropdownMenuItem onClick={async () => {
                                    const next = 'sold_out';
                                    const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                    if (!error) {
                                      await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                      await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                    }
                                  }}>Sold Out</DropdownMenuItem>
                                  <DropdownMenuItem onClick={async () => {
                                    const next = 'paused';
                                    const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                    if (!error) {
                                      await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                      await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                    }
                                  }}>Paused</DropdownMenuItem>
                                  <DropdownMenuItem onClick={async () => {
                                    const next = 'draft';
                                    const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                    if (!error) {
                                      await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                      await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                    }
                                  }}>Draft</DropdownMenuItem>
                                  <DropdownMenuItem onClick={async () => {
                                    const next = 'archived';
                                    const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                    if (!error) {
                                      await logAdmin('event_status_changed', 'event', ev.id, { from: ev.status, to: next });
                                      await loadEvents(currentPage, { tab: activeTab, search: searchQuery, month: filterMonth, year: filterYear });
                                    }
                                  }}>Archived</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Button size="icon" variant="outline" title="Edit" aria-label="Edit" className="h-9 w-9" onClick={() => openEdit(ev)} disabled={ev.status === 'archived'}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="outline" title="Duplicate" aria-label="Duplicate" className="h-9 w-9" onClick={() => openDuplicate(ev)}>
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="outline" title="Attendees" aria-label="Attendees" className="h-9 w-9" asChild>
                                <Link to={`/admin/events/${ev.id}/attendees`}>
                                  <Users className="w-3.5 h-3.5" />
                                </Link>
                              </Button>
                              <Button size="icon" variant="outline" title="View" aria-label="View" className="h-9 w-9" asChild>
                                <a href={`/event/${ev.id}`} target="_blank" rel="noopener noreferrer">
                                  <Eye className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                              <Button size="icon" variant="destructive" title="Delete" aria-label="Delete" className="h-9 w-9" onClick={() => confirmDeleteEvent(ev)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-8 pb-4 w-full overflow-x-auto">
                  <Pagination>
                    <PaginationContent className="flex-wrap sm:flex-nowrap">
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        const showPage = page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1);

                        if (!showPage) {
                          // Show ellipsis only once between ranges
                          if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <span className="px-4 text-muted-foreground">...</span>
                              </PaginationItem>
                            );
                          }
                          return null;
                        }

                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              {/* Empty State */}
              {events.length === 0 && !loading && (
                <div className="text-center py-16 px-4 bg-muted/20 border border-dashed rounded-lg mt-6 flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-secondary/80 flex items-center justify-center mb-4 text-muted-foreground">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No events found</h3>
                  <p className="max-w-sm mt-2 text-sm text-muted-foreground">
                    {searchQuery || filterMonth !== 'all' || filterYear !== 'all'
                      ? "Try adjusting your filters or search terms."
                      : activeTab === 'active'
                        ? "Get started by creating your first event."
                        : "There are no archived events here."}
                  </p>
                  {activeTab === 'active' && !searchQuery && filterMonth === 'all' && filterYear === 'all' && (
                    <Button
                      className="mt-6"
                      variant="outline"
                      onClick={() => {
                        // trigger a scroll to top or focus to the creation form
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Create an Event
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>
        )}

        <Dialog open={false} onOpenChange={setAddonsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage add-ons</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {addons.length === 0 && (
                <p className="text-sm text-muted-foreground">No add-ons for this event yet.</p>
              )}
              {addons.map((a) => (
                <div key={a.id} className="p-3 border rounded-md bg-card space-y-2">
                  <div className="grid sm:grid-cols-4 gap-2 items-center">
                    <Input placeholder="Name" defaultValue={a.name} onBlur={(e) => updateAddonField(a.id, { name: e.currentTarget.value })} />
                    <Input type="number" step="0.01" min="0" placeholder="Price" defaultValue={(a.unit_amount_cents / 100).toFixed(2)}
                      onBlur={(e) => updateAddonField(a.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0') * 100) })}
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Max qty per person"
                      defaultValue={a.max_quantity_per_person || ''}
                      onBlur={(e) => updateAddonField(a.id, { max_quantity_per_person: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : null })}
                    />
                    <div className="flex justify-end">
                      <Button variant="destructive" size="icon" onClick={() => deleteAddon(a.id)} title="Delete addon" aria-label="Delete addon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Brief description (max ~30 words)"
                    value={a.description ?? ''}
                    onChange={(e) => updateAddonDesc(a.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="secondary" onClick={addAddon}>Add add-on</Button>
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={() => setAddonsOpen(false)}>Close</Button>
                <Button onClick={saveAddonDescriptions} disabled={savingAddons || addons.length === 0}>{savingAddons ? 'Saving...' : 'Save descriptions'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tickets dialog */}
        <Dialog open={false} onOpenChange={setTicketsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage tickets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <p className="text-sm text-muted-foreground">
                Define ticket types, prices, capacities and early-bird options. Use “Advanced” for zones and participants per ticket.
              </p>
              {tickets.length === 0 && (
                <p className="text-sm text-muted-foreground">No tickets yet.</p>
              )}
              {tickets.map((t) => {
                const earlyEnabled = Boolean(t.early_bird_amount_cents && t.early_bird_start && t.early_bird_end);
                return (
                  <div key={t.id} className="p-4 border rounded-md bg-card space-y-3">
                    <div className="grid gap-3 sm:grid-cols-12 items-end">
                      <div className="sm:col-span-6 space-y-1">
                        <Label>Name</Label>
                        <Input className="w-full" defaultValue={t.name} onBlur={(e) => updateTicketField(t.id, { name: e.currentTarget.value })} />
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label>Price</Label>
                        {(() => {
                          let priceEl: HTMLInputElement | null = null;
                          return (
                            <Input
                              ref={(el) => (priceEl = el)}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              defaultValue={(t.unit_amount_cents / 100).toFixed(2)}
                              className="w-full text-right"
                              onBlur={() =>
                                updateTicketField(t.id, {
                                  unit_amount_cents: Math.round(parseFloat(priceEl?.value || '0') * 100),
                                })
                              }
                            />
                          );
                        })()}
                      </div>
                      <div className="sm:col-span-2 space-y-1">
                        <Label>Capacity</Label>
                        <Input type="number" inputMode="numeric" min={0} defaultValue={t.capacity_total || 0}
                          className="w-full text-right"
                          onBlur={(e) => updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <Button variant="destructive" size="icon" onClick={() => deleteTicket(t.id)} title="Delete ticket" aria-label="Delete ticket">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Early bird */}
                    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Early bird</Label>
                          <p className="text-xs text-muted-foreground">Limited-time promotional price</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{earlyEnabled ? 'Active' : 'Inactive'}</span>
                          <Switch
                            checked={earlyEnabled}
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                updateTicketField(t.id, { early_bird_amount_cents: null, early_bird_start: null, early_bird_end: null });
                              } else {
                                const nowIso = new Date().toISOString();
                                updateTicketField(t.id, { early_bird_amount_cents: Math.max(0, Math.round((t.unit_amount_cents * 0.8))), early_bird_start: nowIso, early_bird_end: nowIso });
                              }
                            }}
                          />
                        </div>
                      </div>
                      {earlyEnabled && (
                        <div className="grid sm:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label>Early price</Label>
                            <Input type="number" step="0.01" min="0" defaultValue={((t.early_bird_amount_cents || 0) / 100).toFixed(2)}
                              onBlur={(e) => updateTicketField(t.id, { early_bird_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0') * 100) })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Start</Label>
                            <Input type="datetime-local" defaultValue={t.early_bird_start ? new Date(t.early_bird_start).toISOString().slice(0, 16) : ''}
                              onBlur={(e) => updateTicketField(t.id, { early_bird_start: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>End</Label>
                            <Input type="datetime-local" defaultValue={t.early_bird_end ? new Date(t.early_bird_end).toISOString().slice(0, 16) : ''}
                              onBlur={(e) => updateTicketField(t.id, { early_bird_end: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter className="flex flex-wrap gap-2">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={addTicketSimple}>Add simple ticket</Button>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={addTicketCombo}>Add combo (multi-participant)</Button>
              <Button className="w-full sm:w-auto" variant="secondary" onClick={addTicketByZone}>Add ticket by zone</Button>
              <Button variant="secondary" onClick={() => setTicketsOpen(false)} className="w-full sm:w-auto sm:ml-auto">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit event dialog - responsive */}
        {isMobile ? (
          <Sheet open={editOpen} onOpenChange={setEditOpen}>
            <SheetContent side="bottom" className="h-[95vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Edit event</SheetTitle>
              </SheetHeader>
              <div className="space-y-3 py-4">
                <Input placeholder="Title" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                <div className="space-y-1">
                  <Textarea
                    placeholder="Short description (max 350 characters)"
                    value={eShort}
                    disabled={false}
                    readOnly={false}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEShort(val.slice(0, 350));
                    }}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {eShort.length}/350
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Long description</Label>
                  <RichMarkdownEditor value={eLong} onChange={setELong} />
                </div>
                <div className="space-y-1">
                  <Label>General event instructions (default for post-purchase emails)</Label>
                  <RichMarkdownEditor value={eInstructions} onChange={setEInstructions} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Input type="datetime-local" value={eStarts} onChange={(e) => setEStarts(e.target.value)} />
                  <Input type="datetime-local" value={eEnds} onChange={(e) => setEEnds(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Select value={eVenueId} onValueChange={setEVenueId as any}>
                    <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                    <SelectContent>
                      {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={eStatus} onValueChange={setEStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="sold_out">Sold Out</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={eTimezone} onValueChange={setETimezone}>
                    <SelectTrigger><SelectValue placeholder="Timezone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                  <div>
                    <Label>Visible on frontend</Label>
                    <p className="text-xs text-muted-foreground">When off, event is hidden from public listings</p>
                  </div>
                  <Switch checked={!eHidden} onCheckedChange={(checked) => setEHidden(!checked)} />
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 items-start">
                    <Input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setEImageFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setEImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      } else {
                        setEImagePreview(null);
                      }
                    }} />
                    <Button type="button" variant="secondary" onClick={uploadEditImage}>Upload image</Button>
                    {eImageUrl && <span className="text-xs text-muted-foreground truncate" title={eImageUrl}>Uploaded ✓</span>}
                  </div>
                  {(eImagePreview || eImageUrl) && (
                    <div className="w-32 h-32 rounded-md overflow-hidden bg-muted">
                      <img src={eImagePreview || eImageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <SheetFooter className="gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={saveEdit}>Save changes</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Tabs defaultValue="basics" className="space-y-4">
                  <TabsList className="grid grid-cols-4 w-full h-auto rounded-lg border border-border/70 bg-muted/30 p-1">
                    <TabsTrigger value="basics" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Basics</TabsTrigger>
                    <TabsTrigger value="content" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Content</TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Settings</TabsTrigger>
                    <TabsTrigger value="media" className="data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Media</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basics" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                    <div className="space-y-1">
                      <Label>Title</Label>
                      <Input placeholder="Title" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Short description</Label>
                      <Textarea
                        placeholder="Short description (max 350 characters)"
                        value={eShort}
                        disabled={false}
                        readOnly={false}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEShort(val.slice(0, 350));
                        }}
                      />
                      <p className="text-xs text-muted-foreground text-right">{eShort.length}/350</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                    <div className="space-y-1">
                      <Label>Long description</Label>
                      <RichMarkdownEditor value={eLong} onChange={setELong} />
                    </div>
                    <div className="space-y-1">
                      <Label>General event instructions (default for post-purchase emails)</Label>
                      <RichMarkdownEditor value={eInstructions} onChange={setEInstructions} />
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                    <div className="grid xl:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Start date & time</Label>
                        <Input type="datetime-local" value={eStarts} onChange={(e) => setEStarts(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>End date & time</Label>
                        <Input type="datetime-local" value={eEnds} onChange={(e) => setEEnds(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid xl:grid-cols-3 gap-4">
                      <div className="space-y-1 xl:col-span-2">
                        <Label>Venue</Label>
                        <Select value={eVenueId} onValueChange={setEVenueId as any}>
                          <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                          <SelectContent>
                            {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select value={eStatus} onValueChange={setEStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="sold_out">Sold Out</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid xl:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Timezone</Label>
                        <Select value={eTimezone} onValueChange={setETimezone}>
                          <SelectTrigger><SelectValue placeholder="Timezone" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                            <SelectItem value="America/New_York">America/New_York</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30 mt-6">
                        <div>
                          <Label>Visible on frontend</Label>
                        </div>
                        <Switch checked={!eHidden} onCheckedChange={(checked) => setEHidden(!checked)} />
                      </div>
                    </div>

                    {/* External Ticket Sales Configuration */}
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">Ticket Sales Configuration</Label>
                      <div className="space-y-4 rounded-md border bg-muted/30 p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="text-sm">External Ticket Sales</Label>
                            <p className="text-xs text-muted-foreground">
                              Use external platform (Eventbrite, etc.) instead of integrated sales system
                            </p>
                          </div>
                          <Switch 
                            checked={eExternalTicketSales} 
                            onCheckedChange={setEExternalTicketSales} 
                          />
                        </div>
                        
                        {eExternalTicketSales && (
                          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                            <div className="space-y-2">
                              <Label htmlFor="edit-external-url" className="text-sm font-medium">
                                External Ticket URL <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                id="edit-external-url"
                                type="url"
                                placeholder="https://eventbrite.com/your-event"
                                value={eExternalTicketUrl}
                                onChange={(e) => setEExternalTicketUrl(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Where users will be redirected to purchase tickets
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="edit-button-text" className="text-sm font-medium">
                                Button Text
                              </Label>
                              <Input
                                id="edit-button-text"
                                placeholder="Get Tickets"
                                value={eExternalTicketButtonText}
                                onChange={(e) => setEExternalTicketButtonText(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Text displayed on the purchase button
                              </p>
                            </div>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded p-3">
                              <p className="text-xs text-blue-800">
                                <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>
                                When external sales is enabled, users will enter their email before being redirected to your external ticketing platform.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="media" className="space-y-4 rounded-lg border border-border/70 bg-card/40 p-4">
                    <div className="space-y-2">
                      <Label>Event image</Label>
                      <Input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setEImageFile(file);
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setEImagePreview(reader.result as string);
                          reader.readAsDataURL(file);
                        } else {
                          setEImagePreview(null);
                        }
                      }} />
                      <Button type="button" variant="secondary" onClick={uploadEditImage}>Upload image</Button>
                      {eImageUrl && <span className="text-xs text-muted-foreground truncate" title={eImageUrl}>Uploaded ✓</span>}
                    </div>
                    {(eImagePreview || eImageUrl) && (
                      <div className="w-40 h-40 rounded-md overflow-hidden bg-muted border">
                        <img src={eImagePreview || eImageUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={saveEdit}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Attendees functionality moved to separate page */}
        <Dialog open={venueEditOpen} onOpenChange={setVenueEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit venue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input placeholder="Name" value={vName} onChange={(e) => setVName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Address & Location</Label>
                <p className="text-xs text-muted-foreground">Type an address in the search box below or click on the map</p>
                <GoogleMapPicker address={vAddress} onAddressChange={setVAddress} heightClass="h-64" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setVenueEditOpen(false)}>Cancel</Button>
              <Button onClick={saveVenueEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate event dialog */}
        <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicate Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Creating a copy of: <strong>{duplicatingEvent?.title}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will duplicate the event with all its tickets and add-ons.
                </p>
              </div>
              <div className="space-y-1">
                <Label>New event title</Label>
                <Input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Enter new event title"
                />
              </div>
              <div className="space-y-1">
                <Label>New event date and time</Label>
                <Input
                  type="datetime-local"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDuplicateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={duplicateEvent} disabled={!newEventDate || !newEventTitle.trim()}>
                Duplicate Event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Event Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the event "<strong>{eventToDelete?.title}</strong>"?
                <br />
                <span className="text-destructive font-medium">⚠️ This action cannot be undone.</span>
                <br />
                <span className="text-xs text-muted-foreground">
                  This will permanently delete the event, all its tickets, add-ons, and registrations.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <VenueCreateDialog
          open={venueDialogOpen}
          onOpenChange={setVenueDialogOpen}
          onCreated={handleVenueCreated}
        />
      </main>
    </AdminRoute>
  );
};

export default AdminEvents;
