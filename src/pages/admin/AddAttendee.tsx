import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminRoute from "@/routes/AdminRoute";
import { toast } from "sonner";

const AddAttendeePage = () => {
  const [events, setEvents] = useState<{id:string; title:string}[]>([]);
  const [eventId, setEventId] = useState<string>('');
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

  const submit = async () => {
    try {
      if (!eventId) return toast.error('Selecciona un evento');
      if (!name.trim()) return toast.error('Nombre requerido');
      if (!phone.trim()) return toast.error('Teléfono requerido');
      setSaving(true);
      const { error } = await supabase.from('attendees').insert({ event_id: eventId, name, email: email || null, phone } as any);
      if (error) throw error;
      toast.success('Asistente agregado');
      setName(''); setEmail(''); setPhone('');
    } catch (e: any) {
      toast.error(e?.message || 'Error al agregar');
    } finally {
      setSaving(false);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminRoute>
      <main className="container mx-auto py-10 space-y-6">
        <Helmet>
          <title>Agregar asistente | Dashboard</title>
          <meta name="description" content="Agregar manualmente participantes a un evento" />
          <link rel="canonical" href={`${baseUrl}/admin/attendees/add`} />
        </Helmet>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agregar asistente</h1>
        </header>
        <section className="p-4 border rounded-lg bg-card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm">Evento</label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Selecciona evento" /></SelectTrigger>
                <SelectContent>
                  {events.map(ev=> <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Nombre</label>
              <Input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="text-sm">Teléfono</label>
              <Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="WhatsApp o teléfono" />
            </div>
          </div>
          <Button onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Agregar'}</Button>
        </section>
      </main>
    </AdminRoute>
  );
};

export default AddAttendeePage;