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
import { Megaphone, Edit3, Ticket, Package, Users, Eye, Trash2, Copy, ChevronUp, ChevronDown, StickyNote, ChevronDown as ChevronDownIcon, Archive } from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/components/admin/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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


  // Edit event dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any|null>(null);
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [eImagePreview, setEImagePreview] = useState<string | null>(null);


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
    logAdmin('venue_created','venue', venue.id, { name: venue.name });
  };

  useEffect(() => {
    const load = async () => {
      const { data: v } = await supabase.from("venues").select("id,name,address").order("name");
      setVenues(v || []);
      // Order by starts_at descending (most recent/upcoming first)
      const { data: ev } = await supabase.from("events").select("*, venues:venue_id(name)").order("starts_at", { ascending: false });
      setEvents(ev || []);
      setManageEventId(ev && ev.length ? ev[0].id : undefined);
      
      // Load tickets sold stats for each event
      if (ev && ev.length > 0) {
        const eventIds = ev.map(e => e.id);
        
        // Get tickets sold (attendees count) for each event
        const { data: attendeeCounts } = await supabase
          .from("attendees")
          .select("event_id")
          .in("event_id", eventIds);
        
        // Get total capacity for each event (sum of all ticket types)
        const { data: ticketCapacities } = await supabase
          .from("tickets")
          .select("event_id, capacity_total")
          .in("event_id", eventIds);
        
        // Calculate stats for each event
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
    load();
  }, []);

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
      const { data: ev } = await supabase.from("events").select("*, venues:venue_id(name)").order("starts_at", { ascending: false });
      setEvents(ev || []);
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
    await logAdmin('venue_updated','venue',(venueEditing as any).id,{ name: vName, address: vAddress });
    setVenueEditOpen(false);
    setVenueEditing(null);
  };
  const createEvent = async () => {
    if (!title || !startsAt) return alert("Title and start are required");
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
    };

    try {
      const payload = {
        ...base,
        starts_at: startsAtUTC,
        ends_at: endsAtUTC,
      };
      const { data, error } = await supabase.from("events").insert(payload as any).select("*").single();
      if (error) throw error;
      setEvents((arr) => [data!, ...arr]);
      await logAdmin('event_created','event', data!.id, { title });

      // Reset form
      setTitle(""); setShortDesc(""); setLongDesc(""); setInstructions(""); setStartsAt(""); setEndsAt(""); setVenueId(undefined); setStatus("draft"); setTimezone('America/Los_Angeles'); setImageUrl("");
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
    };
const { data, error } = await supabase.from('events').update(payload).eq('id', editingEvent.id).select('*').single();
    if (error) return alert(error.message);
    setEvents(arr => arr.map(e => e.id === editingEvent.id ? { ...e, ...data } : e));
    await logAdmin('event_updated','event', editingEvent.id, payload);
    setEditOpen(false);
    setEditingEvent(null);
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

      // Add to events list
      setEvents(arr => [newEvent, ...arr]);
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
    await logAdmin('addon_created','addon', data!.id, { name: data!.name, event_id: addonsEventId });
  };

const updateAddonField = async (id: string, patch: Partial<{ name: string; unit_amount_cents: number; max_quantity_per_person: number | null }>) => {
    const { error } = await supabase.from('addons').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.map(a => a.id===id ? { ...a, ...patch } : a));
    await logAdmin('addon_updated','addon', id, patch);
  };

