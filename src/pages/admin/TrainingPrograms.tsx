import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminHeader from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  original_price_cents: number | null;
  processing_fee_percent: number;
  is_bundle: boolean;
  display_order: number;
  active: boolean;
  available_from: string | null;
  available_to: string | null;
  related_training_ids: string[] | null;
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
  onCopyLink: (program: TrainingProgram) => void;
  copiedId: string | null;
}

function SortableRow({ program, onEdit, onDelete, onCopyLink, copiedId }: SortableRowProps) {
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

  const isCopied = copiedId === program.id;

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
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCopyLink(program)}
            title="Copy direct link"
          >
            {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <ExternalLink className="h-4 w-4" />}
          </Button>
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
  const [copiedProgramId, setCopiedProgramId] = useState<string | null>(null);
  const [savingsMessageInput, setSavingsMessageInput] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_cents: '',
    original_price_cents: '',
    processing_fee_percent: '3.5',
    is_bundle: false,
    active: true,
    available_from: '',
    available_to: '',
    related_training_ids: [] as string[],
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

  // Fetch global savings message setting
  const { data: savingsMessageSetting } = useQuery({
    queryKey: ['app-settings', 'training_savings_message'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'training_savings_message')
        .single();
      
      if (error) return { id: 'training_savings_message', value: 'Save {amount} with our special sale now.', description: '' };
      return data;
    },
  });

  // Set initial value for savings message input
  useEffect(() => {
    if (savingsMessageSetting?.value && savingsMessageInput === '') {
      setSavingsMessageInput(savingsMessageSetting.value);
    }
  }, [savingsMessageSetting]);

  const savingsMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          id: 'training_savings_message', 
          value: message,
          description: 'Message shown below training/bundle prices when there is a discount. Use {amount} as placeholder for the savings amount.'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'training_savings_message'] });
      toast.success('Savings message updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update message');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const maxOrder = programs?.length ? Math.max(...programs.map(p => p.display_order)) : -1;
      
      const payload = {
        name: data.name,
        description: data.description || null,
        price_cents: Math.round(parseFloat(data.price_cents) * 100),
        original_price_cents: data.original_price_cents ? Math.round(parseFloat(data.original_price_cents) * 100) : null,
        processing_fee_percent: parseFloat(data.processing_fee_percent) || 3.5,
        is_bundle: data.is_bundle,
        active: data.active,
        available_from: data.available_from || null,
        available_to: data.available_to || null,
        related_training_ids: data.is_bundle ? [] : (data.related_training_ids || []),
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
        original_price_cents: program.original_price_cents ? formatPrice(program.original_price_cents) : '',
        processing_fee_percent: program.processing_fee_percent.toString(),
        is_bundle: program.is_bundle,
        active: program.active,
        available_from: program.available_from || '',
        available_to: program.available_to || '',
        related_training_ids: program.related_training_ids || [],
      });
    } else {
      setEditingProgram(null);
      setFormData({
        name: '',
        description: '',
        price_cents: '',
        original_price_cents: '',
        processing_fee_percent: '3.5',
        is_bundle: false,
        active: true,
        available_from: '',
        available_to: '',
        related_training_ids: [],
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

  const handleCopyProgramLink = (program: TrainingProgram) => {
    const directUrl = `${window.location.origin}/trainings?program=${program.id}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedProgramId(program.id);
    toast.success(`Direct link for "${program.name}" copied`);
    setTimeout(() => setCopiedProgramId(null), 2000);
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
                      <Label htmlFor="price">Sale Price ($) *</Label>
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
                      <Label htmlFor="original_price">Original Price ($)</Label>
                      <Input
                        id="original_price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Leave empty if no discount"
                        value={formData.original_price_cents}
                        onChange={(e) => setFormData({ ...formData, original_price_cents: e.target.value })}
                      />
                    </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="available_from">Available From</Label>
                      <Input
                        id="available_from"
                        type="date"
                        value={formData.available_from}
                        onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="available_to">Available To</Label>
                      <Input
                        id="available_to"
                        type="date"
                        value={formData.available_to}
                        onChange={(e) => setFormData({ ...formData, available_to: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set date range to limit when users can book this training. Leave empty for no restrictions.
                  </p>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_bundle">Is Bundle?</Label>
                    <Switch
                      id="is_bundle"
                      checked={formData.is_bundle}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_bundle: checked, related_training_ids: checked ? [] : formData.related_training_ids })}
                    />
                  </div>
                  
                  {/* Related Trainings - Only for non-bundles */}
                  {!formData.is_bundle && (
                    <div className="space-y-2">
                      <Label>Related Trainings</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Select trainings to display as "Want to learn about..." links on this program's sales page.
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {programs?.filter(p => !p.is_bundle && p.id !== editingProgram?.id).map(program => (
                          <div key={program.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`related-${program.id}`}
                              checked={formData.related_training_ids.includes(program.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({ ...formData, related_training_ids: [...formData.related_training_ids, program.id] });
                                } else {
                                  setFormData({ ...formData, related_training_ids: formData.related_training_ids.filter(id => id !== program.id) });
                                }
                              }}
                            />
                            <label
                              htmlFor={`related-${program.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {program.name}
                            </label>
                          </div>
                        ))}
                        {programs?.filter(p => !p.is_bundle && p.id !== editingProgram?.id).length === 0 && (
                          <p className="text-xs text-muted-foreground">No other trainings available to link.</p>
                        )}
                      </div>
                    </div>
                  )}
                  
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

          {/* Savings Message Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Savings Message</CardTitle>
              <CardDescription>
                Customize the text shown below prices when there's a discount. Use <code className="bg-muted px-1 rounded">{'{amount}'}</code> as a placeholder for the savings amount.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input 
                  value={savingsMessageInput}
                  onChange={(e) => setSavingsMessageInput(e.target.value)}
                  placeholder="Save {amount} with our special sale now."
                  className="flex-1"
                />
                <Button 
                  onClick={() => savingsMessageMutation.mutate(savingsMessageInput)}
                  disabled={savingsMessageMutation.isPending || savingsMessageInput === savingsMessageSetting?.value}
                >
                  {savingsMessageMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Preview: {savingsMessageInput.replace('{amount}', '$100')}
              </p>
            </CardContent>
          </Card>

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
                            onCopyLink={handleCopyProgramLink}
                            copiedId={copiedProgramId}
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
