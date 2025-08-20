import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import AdminRoute from "@/routes/AdminRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import VenueCreateDialog from "@/components/admin/VenueCreateDialog";
import GoogleMapPicker from "@/components/GoogleMapPicker";
import { toast } from "sonner";

interface Venue {
  id: string;
  name: string;
  address?: string | null;
  capacity_total?: number | null;
  created_at?: string;
  updated_at?: string;
}

const VenuesPage = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [edit, setEdit] = useState<Venue | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("venues")
      .select("id,name,address,capacity_total,created_at,updated_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setVenues(data || []);
  };

  useEffect(() => { load(); }, []);

  const onCreated = (v: Venue) => {
    setVenues(prev => [v, ...prev]);
    toast.success("Venue created");
  };

  const updateVenue = async () => {
    if (!edit) return;
    if (!edit.name?.trim()) return toast.error("Name required");
    const payload = {
      name: edit.name,
      address: edit.address || null,
      capacity_total: edit.capacity_total ?? null,
    };
    const { data, error } = await supabase
      .from("venues")
      .update(payload)
      .eq("id", edit.id)
      .select("id,name,address,capacity_total,created_at,updated_at")
      .maybeSingle();
    if (error) return toast.error(error.message);
    if (data) {
      setVenues(prev => prev.map(v => v.id === data.id ? data : v));
      toast.success("Venue updated");
      setEdit(null);
    }
  };

  const deleteVenue = async (id: string) => {
    if (!confirm("Delete this venue? This cannot be undone.")) return;
    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setVenues(prev => prev.filter(v => v.id !== id));
    toast.success("Venue deleted");
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AdminRoute>
      <main className="container mx-auto py-10 space-y-6">
        <Helmet>
          <title>Venues | Events Admin</title>
          <meta name="description" content="Manage venues: create, edit and delete locations for your events." />
          <link rel="canonical" href={`${baseUrl}/admin/venues`} />
        </Helmet>

        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Venues management</h1>
          <Button onClick={() => setOpenCreate(true)}>New venue</Button>
        </header>

        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">All venues</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading…</p>
            ) : venues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No venues yet. Create your first one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Address</th>
                      <th className="py-2 pr-4">Capacity</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map(v => (
                      <tr key={v.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 pr-4">{v.name}</td>
                        <td className="py-2 pr-4">{v.address || '—'}</td>
                        <td className="py-2 pr-4">{v.capacity_total ?? '—'}</td>
                        <td className="py-2 pr-4 flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEdit(v)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteVenue(v.id)}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create dialog */}
        <VenueCreateDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={onCreated} />

        {/* Edit dialog */}
        <Dialog open={!!edit} onOpenChange={(o)=>!o && setEdit(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit venue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={edit?.name ?? ''} onChange={(e)=>setEdit(prev=>prev?{...prev, name:e.target.value}:prev)} />
              </div>
              <div className="space-y-1">
                <Label>Address & Location</Label>
                <p className="text-xs text-muted-foreground">Type an address in the search box below or click on the map</p>
                <GoogleMapPicker 
                  address={edit?.address ?? ''} 
                  onAddressChange={(addr) => setEdit(prev=>prev?{...prev, address:addr}:prev)} 
                  heightClass="h-64" 
                />
              </div>
              <div className="space-y-1">
                <Label>Capacity</Label>
                <Input value={edit?.capacity_total ?? ''} onChange={(e)=>setEdit(prev=>prev?{...prev, capacity_total:parseInt(e.target.value)||null}:prev)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={()=>setEdit(null)}>Cancel</Button>
              <Button onClick={updateVenue}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AdminRoute>
  );
};

export default VenuesPage;
