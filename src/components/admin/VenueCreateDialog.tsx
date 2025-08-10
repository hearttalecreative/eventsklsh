import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import MapPickerLeaflet from '@/components/MapPickerLeaflet';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (venue: { id: string; name: string; address?: string | null; lat?: number | null; lng?: number | null }) => void;
}

const VenueCreateDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const onPick = (la: number, ln: number) => {
    setLat(la); setLng(ln);
  };

  const searchAddress = async () => {
    if (!address) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (data && data[0]) {
        const la = parseFloat(data[0].lat);
        const ln = parseFloat(data[0].lon);
        setLat(la); setLng(ln);
      } else {
        alert('No se encontró esa dirección. Puedes ubicar el pin manualmente en el mapa.');
      }
    } catch {
      alert('Error al buscar dirección. Intenta nuevamente.');
    }
  };

  const saveVenue = async () => {
    if (!name) return alert('Ingresa el nombre del venue');
    if (lat === undefined || lng === undefined) return alert('Verifica la ubicación en el mapa');
    setLoading(true);
    const payload: any = { name, address: address || null, lat, lng };
    const { data, error } = await supabase.from('venues').insert(payload).select('id,name,address,lat,lng').single();
    setLoading(false);
    if (error) return alert(error.message);
    onCreated(data!);
    onOpenChange(false);
    setName(''); setAddress(''); setLat(undefined); setLng(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo venue</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ej: Teatro Central" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1">
              <Label>Dirección</Label>
              <Input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Calle, ciudad" />
            </div>
            <Button variant="outline" onClick={searchAddress}>Buscar</Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Latitud</Label>
              <Input value={lat ?? ''} onChange={(e)=>setLat(parseFloat(e.target.value)||undefined)} placeholder="-34.60" />
            </div>
            <div className="space-y-1">
              <Label>Longitud</Label>
              <Input value={lng ?? ''} onChange={(e)=>setLng(parseFloat(e.target.value)||undefined)} placeholder="-58.38" />
            </div>
          </div>
          <MapPickerLeaflet lat={lat} lng={lng} onChange={onPick} />
          <p className="text-xs text-muted-foreground">Coloca el pin en la ubicación exacta para verificar que la dirección sea correcta.</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=>onOpenChange(false)}>Cancelar</Button>
          <Button onClick={saveVenue} disabled={loading}>{loading ? 'Guardando…' : 'Guardar venue'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VenueCreateDialog;
