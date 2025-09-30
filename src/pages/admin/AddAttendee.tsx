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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
      if (!eventId) return toast.error('Selecciona un evento');
      if (!selectedTicketId) return toast.error('Selecciona un ticket');
      if (!name.trim()) return toast.error('Nombre requerido');
      if (!email.trim()) return toast.error('Email requerido');
      if (!phone.trim()) return toast.error('Teléfono requerido');
      
      setSaving(true);

      // Call the edge function to create comped attendee
      const { data, error } = await supabase.functions.invoke('create-comped-attendee', {
        body: {
          event_id: eventId,
          ticket_id: selectedTicketId,
          addon_ids: selectedAddonIds,
          name,
          email,
          phone
        }
      });

      if (error) throw error;
      
      toast.success('Asistente agregado y email enviado');
      setName(''); 
      setEmail(''); 
      setPhone('');
      setSelectedTicketId('');
      setSelectedAddonIds([]);
    } catch (e: any) {
      console.error('Error creating comped attendee:', e);
      toast.error(e?.message || 'Error al agregar asistente');
    } finally {
      setSaving(false);
    }
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
          <title>Agregar asistente | Dashboard</title>
          <meta name="description" content="Agregar manualmente participantes a un evento" />
          <link rel="canonical" href={`${baseUrl}/admin/attendees/add`} />
        </Helmet>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/events">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a eventos
            </Link>
          </Button>
        </div>

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Agregar asistente manualmente</h1>
            <p className="text-sm text-muted-foreground mt-1">El asistente recibirá un email de confirmación indicando que el ticket ha sido acreditado</p>
          </div>
        </header>

        <section className="p-6 border rounded-lg bg-card space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Evento *</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona evento" />
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
                  <SelectValue placeholder={!eventId ? "Primero selecciona un evento" : "Selecciona ticket"} />
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
          </div>

          {addons.length > 0 && eventId && (
            <div className="space-y-2">
              <Label>Add-ons (opcional)</Label>
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Nombre completo *</Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Juan Pérez" 
              />
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="correo@ejemplo.com" 
              />
            </div>

            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="+1 234 567 8900" 
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={submit} disabled={saving || !eventId || !selectedTicketId}>
              {saving ? 'Guardando y enviando email...' : 'Agregar asistente'}
            </Button>
            {saving && <p className="text-sm text-muted-foreground self-center">Esto puede tardar unos segundos...</p>}
          </div>
        </section>
      </main>
    </AdminRoute>
  );
};

export default AddAttendeePage;