const deleteAddon = async (id: string) => {
    if (!confirm('Delete this add-on?')) return;
    const { error } = await supabase.from('addons').delete().eq('id', id);
    if (error) return alert(error.message);
    setAddons(arr => arr.filter(a => a.id !== id));
    await logAdmin('addon_deleted','addon', id);
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
    setTicketsEventId(eventId);
    const { data } = await supabase
      .from('tickets')
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,description,internal_notes,display_order')
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
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,internal_notes,display_order')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [...arr, data!].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_created','ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
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
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,internal_notes,display_order')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [...arr, data!].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_created','ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
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
      .select('id,name,unit_amount_cents,capacity_total,participants_per_ticket,zone,currency,early_bird_amount_cents,early_bird_start,early_bird_end,internal_notes,display_order')
      .single();
    if (error) return alert(error.message);
    setTickets(arr => [...arr, data!].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_created','ticket', data!.id, { event_id: ticketsEventId, name: data!.name });
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
      internal_notes: string | null;
      display_order: number;
    }>
  ) => {
    const { error } = await supabase.from('tickets').update(patch).eq('id', id);
    if (error) return alert(error.message);
    setTickets(arr => arr.map(t => t.id===id ? { ...t, ...patch } : t).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    await logAdmin('ticket_updated','ticket', id, patch);
  };

  const moveTicketUp = async (ticketId: string) => {
    const currentTicket = tickets.find(t => t.id === ticketId);
    if (!currentTicket) return;
    
    const currentOrder = currentTicket.display_order || 0;
    const previousTicket = tickets
      .filter(t => (t.display_order || 0) < currentOrder)
      .sort((a, b) => (b.display_order || 0) - (a.display_order || 0))[0];
    
    if (!previousTicket) return; // Already at top
    
    const tempOrder = previousTicket.display_order || 0;
    await updateTicketField(previousTicket.id, { display_order: currentOrder });
    await updateTicketField(ticketId, { display_order: tempOrder });
  };

  const moveTicketDown = async (ticketId: string) => {
    const currentTicket = tickets.find(t => t.id === ticketId);
    if (!currentTicket) return;
    
    const currentOrder = currentTicket.display_order || 0;
    const nextTicket = tickets
      .filter(t => (t.display_order || 0) > currentOrder)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0];
    
    if (!nextTicket) return; // Already at bottom
    
    const tempOrder = nextTicket.display_order || 0;
    await updateTicketField(nextTicket.id, { display_order: currentOrder });
    await updateTicketField(ticketId, { display_order: tempOrder });
  };

