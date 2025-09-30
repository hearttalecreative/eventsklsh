import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface Ticket {
  id: string;
  name: string;
  unit_amount_cents: number;
}

interface Addon {
  id: string;
  name: string;
  unit_amount_cents: number;
}

const AddAttendeePage = () => {
  const [events, setEvents] = useState<{id:string; title:string}[]>([]);
  const [eventId, setEventId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [ticketLabel, setTicketLabel] = useState<string>('');
  const [attendees, setAttendees] = useState<{name: string; email: string; phone: string}[]>([
    {name: '', email: '', phone: ''}
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('events').select('id,title').order('starts_at', { ascending: true });
      setEvents((data || []) as any);
    })();
  }, []);

  useEffect(() => {
    if (eventId) {
      loadTicketsAndAddons(eventId);
    } else {
      setTickets([]);
      setAddons([]);
      setSelectedTicketId('');
      setSelectedAddonIds([]);
    }
  }, [eventId]);

  useEffect(() => {
    // Update attendees array when quantity changes
    setAttendees(prev => {
      const newAttendees = Array(quantity).fill(null).map((_, i) => 
        prev[i] || {name: '', email: '', phone: ''}
      );
      return newAttendees;
    });
  }, [quantity]);

  const loadTicketsAndAddons = async (evId: string) => {
    const { data: ticketsData } = await supabase
      .from('tickets')
      .select('id, name, unit_amount_cents')
      .eq('event_id', evId)
      .order('display_order', { ascending: true });
    
    const { data: addonsData } = await supabase
      .from('addons')
      .select('id, name, unit_amount_cents')
      .eq('event_id', evId);
    
    setTickets(ticketsData || []);
    setAddons(addonsData || []);
  };

  const submit = async () => {
    try {
      if (!eventId) return toast.error('Select an event');
      if (!selectedTicketId) return toast.error('Select a ticket');
      
      // Validate all attendees
      for (let i = 0; i < attendees.length; i++) {
        if (!attendees[i].name.trim()) return toast.error(`Name required for attendee ${i + 1}`);
        if (!attendees[i].email.trim()) return toast.error(`Email required for attendee ${i + 1}`);
        if (!attendees[i].phone.trim()) return toast.error(`Phone required for attendee ${i + 1}`);
      }
      
      setSaving(true);

      // Call the edge function to create comped attendees
      const { data, error } = await supabase.functions.invoke('create-comped-attendee', {
        body: {
          event_id: eventId,
          ticket_id: selectedTicketId,
          addon_ids: selectedAddonIds,
          ticket_label: ticketLabel.trim() || null,
          attendees
        }
      });

      if (error) throw error;
      
      toast.success(`${attendees.length} attendee(s) added and emails sent`);
      setAttendees([{name: '', email: '', phone: ''}]);
      setQuantity(1);
      setTicketLabel('');
      setSelectedTicketId('');
      setSelectedAddonIds([]);
    } catch (e: any) {
      console.error('Error creating comped attendees:', e);
      toast.error(e?.message || 'Error adding attendees');
    } finally {
      setSaving(false);
    }
  };

  const updateAttendee = (index: number, field: 'name' | 'email' | 'phone', value: string) => {
    setAttendees(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev => 
      prev.includes(addonId) 
        ? prev.filter(id => id !== addonId)
        : [...prev, addonId]
    );
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-10 px-4 space-y-6">
        <Helmet>
          <title>Add Attendee | Dashboard</title>
          <meta name="description" content="Manually add participants to an event" />
          <link rel="canonical" href={`${baseUrl}/admin/attendees/add`} />
        </Helmet>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/events">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to events
            </Link>
          </Button>
        </div>

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Add attendee manually</h1>
            <p className="text-sm text-muted-foreground mt-1">The attendee will receive a confirmation email indicating that the ticket has been credited</p>
          </div>
        </header>

        <section className="p-6 border rounded-lg bg-card space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Event *</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map(ev => (
                    <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ticket *</Label>
              <Select 
                value={selectedTicketId} 
                onValueChange={setSelectedTicketId}
                disabled={!eventId || tickets.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!eventId ? "First select an event" : "Select ticket"} />
                </SelectTrigger>
                <SelectContent>
                  {tickets.map(ticket => (
                    <SelectItem key={ticket.id} value={ticket.id}>
                      {ticket.name} - {formatPrice(ticket.unit_amount_cents)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Number of attendees *</Label>
              <Select value={quantity.toString()} onValueChange={(val) => setQuantity(parseInt(val))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 10}, (_, i) => i + 1).map(num => (
                    <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ticket Label (optional)</Label>
            <Input 
              value={ticketLabel}
              onChange={e => setTicketLabel(e.target.value)}
              placeholder="e.g., Credited Ticket, CCM RSVP, VIP Guest"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Custom label to identify these attendees (e.g., "Credited Ticket for 2", "CCM RSVP")
            </p>
          </div>

          {addons.length > 0 && eventId && (
            <div className="space-y-2">
              <Label>Add-ons (optional)</Label>
              <div className="border rounded-md p-4 space-y-3">
                {addons.map(addon => (
                  <div key={addon.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`addon-${addon.id}`}
                      checked={selectedAddonIds.includes(addon.id)}
                      onCheckedChange={() => toggleAddon(addon.id)}
                    />
                    <label
                      htmlFor={`addon-${addon.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {addon.name} - {formatPrice(addon.unit_amount_cents)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Label className="text-base font-semibold">Attendee Information</Label>
            {attendees.map((attendee, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4 bg-muted/30">
                <h3 className="font-medium text-sm text-muted-foreground">Attendee {index + 1}</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Full name *</Label>
                    <Input 
                      value={attendee.name} 
                      onChange={e => updateAttendee(index, 'name', e.target.value)} 
                      placeholder="John Doe" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input 
                      type="email"
                      value={attendee.email} 
                      onChange={e => updateAttendee(index, 'email', e.target.value)} 
                      placeholder="email@example.com" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input 
                      value={attendee.phone} 
                      onChange={e => updateAttendee(index, 'phone', e.target.value)} 
                      placeholder="+1 234 567 8900" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button onClick={submit} disabled={saving || !eventId || !selectedTicketId}>
              {saving ? 'Saving and sending email...' : 'Add attendee'}
            </Button>
            {saving && <p className="text-sm text-muted-foreground self-center">This may take a few seconds...</p>}
          </div>
        </section>
      </main>
    </AdminRoute>
  );
};

export default AddAttendeePage;