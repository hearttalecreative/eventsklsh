import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminRoute from "@/routes/AdminRoute";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discount_percent?: number;
  discount_amount_cents?: number;
  apply_to: 'tickets'|'addons'|'both';
  event_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  active: boolean;
}

const CouponsPage = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<{id:string; title:string}[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<Partial<Coupon>>({ apply_to: 'both', active: true });

  useEffect(() => {
    (async () => {
      const [{ data: evs }, { data: cps }] = await Promise.all([
        supabase.from('events').select('id,title').order('starts_at', { ascending: true }),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      ]);
      setEvents((evs || []) as any);
      setCoupons((cps || []) as any);
      setLoading(false);
    })();
  }, []);

  const create = async () => {
    try {
      if (!form.code) return toast.error('Código requerido');
      if (form.discount_percent == null && form.discount_amount_cents == null) return toast.error('Define un descuento');
      const payload: any = { ...form, code: form.code!.toUpperCase() };
      const { data, error } = await supabase.from('coupons').insert(payload).select('*');
      if (error) throw error;
      toast.success('Cupón creado');
      setCoupons([...(data as any[]), ...coupons]);
    } catch (e: any) {
      toast.error(e?.message || 'Error al crear cupón');
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
      setCoupons(coupons.filter(c => c.id !== id));
      toast.success('Cupón eliminado');
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar');
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminRoute>
      <main className="container mx-auto py-10 space-y-6">
        <Helmet>
          <title>Gestionar cupones | Dashboard</title>
          <meta name="description" content="Crear y eliminar cupones con caducidad y límites." />
          <link rel="canonical" href={`${baseUrl}/admin/coupons`} />
        </Helmet>

        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Cupones</h1>
        </header>

        <section className="p-4 border rounded-lg bg-card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm">Código</label>
              <Input value={form.code || ''} onChange={(e)=>setForm(f=>({...f, code:e.target.value}))} placeholder="KLSH100" />
            </div>
            <div>
              <label className="text-sm">Descripción</label>
              <Input value={form.description || ''} onChange={(e)=>setForm(f=>({...f, description:e.target.value}))} placeholder="Descripción" />
            </div>
            <div>
              <label className="text-sm">Ámbito</label>
              <Select value={(form.event_id ?? 'global')} onValueChange={(v)=>setForm(f=>({...f, event_id: v === 'global' ? null : v}))}>
                <SelectTrigger><SelectValue placeholder="Global o por evento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  {events.map(ev=> <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Tipo de aplicación</label>
              <Select value={form.apply_to || 'both'} onValueChange={(v:any)=>setForm(f=>({...f, apply_to: v}))}>
                <SelectTrigger><SelectValue placeholder="Aplicar a" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Tickets y Add-ons</SelectItem>
                  <SelectItem value="tickets">Solo Tickets</SelectItem>
                  <SelectItem value="addons">Solo Add-ons</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Descuento %</label>
              <Input type="number" min={0} max={100} value={form.discount_percent ?? ''} onChange={(e)=>setForm(f=>({...f, discount_percent: e.target.value===''? undefined : Number(e.target.value)}))} placeholder="100" />
            </div>
            <div>
              <label className="text-sm">Monto fijo (centavos)</label>
              <Input type="number" min={0} value={form.discount_amount_cents ?? ''} onChange={(e)=>setForm(f=>({...f, discount_amount_cents: e.target.value===''? undefined : Number(e.target.value)}))} placeholder="Opcional" />
            </div>
            <div>
              <label className="text-sm">Desde</label>
              <Input type="datetime-local" value={form.starts_at ?? ''} onChange={(e)=>setForm(f=>({...f, starts_at: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm">Hasta</label>
              <Input type="datetime-local" value={form.ends_at ?? ''} onChange={(e)=>setForm(f=>({...f, ends_at: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm">Máx. usos</label>
              <Input type="number" min={0} value={form.max_redemptions ?? ''} onChange={(e)=>setForm(f=>({...f, max_redemptions: e.target.value===''? undefined : Number(e.target.value)}))} placeholder="Ilimitado" />
            </div>
          </div>
          <div>
            <Button onClick={create}>Crear cupón</Button>
          </div>
        </section>

        <section className="p-4 border rounded-lg bg-card space-y-3">
          <h2 className="font-medium">Lista</h2>
          <div className="space-y-2">
            {coupons.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="text-sm">
                  <div className="font-medium">{c.code} {c.event_id ? <span className="text-muted-foreground">(evento)</span> : <span className="text-muted-foreground">(global)</span>}</div>
                  <div className="text-muted-foreground text-xs">{c.discount_percent != null ? `${c.discount_percent}%` : `${c.discount_amount_cents}¢`} · {c.apply_to}</div>
                </div>
                <Button variant="destructive" onClick={()=>remove(c.id)}>Eliminar</Button>
              </div>
            ))}
            {!coupons.length && <p className="text-sm text-muted-foreground">No hay cupones.</p>}
          </div>
        </section>
      </main>
    </AdminRoute>
  );
};

export default CouponsPage;