const deleteTicket = async (id: string) => {
    if (!confirm('Delete this ticket?')) return;
    const { error } = await supabase.from('tickets').delete().eq('id', id);
    if (error) return alert(error.message);
    setTickets(arr => arr.filter(t => t.id !== id));
    await logAdmin('ticket_deleted','ticket', id);
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
      
      setEvents(arr => arr.filter(e => e.id !== eventToDelete.id));
      await logAdmin('event_deleted','event', eventToDelete.id);
      toast.success('Event deleted successfully');
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
    setEvents(arr => arr.map(e => selectedIds.includes(e.id) ? { ...e, status: next } : e));
    setSelectedIds([]);
    await logAdmin('events_bulk_status','event', null as any, { next, count: selectedIds.length });
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected event(s)? This cannot be undone.`)) return;
    await supabase.from('tickets').delete().in('event_id', selectedIds as any);
    await supabase.from('addons').delete().in('event_id', selectedIds as any);
    const { error } = await supabase.from('events').delete().in('id', selectedIds as any);
    if (error) return alert(error.message);
    setEvents(arr => arr.filter(e => !selectedIds.includes(e.id)));
    await logAdmin('events_bulk_deleted','event', null as any, { count: selectedIds.length });
    setSelectedIds([]);
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
  // Events filtering and sorting
  const displayedEvents = useMemo(() => {
    const now = Date.now();
    
    // Filter by tab (active vs archived)
    let filtered = events.filter((ev) => {
      if (activeTab === 'archived') {
        return ev.status === 'archived';
      } else {
        return ev.status !== 'archived';
      }
    });

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((ev) => 
        ev.title?.toLowerCase().includes(q) || 
        ev.venues?.name?.toLowerCase().includes(q)
      );
    }

    // Filter by month and year
    const monthNum = filterMonth === 'all' ? null : parseInt(filterMonth, 10);
    const yearNum = filterYear === 'all' ? null : parseInt(filterYear, 10);
    filtered = filtered.filter((ev) => {
      const d = new Date(ev.starts_at);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const okM = monthNum ? m === monthNum : true;
      const okY = yearNum ? y === yearNum : true;
      return okM && okY;
    });

    // Sort by date: upcoming events first (chronological), then past events (reverse chronological)
    const future = filtered
      .filter((ev) => new Date(ev.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    
    const past = filtered
      .filter((ev) => new Date(ev.starts_at).getTime() < now)
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

    return [...future, ...past];
  }, [events, activeTab, searchQuery, filterMonth, filterYear]);
  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-8 space-y-8">
        <Helmet>
          <title>Admin Events | Events Management</title>
          <meta name="description" content="Create and manage events from the admin panel." />
          <link rel="canonical" href={`${baseUrl}/admin/events`} />
        </Helmet>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
          <p className="text-muted-foreground">Create and manage your events</p>
        </header>

        <section className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Create New Event</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
              <div className="space-y-1">
                <Textarea
                  placeholder="Short description (max 350 characters)"
                  value={shortDesc}
                  onChange={(e)=>{
                    const val = e.target.value;
                    setShortDesc(val.slice(0, 350));
                  }}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {shortDesc.length}/350
                </p>
              </div>
              <div className="space-y-1">
                <Label>Long description</Label>
                <RichMarkdownEditor value={longDesc} onChange={setLongDesc} />
              </div>
              <div className="space-y-1">
                <Label>Event instructions (shown to buyers after purchase)</Label>
                <RichMarkdownEditor value={instructions} onChange={setInstructions} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)} />
                <Input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Select value={venueId} onValueChange={setVenueId as any}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="secondary" onClick={createVenue}>New venue</Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
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
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue placeholder="Timezone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="grid sm:grid-cols-3 gap-3 items-center">
                  <Input type="file" accept="image/*" onChange={(e)=>{
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
                  <div className="w-32 h-32 rounded-md overflow-hidden bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <Button onClick={createEvent}>Create event</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tickets & add-ons</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="manage-ev">Select event</Label>
                <Select value={manageEventId} onValueChange={(v)=>setManageEventId(v)}>
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
              <div className="flex gap-2">
                <Button variant="secondary" onClick={()=> manageEventId && openTickets(manageEventId!)} disabled={!manageEventId}>Manage tickets</Button>
                <Button variant="outline" onClick={()=> manageEventId && openAddons(manageEventId!)} disabled={!manageEventId}>Manage add-ons</Button>
                {(ticketsOpen || addonsOpen) && (
                  <Button variant="ghost" onClick={()=>{setTicketsOpen(false); setAddonsOpen(false);}}>Close</Button>
                )}
              </div>

              {/* Inline editors below – no popups */}
              {ticketsOpen && ticketsEventId === manageEventId && (
                <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Tickets</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={addTicketSimple}>Add simple ticket</Button>
                      <Button size="sm" variant="secondary" onClick={addTicketCombo}>Add combo</Button>
                      <Button size="sm" variant="secondary" onClick={addTicketByZone}>Add by zone</Button>
                    </div>
                  </div>
                  {tickets.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tickets yet.</p>
                  )}
                  {tickets.map((t, index) => {
                    const earlyEnabled = Boolean(t.early_bird_amount_cents && t.early_bird_start && t.early_bird_end);
                    const isFirst = index === 0;
                    const isLast = index === tickets.length - 1;
                    return (
                      <div key={t.id} className="p-4 border rounded-md bg-card space-y-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">#{t.display_order || 0}</span>
                            <span className="text-xs text-muted-foreground">Orden de visualización</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => moveTicketUp(t.id)}
                              disabled={isFirst}
                              title="Mover arriba"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => moveTicketDown(t.id)}
                              disabled={isLast}
                              title="Mover abajo"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={()=>deleteTicket(t.id)} title="Delete ticket" aria-label="Delete ticket">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-12 items-end">
                          <div className="sm:col-span-4 space-y-1">
                            <Label>Name</Label>
                            <Input className="w-full" defaultValue={t.name} onBlur={(e)=>updateTicketField(t.id, { name: e.currentTarget.value })} />
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
                              onBlur={(e)=>updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                            />
                          </div>
                          <div className="sm:col-span-2 space-y-1">
                            <Label>Zone</Label>
                            <Input placeholder="e.g. General, VIP" defaultValue={t.zone || ''} 
                              onBlur={(e)=>updateTicketField(t.id, { zone: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
                            />
                          </div>
                          {(t.name?.toLowerCase().includes('combo') || (t.participants_per_ticket ?? 1) > 1) && (
                            <div className="sm:col-span-2 space-y-1">
                              <Label>Participants per ticket</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                defaultValue={t.participants_per_ticket || 1}
                                className="w-full text-right"
                                onBlur={(e)=>updateTicketField(t.id, { participants_per_ticket: Math.max(1, parseInt(e.currentTarget.value || '1', 10)) })}
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
                              onBlur={(e)=>updateTicketField(t.id, { description: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="flex items-center gap-2">
                              <StickyNote className="w-4 h-4" />
                              Internal Notes
                            </Label>
                            <Textarea
                              placeholder="Private notes for administrators (not shown to the public)"
                              defaultValue={t.internal_notes || ''}
                              onBlur={(e)=>updateTicketField(t.id, { internal_notes: e.currentTarget.value.trim() ? e.currentTarget.value : null })}
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
                                onCheckedChange={(checked)=>{
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
                                <Input type="number" step="0.01" min="0" defaultValue={((t.early_bird_amount_cents||0)/100).toFixed(2)}
                                  onBlur={(e)=>updateTicketField(t.id, { early_bird_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <Label>Start</Label>
                                <Input type="datetime-local" defaultValue={t.early_bird_start ? new Date(t.early_bird_start).toISOString().slice(0,16) : ''}
                                  onBlur={(e)=>updateTicketField(t.id, { early_bird_start: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <Label>End</Label>
                                <Input type="datetime-local" defaultValue={t.early_bird_end ? new Date(t.early_bird_end).toISOString().slice(0,16) : ''}
                                  onBlur={(e)=>updateTicketField(t.id, { early_bird_end: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="secondary" onClick={()=>setTicketsOpen(false)}>Close</Button>
                    <Button onClick={()=>toast.success('Changes saved')}>Save changes</Button>
                  </div>
                </div>
              )}

              {addonsOpen && addonsEventId === manageEventId && (
                <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Add-ons</h4>
                    <Button size="sm" variant="secondary" onClick={addAddon}>Add add-on</Button>
                  </div>
                  {addons.length === 0 && (
                    <p className="text-sm text-muted-foreground">No add-ons for this event yet.</p>
                  )}
                   {addons.map((a) => (
                     <div key={a.id} className="p-3 border rounded-md bg-card space-y-2">
                       <div className="grid sm:grid-cols-4 gap-2 items-center">
                         <Input placeholder="Name" defaultValue={a.name} onBlur={(e)=>updateAddonField(a.id, { name: e.currentTarget.value })} />
                         <Input type="number" step="0.01" min="0" placeholder="Price" defaultValue={(a.unit_amount_cents/100).toFixed(2)}
                           onBlur={(e)=>updateAddonField(a.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                         />
                         <Input 
                           type="number" 
                           min="1" 
                           placeholder="Max qty per person" 
                           defaultValue={a.max_quantity_per_person || ''} 
                           onBlur={(e)=>updateAddonField(a.id, { max_quantity_per_person: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : null })} 
                         />
                          <div className="flex justify-end">
                            <Button variant="destructive" size="icon" onClick={()=>deleteAddon(a.id)} title="Delete addon" aria-label="Delete addon">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                       </div>
                       <Textarea
                         placeholder="Brief description (max ~30 words)"
                         value={a.description ?? ''}
                         onChange={(e)=>updateAddonDesc(a.id, e.target.value)}
                       />
                     </div>
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
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">All Events</h2>
            <div className="flex gap-2">
              <Button onClick={archivePastEvents} variant="outline" size="sm">
                <Archive className="w-4 h-4 mr-2" />
                Archive Past Events
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archived')} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active">Active Events</TabsTrigger>
              <TabsTrigger value="archived">Archived Events</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3 mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input 
                  placeholder="Search events..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                />
                <Label className="text-sm text-muted-foreground">Month</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="all">All</SelectItem>
                    {['1','2','3','4','5','6','7','8','9','10','11','12'].map(m=> (
                      <SelectItem key={m} value={m}>{new Date(2025, parseInt(m)-1, 1).toLocaleString(undefined,{month:'short'})}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label className="text-sm text-muted-foreground">Year</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-28"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent className="z-50 bg-popover">
                    <SelectItem value="all">All</SelectItem>
                    {Array.from(new Set(events.map(e=> new Date(e.starts_at).getFullYear()))).sort().map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-3 border rounded-md bg-muted/30">
                  <span className="text-sm">Selected: {selectedIds.length}</span>
                  <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('published')}>Publish</Button>
                  <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('sold_out')}>Mark Sold Out</Button>
                  <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('paused')}>Pause Sales</Button>
                  <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('draft')}>Mark draft</Button>
                  <Button size="sm" variant="outline" onClick={()=>bulkUpdateStatus('archived')}>Archive</Button>
                  <Button size="sm" variant="destructive" onClick={bulkDelete}>Delete</Button>
                  <Button size="sm" variant="secondary" onClick={()=>setSelectedIds([])}>Clear</Button>
                </div>
              )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-3 pr-4 w-12">
                    <Checkbox
                      checked={displayedEvents.length>0 && selectedIds.length === displayedEvents.length}
                      onCheckedChange={(v)=>{
                        const checked = Boolean(v);
                        setSelectedIds(checked ? displayedEvents.map(e=>e.id) : []);
                      }}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="py-3 pr-4 min-w-48">Title</th>
                  <th className="py-3 pr-4 min-w-40">Start</th>
                  <th className="py-3 pr-4 min-w-36">Venue</th>
                  <th className="py-3 pr-4 min-w-24">Status</th>
                  <th className="py-3 pr-4 min-w-32">Tickets Sold</th>
                  <th className="py-3 pr-4 min-w-72">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEvents.map(ev => {
                  // Format date with timezone consideration
                  const eventDate = new Date(ev.starts_at);
                  const formattedDate = eventDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  
                  return (
                    <tr key={ev.id} className="border-b">
                      <td className="py-3 pr-4">
                        <Checkbox
                          checked={selectedIds.includes(ev.id)}
                          onCheckedChange={(v)=>{
                            const checked = Boolean(v);
                            setSelectedIds(prev => checked ? Array.from(new Set([...prev, ev.id])) : prev.filter(id => id !== ev.id));
                          }}
                          aria-label={`Select ${ev.title}`}
                        />
                      </td>
                      <td className="py-3 pr-4 font-medium max-w-48 truncate" title={ev.title}>{ev.title}</td>
                      <td className="py-3 pr-4 text-nowrap">{formattedDate}</td>
                      <td className="py-3 pr-4 max-w-36 truncate" title={ev.venues?.name || '-'}>{ev.venues?.name || '-'}</td>
                      <td className="py-3 pr-4 capitalize">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          ev.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          ev.status === 'sold_out' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          ev.status === 'paused' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          ev.status === 'draft' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {ev.status === 'sold_out' ? 'Sold Out' : ev.status === 'paused' ? 'Paused' : ev.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm font-medium">
                        {(() => {
                          const stats = eventStats[ev.id];
                          if (!stats) return '-';
                          return `${stats.ticketsSold}/${stats.totalCapacity}`;
                        })()}
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
                              <DropdownMenuItem onClick={async ()=>{
                                const next = 'published';
                                const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                if (!error) {
                                  setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                                  await logAdmin('event_status_changed','event', ev.id, { from: ev.status, to: next });
                                }
                              }}>Published</DropdownMenuItem>
                              <DropdownMenuItem onClick={async ()=>{
                                const next = 'sold_out';
                                const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                if (!error) {
                                  setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                                  await logAdmin('event_status_changed','event', ev.id, { from: ev.status, to: next });
                                }
                              }}>Sold Out</DropdownMenuItem>
                              <DropdownMenuItem onClick={async ()=>{
                                const next = 'paused';
                                const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                if (!error) {
                                  setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                                  await logAdmin('event_status_changed','event', ev.id, { from: ev.status, to: next });
                                }
                              }}>Paused</DropdownMenuItem>
                              <DropdownMenuItem onClick={async ()=>{
                                const next = 'draft';
                                const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                if (!error) {
                                  setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                                  await logAdmin('event_status_changed','event', ev.id, { from: ev.status, to: next });
                                }
                              }}>Draft</DropdownMenuItem>
                              <DropdownMenuItem onClick={async ()=>{
                                const next = 'archived';
                                const { error } = await supabase.from('events').update({ status: next }).eq('id', ev.id);
                                if (!error) {
                                  setEvents(arr => arr.map(e => e.id===ev.id? { ...e, status: next}: e));
                                  await logAdmin('event_status_changed','event', ev.id, { from: ev.status, to: next });
                                }
                              }}>Archived</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button size="icon" variant="outline" title="Edit" aria-label="Edit" className="h-8 w-8" onClick={()=>openEdit(ev)} disabled={ev.status === 'archived'}>
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="outline" title="Duplicate" aria-label="Duplicate" className="h-8 w-8" onClick={()=>openDuplicate(ev)}>
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
                          <Button size="icon" variant="destructive" title="Delete" aria-label="Delete" className="h-8 w-8" onClick={()=>confirmDeleteEvent(ev)}>
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
            </TabsContent>
          </Tabs>
        </section>

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
                     <Input placeholder="Name" defaultValue={a.name} onBlur={(e)=>updateAddonField(a.id, { name: e.currentTarget.value })} />
                     <Input type="number" step="0.01" min="0" placeholder="Price" defaultValue={(a.unit_amount_cents/100).toFixed(2)}
                       onBlur={(e)=>updateAddonField(a.id, { unit_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                     />
                     <Input 
                       type="number" 
                       min="1" 
                       placeholder="Max qty per person" 
                       defaultValue={a.max_quantity_per_person || ''} 
                       onBlur={(e)=>updateAddonField(a.id, { max_quantity_per_person: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : null })} 
                     />
                      <div className="flex justify-end">
                        <Button variant="destructive" size="icon" onClick={()=>deleteAddon(a.id)} title="Delete addon" aria-label="Delete addon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                   </div>
                   <Textarea
                     placeholder="Brief description (max ~30 words)"
                     value={a.description ?? ''}
                     onChange={(e)=>updateAddonDesc(a.id, e.target.value)}
                   />
                 </div>
               ))}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="secondary" onClick={addAddon}>Add add-on</Button>
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={()=>setAddonsOpen(false)}>Close</Button>
                <Button onClick={saveAddonDescriptions} disabled={savingAddons || addons.length===0}>{savingAddons? 'Saving...' : 'Save descriptions'}</Button>
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
                        <Input className="w-full" defaultValue={t.name} onBlur={(e)=>updateTicketField(t.id, { name: e.currentTarget.value })} />
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
                          onBlur={(e)=>updateTicketField(t.id, { capacity_total: parseInt(e.currentTarget.value || '0', 10) })}
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <Button variant="destructive" size="icon" onClick={()=>deleteTicket(t.id)} title="Delete ticket" aria-label="Delete ticket">
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
                            onCheckedChange={(checked)=>{
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
                            <Input type="number" step="0.01" min="0" defaultValue={((t.early_bird_amount_cents||0)/100).toFixed(2)}
                              onBlur={(e)=>updateTicketField(t.id, { early_bird_amount_cents: Math.round(parseFloat(e.currentTarget.value || '0')*100) })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Start</Label>
                            <Input type="datetime-local" defaultValue={t.early_bird_start ? new Date(t.early_bird_start).toISOString().slice(0,16) : ''}
                              onBlur={(e)=>updateTicketField(t.id, { early_bird_start: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>End</Label>
                            <Input type="datetime-local" defaultValue={t.early_bird_end ? new Date(t.early_bird_end).toISOString().slice(0,16) : ''}
                              onBlur={(e)=>updateTicketField(t.id, { early_bird_end: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
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
              <Button variant="secondary" onClick={addTicketSimple}>Add simple ticket</Button>
              <Button variant="secondary" onClick={addTicketCombo}>Add combo (multi-participant)</Button>
              <Button variant="secondary" onClick={addTicketByZone}>Add ticket by zone</Button>
              <Button variant="secondary" onClick={()=>setTicketsOpen(false)} className="ml-auto">Close</Button>
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
                <Input placeholder="Title" value={eTitle} onChange={(e)=>setETitle(e.target.value)} />
                <div className="space-y-1">
                  <Textarea
                    placeholder="Short description (max 350 characters)"
                    value={eShort}
                    onChange={(e)=>{
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
                  <Label>Event instructions (shown to buyers after purchase)</Label>
                  <RichMarkdownEditor value={eInstructions} onChange={setEInstructions} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Input type="datetime-local" value={eStarts} onChange={(e)=>setEStarts(e.target.value)} />
                  <Input type="datetime-local" value={eEnds} onChange={(e)=>setEEnds(e.target.value)} />
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
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 items-start">
                    <Input type="file" accept="image/*" onChange={(e)=>{
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
                <Button variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Button>
                <Button onClick={saveEdit}>Save changes</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit event</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title" value={eTitle} onChange={(e)=>setETitle(e.target.value)} />
                <div className="space-y-1">
                  <Textarea
                    placeholder="Short description (max 350 characters)"
                    value={eShort}
                    onChange={(e)=>{
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
                  <Label>Event instructions (shown to buyers after purchase)</Label>
                  <RichMarkdownEditor value={eInstructions} onChange={setEInstructions} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input type="datetime-local" value={eStarts} onChange={(e)=>setEStarts(e.target.value)} />
                  <Input type="datetime-local" value={eEnds} onChange={(e)=>setEEnds(e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
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
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3 items-center">
                    <Input type="file" accept="image/*" onChange={(e)=>{
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
              <DialogFooter>
                <Button variant="secondary" onClick={()=>setEditOpen(false)}>Cancel</Button>
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
                <Input placeholder="Name" value={vName} onChange={(e)=>setVName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Address & Location</Label>
                <p className="text-xs text-muted-foreground">Type an address in the search box below or click on the map</p>
                <GoogleMapPicker address={vAddress} onAddressChange={setVAddress} heightClass="h-64" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={()=>setVenueEditOpen(false)}>Cancel</Button>
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
