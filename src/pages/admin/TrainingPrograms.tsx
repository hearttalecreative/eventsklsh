import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminHeader from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, ExternalLink, Copy, Check, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  processing_fee_percent: number;
  is_bundle: boolean;
  display_order: number;
  active: boolean;
  created_at: string;
}

const calculateFee = (priceCents: number, feePercent: number) => {
  return Math.round(priceCents * (feePercent / 100));
};

const formatPrice = (cents: number) => {
  return (cents / 100).toFixed(2);
};

interface SortableRowProps {
  program: TrainingProgram;
  onEdit: (program: TrainingProgram) => void;
  onDelete: (id: string) => void;
}

function SortableRow({ program, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: program.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted/50' : ''}>
      <TableCell className="w-10">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{program.name}</TableCell>
      <TableCell>${formatPrice(program.price_cents)}</TableCell>
      <TableCell>{program.processing_fee_percent}%</TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded-full text-xs ${
          program.is_bundle 
            ? 'bg-primary/10 text-primary' 
            : 'bg-muted text-muted-foreground'
        }`}>
          {program.is_bundle ? 'Bundle' : 'Individual'}
        </span>
      </TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded-full text-xs ${
          program.active 
            ? 'bg-green-500/10 text-green-600' 
            : 'bg-red-500/10 text-red-600'
        }`}>
          {program.active ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(program)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (confirm('Are you sure you want to delete this program?')) {
                onDelete(program.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminTrainingPrograms() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_cents: '',
    processing_fee_percent: '3.5',
    is_bundle: false,
    active: true,
  });

  const publicUrl = `${window.location.origin}/trainings`;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: programs, isLoading } = useQuery({
    queryKey: ['admin-training-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as TrainingProgram[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const maxOrder = programs?.length ? Math.max(...programs.map(p => p.display_order)) : -1;
      
      const payload = {
        name: data.name,
        description: data.description || null,
        price_cents: Math.round(parseFloat(data.price_cents) * 100),
        processing_fee_percent: parseFloat(data.processing_fee_percent) || 3.5,
        is_bundle: data.is_bundle,
        active: data.active,
        ...(data.id ? {} : { display_order: maxOrder + 1 }),
      };

      if (data.id) {
        const { error } = await supabase
          .from('training_programs')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('training_programs')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-programs'] });
      toast.success(editingProgram ? 'Program updated' : 'Program created');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save program');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedPrograms: { id: string; display_order: number }[]) => {
      const updates = orderedPrograms.map(({ id, display_order }) =>
        supabase
          .from('training_programs')
          .update({ display_order })
          .eq('id', id)
      );
      
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error('Failed to update order');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-programs'] });
      toast.success('Order updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update order');
      queryClient.invalidateQueries({ queryKey: ['admin-training-programs'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-programs'] });
      toast.success('Program deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete program');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id || !programs) return;

    const oldIndex = programs.findIndex(p => p.id === active.id);
    const newIndex = programs.findIndex(p => p.id === over.id);

    const reorderedPrograms = arrayMove(programs, oldIndex, newIndex);
    
    // Optimistically update the cache
    queryClient.setQueryData(['admin-training-programs'], reorderedPrograms);

    // Prepare the updates
    const updates = reorderedPrograms.map((program, index) => ({
      id: program.id,
      display_order: index,
    }));

    reorderMutation.mutate(updates);
  };

  const handleOpenDialog = (program?: TrainingProgram) => {
    if (program) {
      setEditingProgram(program);
      setFormData({
        name: program.name,
        description: program.description || '',
        price_cents: formatPrice(program.price_cents),
        processing_fee_percent: program.processing_fee_percent.toString(),
        is_bundle: program.is_bundle,
        active: program.active,
      });
    } else {
      setEditingProgram(null);
      setFormData({
        name: '',
        description: '',
        price_cents: '',
        processing_fee_percent: '3.5',
        is_bundle: false,
        active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProgram(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingProgram?.id });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Training Programs</h1>
              <p className="text-muted-foreground">Manage your private training offerings</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Program
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingProgram ? 'Edit Program' : 'New Program'}</DialogTitle>
                  <DialogDescription>
                    {editingProgram ? 'Update the training program details' : 'Create a new training program'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price ($) *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price_cents}
                        onChange={(e) => setFormData({ ...formData, price_cents: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fee">Processing Fee (%)</Label>
                      <Input
                        id="fee"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData.processing_fee_percent}
                        onChange={(e) => setFormData({ ...formData, processing_fee_percent: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_bundle">Is Bundle?</Label>
                    <Switch
                      id="is_bundle"
                      checked={formData.is_bundle}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_bundle: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Active</Label>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveMutation.isPending}>
                      {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingProgram ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Public Link Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Public Sales Page</CardTitle>
              <CardDescription>Share this link with potential students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input value={publicUrl} readOnly className="flex-1" />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Programs Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <GripVertical className="h-4 w-4" />
                Drag rows to reorder programs
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : programs && programs.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <SortableContext
                        items={programs.map(p => p.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {programs.map((program) => (
                          <SortableRow
                            key={program.id}
                            program={program}
                            onEdit={handleOpenDialog}
                            onDelete={(id) => deleteMutation.mutate(id)}
                          />
                        ))}
                      </SortableContext>
                    </TableBody>
                  </Table>
                </DndContext>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No training programs yet. Create your first one!
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
