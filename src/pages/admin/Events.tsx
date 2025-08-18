import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { supabase } from "@/integrations/supabase/client"
import { EventItem } from "@/types/events"
import { ImageIcon, Loader2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import RichMarkdownEditor from "@/components/RichMarkdownEditor"

const formSchema = z.object({
  title: z.string().min(2, {
    message: "El título debe tener al menos 2 caracteres.",
  }),
  slug: z.string().optional(),
  short_description: z.string().min(10, {
    message: "La descripción corta debe tener al menos 10 caracteres.",
  }),
})

export default function EventsAdmin() {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [eTitle, setETitle] = useState('')
  const [eSlug, setESlug] = useState('')
  const [eShort, setEShort] = useState('')
  const [eLong, setELong] = useState('')
  const [eInstructions, setEInstructions] = useState('')
  const [eStarts, setEStarts] = useState('')
  const [eEnds, setEEnds] = useState('')
  const [eVenueId, setEVenueId] = useState<string | undefined>(undefined)
  const [eStatus, setEStatus] = useState<string>('draft')
  const [eImageUrl, setEImageUrl] = useState('')
  const [eImagePreview, setEImagePreview] = useState<string | null>(null)
  const [eImageFile, setEImageFile] = useState<File | null>(null)
  const [eTimezone, setETimezone] = useState('America/Los_Angeles')
  const [venues, setVenues] = useState<{ id: string; name: string; }[] | null>(null)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
      setEvents(data)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadVenues() {
      const { data, error } = await supabase
        .from('venues')
        .select('id,name')
        .order('name')
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
      setVenues(data)
    }
    loadVenues()
  }, [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      short_description: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .insert([values])
        .select()
      if (error) {
        throw error
      }
      setEvents(prev => [...(prev || []), ...data])
      toast({
        title: "Evento creado",
        description: "El evento se ha creado correctamente.",
      })
      form.reset()
      setOpen(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
      if (error) {
        throw error
      }
      setEvents(prev => prev?.filter(e => e.id !== id) || null)
      toast({
        title: "Evento eliminado",
        description: "El evento se ha eliminado correctamente.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (ev: EventItem) => {
    setEditingEvent(ev);
    setETitle(ev.title);
    setESlug(ev.slug || '');
    setEShort(ev.short_description || '');
    setELong(ev.description || '');
    setEInstructions(ev.instructions || '');
    
    // Improved date/time handling with proper timezone consideration
    const formatDateTimeForInput = (isoString: string, timezone: string = 'America/Los_Angeles') => {
      const date = new Date(isoString);
      // Convert to local time for editing
      const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
      return localDate.toISOString().slice(0, 16);
    };
    
    setEStarts(ev.starts_at ? formatDateTimeForInput(ev.starts_at, ev.timezone) : '');
    setEEnds(ev.ends_at ? formatDateTimeForInput(ev.ends_at, ev.timezone) : '');
    setEVenueId(ev.venue_id || undefined);
    setEStatus(ev.status || 'draft');
    setEImageUrl(ev.image_url || '');
    setEImagePreview(null); // Reset image preview
    setEImageFile(null); // Reset file input
    setETimezone((ev as any).timezone || 'America/Los_Angeles');
    setEditOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setEImageFile(null);
    setEImagePreview(null);
    setEImageUrl('');
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    setLoading(true);

    try {
      let finalImageUrl = eImageUrl;

      // Handle image upload if there's a new file
      if (eImageFile) {
        const fileExt = eImageFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `event-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(filePath, eImageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrl;
      }

      // Improved date handling to preserve the exact time entered
      const formatDateTimeForSave = (dateTimeLocal: string, timezone: string) => {
        if (!dateTimeLocal) return null;
        // Create date object from the local datetime input
        const localDate = new Date(dateTimeLocal);
        // Return as ISO string (this preserves the time as entered)
        return localDate.toISOString();
      };

      const payload = {
        title: eTitle,
        slug: eSlug || null,
        short_description: eShort,
        description: eLong || null,
        instructions: eInstructions || null,
        starts_at: formatDateTimeForSave(eStarts, eTimezone),
        ends_at: formatDateTimeForSave(eEnds, eTimezone),
        venue_id: eVenueId || null,
        status: eStatus as any,
        image_url: finalImageUrl || null,
        timezone: eTimezone,
      };

      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', editingEvent.id)
        .select('*')
        .single();

      if (error) throw error;

      // Update the local state
      setEvents(prev => prev?.map(e => e.id === editingEvent.id ? {
        ...e,
        ...payload,
        starts_at: payload.starts_at!,
        ends_at: payload.ends_at!,
        image_url: payload.image_url!
      } : e) || null);

      setEditOpen(false);
      toast({
        title: "Evento actualizado",
        description: "El evento se ha actualizado correctamente.",
      });
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el evento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Eventos</h2>
          <p className="text-muted-foreground">
            Aquí puedes administrar los eventos.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Crear Evento</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Crear Evento</DialogTitle>
                <DialogDescription>
                  Crea un nuevo evento para mostrarlo en la página principal.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Título del evento" {...field} />
                        </FormControl>
                        <FormDescription>
                          Este es el título que se mostrará en la página principal.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="Slug del evento" {...field} />
                        </FormControl>
                        <FormDescription>
                          Este es el slug que se usará en la URL del evento.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="short_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción Corta</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Descripción corta del evento"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Esta es la descripción corta que se mostrará en la página
                          principal.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        Creando...
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      </>
                    ) : (
                      "Crear"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="py-4">
        <Table>
          <TableCaption>
            Lista de eventos.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Id</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Descripción Corta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events?.map(event => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.id}</TableCell>
                <TableCell>{event.title}</TableCell>
                <TableCell>{event.slug}</TableCell>
                <TableCell>{event.short_description}</TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => handleEdit(event)}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id)}>
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                {events?.length} Eventos en total
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[80%] max-h-[90vh] overflow-y-scroll">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>
              Edita el evento para mostrarlo en la página principal.
            </DialogDescription>
          </DialogHeader>
          <div>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Título
                </Label>
                <Input id="name" value={eTitle} onChange={(e) => setETitle(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="slug" className="text-right">
                  Slug
                </Label>
                <Input id="slug" value={eSlug} onChange={(e) => setESlug(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="short" className="text-right">
                  Descripción Corta
                </Label>
                <Input id="short" value={eShort} onChange={(e) => setEShort(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="long" className="text-right mt-2">
                  Descripción Larga
                </Label>
                <div className="col-span-3">
                  <RichMarkdownEditor value={eLong} onChange={setELong} />
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="instructions" className="text-right mt-2">
                  Instrucciones
                </Label>
                <div className="col-span-3">
                  <Textarea id="instructions" value={eInstructions} onChange={(e) => setEInstructions(e.target.value)} className="min-h-[100px]" />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="starts" className="text-right">
                  Fecha de Inicio
                </Label>
                <Input
                  type="datetime-local"
                  id="starts"
                  value={eStarts}
                  onChange={(e) => setEStarts(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ends" className="text-right">
                  Fecha de Fin
                </Label>
                <Input
                  type="datetime-local"
                  id="ends"
                  value={eEnds}
                  onChange={(e) => setEEnds(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="venue" className="text-right">
                  Venue
                </Label>
                <Select value={eVenueId} onValueChange={setEVenueId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues?.map(venue => (
                      <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select value={eStatus} onValueChange={setEStatus}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona un status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="timezone" className="text-right">
                  Timezone
                </Label>
                <Input id="timezone" value={eTimezone} onChange={(e) => setETimezone(e.target.value)} className="col-span-3" />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="image" className="text-right">
                  Imagen
                </Label>
                <div className="col-span-3">
                  <Input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <Button variant="outline" asChild>
                    <label htmlFor="image" className="cursor-pointer">
                      {eImageFile ? 'Cambiar Imagen' : 'Subir Imagen'}
                    </label>
                  </Button>
                  {eImagePreview && (
                    <div className="relative mt-2">
                      <img
                        src={eImagePreview}
                        alt="Preview"
                        className="max-h-40 rounded-md object-cover"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 rounded-full"
                        onClick={handleRemoveImage}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSaveEdit} disabled={loading}>
              {loading ? (
                <>
                  Guardando...
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
