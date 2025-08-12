import React, { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (venue: { id: string; name: string; address?: string | null }) => void;
}

const VenueCreateDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const saveVenue = async () => {
    if (!name.trim()) return alert('Enter the venue name');
    setLoading(true);
    const payload: any = { name, address: address || null };
    const { data, error } = await supabase
      .from('venues')
      .insert(payload)
      .select('id,name,address')
      .single();
    setLoading(false);
    if (error) return alert(error.message);
    onCreated(data!);
    onOpenChange(false);
    setName('');
    setAddress('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New venue</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Central Theater" />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Street, city" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={saveVenue} disabled={loading}>{loading ? 'Saving…' : 'Save venue'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VenueCreateDialog;
