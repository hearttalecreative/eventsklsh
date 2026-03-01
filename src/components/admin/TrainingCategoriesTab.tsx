import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, GripVertical, Check, ExternalLink } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrainingCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface SortableRowProps {
  category: TrainingCategory;
  onEdit: (cat: TrainingCategory) => void;
  onDelete: (id: string) => void;
  onCopyLink: (cat: TrainingCategory) => void;
  copiedId: string | null;
  programCount: number;
}

function SortableCategoryRow({ category, onEdit, onDelete, onCopyLink, copiedId, programCount }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isCopied = copiedId === category.id;

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted/50' : ''}>
      <TableCell className="w-10">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none" aria-label="Drag to reorder">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{category.slug}</TableCell>
      <TableCell>{programCount}</TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded-full text-xs ${category.active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
          {category.active ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onCopyLink(category)} title="Copy link">
            {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <ExternalLink className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this category? Programs in it will become uncategorized.')) onDelete(category.id); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function TrainingCategoriesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingCategory | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', active: true });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-training-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as TrainingCategory[];
    },
  });

  const { data: programCounts } = useQuery({
    queryKey: ['admin-training-program-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_programs').select('category_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((p: any) => { if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1; });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase.from('training_categories').update({
          name: data.name,
          slug: data.slug || generateSlug(data.name),
          description: data.description || null,
          active: data.active,
        }).eq('id', data.id);
        if (error) throw error;
      } else {
        const maxOrder = categories?.length ? Math.max(...categories.map(c => c.display_order)) : -1;
        const { error } = await supabase.from('training_categories').insert({
          name: data.name,
          slug: data.slug || generateSlug(data.name),
          description: data.description || null,
          active: data.active,
          display_order: maxOrder + 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] });
      toast.success(editing ? 'Category updated' : 'Category created');
      handleCloseDialog();
    },
    onError: (error: any) => toast.error(error.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('training_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-training-programs'] });
      toast.success('Category deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete'),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ordered: { id: string; display_order: number }[]) => {
      const updates = ordered.map(({ id, display_order }) =>
        supabase.from('training_categories').update({ display_order }).eq('id', id)
      );
      const results = await Promise.all(updates);
      if (results.some(r => r.error)) throw new Error('Failed to update order');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] });
      toast.success('Order updated');
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-training-categories'] });
      toast.error('Failed to reorder');
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !categories) return;
    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    const reordered = arrayMove(categories, oldIndex, newIndex);
    queryClient.setQueryData(['admin-training-categories'], reordered);
    reorderMutation.mutate(reordered.map((c, i) => ({ id: c.id, display_order: i })));
  };

  const handleOpenDialog = (cat?: TrainingCategory) => {
    if (cat) {
      setEditing(cat);
      setFormData({ name: cat.name, slug: cat.slug, description: cat.description || '', active: cat.active });
    } else {
      setEditing(null);
      setFormData({ name: '', slug: '', description: '', active: true });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => { setIsDialogOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editing?.id });
  };

  const handleCopyLink = (cat: TrainingCategory) => {
    navigator.clipboard.writeText(`${window.location.origin}/trainings/category/${cat.slug}`);
    setCopiedId(cat.id);
    toast.success('Link copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
              <DialogDescription>{editing ? 'Update category details' : 'Create a new training category'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name *</Label>
                <Input
                  id="cat-name"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(f => ({ ...f, name, slug: editing ? f.slug : generateSlug(name) }));
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-slug">Slug</Label>
                <Input id="cat-slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                <p className="text-xs text-muted-foreground">URL-friendly identifier. Auto-generated from name.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc">Description</Label>
                <Textarea id="cat-desc" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Shown below the category title on the public page" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="cat-active">Active</Label>
                <Switch id="cat-active" checked={formData.active} onCheckedChange={(checked) => setFormData({ ...formData, active: checked })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" /> Drag to reorder categories
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : categories && categories.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Programs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {categories.map((cat) => (
                      <SortableCategoryRow
                        key={cat.id}
                        category={cat}
                        onEdit={handleOpenDialog}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onCopyLink={handleCopyLink}
                        copiedId={copiedId}
                        programCount={programCounts?.[cat.id] || 0}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No categories yet. Create your first one!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
