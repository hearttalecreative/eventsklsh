import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminRoute from "@/routes/AdminRoute";
import { toast } from "sonner";
import AdminHeader from "@/components/admin/AdminHeader";

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
      if (!form.code) return toast.error('Code is required');
      if (form.discount_percent == null && form.discount_amount_cents == null) return toast.error('Define a discount');
      const payload: any = { ...form, code: form.code!.toUpperCase() };
      const { data, error } = await supabase.from('coupons').insert(payload).select('*');
      if (error) throw error;
      toast.success('Coupon created');
      setCoupons([...(data as any[]), ...coupons]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create coupon');
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
      setCoupons(coupons.filter(c => c.id !== id));
      toast.success('Coupon deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto py-10 space-y-6">
        <Helmet>
          <title>Manage Coupons | Admin Dashboard</title>
          <meta name="description" content="Create and delete coupons with validity windows and limits." />
          <link rel="canonical" href={`${baseUrl}/admin/coupons`} />
        </Helmet>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Manage Coupons</h1>
          <p className="text-muted-foreground">Create and manage discount coupons</p>
        </header>

        <section className="p-4 border rounded-lg bg-card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm">Code</label>
              <Input value={form.code || ''} onChange={(e)=>setForm(f=>({...f, code:e.target.value}))} placeholder="KLSH100" />
            </div>
            <div>
              <label className="text-sm">Description</label>
              <Input value={form.description || ''} onChange={(e)=>setForm(f=>({...f, description:e.target.value}))} placeholder="Description" />
            </div>
            <div>
              <label className="text-sm">Scope</label>
              <Select value={(form.event_id ?? 'global')} onValueChange={(v)=>setForm(f=>({...f, event_id: v === 'global' ? null : v}))}>
                <SelectTrigger><SelectValue placeholder="Global or per event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  {events.map(ev=> <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Apply to</label>
              <Select value={form.apply_to || 'both'} onValueChange={(v:any)=>setForm(f=>({...f, apply_to: v}))}>
                <SelectTrigger><SelectValue placeholder="Apply to" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Tickets and Add-ons</SelectItem>
                  <SelectItem value="tickets">Tickets only</SelectItem>
                  <SelectItem value="addons">Add-ons only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm">Discount %</label>
              <Input type="number" min={0} max={100} value={form.discount_percent ?? ''} onChange={(e)=>setForm(f=>({...f, discount_percent: e.target.value===''? undefined : Number(e.target.value)}))} placeholder="100" />
            </div>
            <div>
              <label className="text-sm">Fixed amount (cents)</label>
              <Input type="number" min={0} value={form.discount_amount_cents ?? ''} onChange={(e)=>setForm(f=>({...f, discount_amount_cents: e.target.value===''? undefined : Number(e.target.value)}))} placeholder="Optional" />
            </div>
            <div>
              <label className="text-sm">Starts at</label>
              <Input type="datetime-local" value={form.starts_at ?? ''} onChange={(e)=>setForm(f=>({...f, starts_at: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm">Ends at</label>
              <Input type="datetime-local" value={form.ends_at ?? ''} onChange={(e)=>setForm(f=>({...f, ends_at: e.target.value}))} />
            </div>
            <div>
              <label className="text-sm">Max. redemptions</label>
              <Input type="number" min={0} value={form.max_redemptions ?? ''} onChange={(e)=>setForm(f=>({...f, max_redemptions: e.target.value===''? undefined : Number(e.target.value)}))} placeholder="Unlimited" />
            </div>
          </div>
          <div>
            <Button onClick={create}>Create coupon</Button>
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