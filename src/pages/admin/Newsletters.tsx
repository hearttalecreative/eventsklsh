import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Copy,
  GripVertical,
  ImageUp,
  Mail,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import AdminRoute from "@/routes/AdminRoute";
import AdminHeader from "@/components/admin/AdminHeader";
import NewsletterRichTextEditor from "@/components/admin/NewsletterRichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import { buildNewsletterHtml } from "@/lib/newsletter-email";
import {
  NewsletterCustomModule,
  NewsletterDividerModule,
  NewsletterEventItem,
  NewsletterEventsModule,
  NewsletterModule,
  NewsletterRecord,
} from "@/types/newsletter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const createModuleId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `module-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const createCustomModule = (): NewsletterCustomModule => ({
  id: createModuleId(),
  type: "custom",
  title: "",
  imageUrl: "",
  bodyHtml: "",
  buttonText: "Learn More",
  buttonUrl: "",
});

const createEventsModule = (): NewsletterEventsModule => ({
  id: createModuleId(),
  type: "events",
  title: "Upcoming Events",
  eventIds: [],
  maxEvents: 3,
  buttonText: "Get Tickets",
});

const createDividerModule = (): NewsletterDividerModule => ({
  id: createModuleId(),
  type: "divider",
  dividerStyle: "line",
});

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const formatRelativeDate = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const parseModuleList = (raw: unknown): NewsletterModule[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : createModuleId();

      if (row.type === "custom") {
        return {
          id,
          type: "custom",
          title: typeof row.title === "string" ? row.title : "",
          imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : "",
          bodyHtml: typeof row.bodyHtml === "string" ? row.bodyHtml : "",
          buttonText: typeof row.buttonText === "string" ? row.buttonText : "Learn More",
          buttonUrl: typeof row.buttonUrl === "string" ? row.buttonUrl : "",
        } as NewsletterCustomModule;
      }

      if (row.type === "events") {
        return {
          id,
          type: "events",
          title: typeof row.title === "string" ? row.title : "Upcoming Events",
          eventIds: Array.isArray(row.eventIds) ? row.eventIds.filter((v) => typeof v === "string") : [],
          maxEvents:
            typeof row.maxEvents === "number" && Number.isFinite(row.maxEvents)
              ? Math.min(12, Math.max(1, Math.round(row.maxEvents)))
              : 3,
          buttonText: typeof row.buttonText === "string" ? row.buttonText : "Get Tickets",
        } as NewsletterEventsModule;
      }

      if (row.type === "divider") {
        return {
          id,
          type: "divider",
          dividerStyle: row.dividerStyle === "spacer" ? "spacer" : "line",
        } as NewsletterDividerModule;
      }

      return null;
    })
    .filter(Boolean) as NewsletterModule[];
};

interface SortableModuleCardProps {
  moduleId: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onDelete: () => void;
}

const SortableModuleCard = ({ moduleId, title, subtitle, children, onDelete }: SortableModuleCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: moduleId });

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className={isDragging ? "border-primary/40" : ""}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-grab active:cursor-grabbing touch-none"
              aria-label="Drag to reorder module"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </Button>

            <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Delete module">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

const NewslettersPage = () => {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const [newsletters, setNewsletters] = useState<NewsletterRecord[]>([]);
  const [loadingNewsletters, setLoadingNewsletters] = useState(true);
  const [events, setEvents] = useState<NewsletterEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [selectedNewsletterId, setSelectedNewsletterId] = useState<string | null>(null);
  const [newsletterTitle, setNewsletterTitle] = useState("New Newsletter");
  const [newsletterSubject, setNewsletterSubject] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"draft" | "ready">("draft");
  const [modules, setModules] = useState<NewsletterModule[]>([createCustomModule()]);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const previewHtml = useMemo(
    () =>
      buildNewsletterHtml({
        title: newsletterSubject.trim() || newsletterTitle.trim() || "Kyle Lam Sound Healing Newsletter",
        modules,
        events,
        siteUrl: baseUrl,
      }),
    [newsletterSubject, newsletterTitle, modules, events, baseUrl],
  );

  const selectedNewsletter = useMemo(
    () => newsletters.find((item) => item.id === selectedNewsletterId) || null,
    [newsletters, selectedNewsletterId],
  );

  const markDirty = () => {
    setDirty(true);
    setNewsletterStatus("draft");
    setGeneratedHtml("");
  };

  const loadNewsletters = async () => {
    setLoadingNewsletters(true);
    const { data, error } = await supabase
      .from("newsletters")
      .select("id,title,subject,status,content,generated_html,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(error.message || "Failed to load newsletters");
      setLoadingNewsletters(false);
      return;
    }

    const mapped = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      subject: row.subject,
      status: row.status === "ready" ? "ready" : "draft",
      content: parseModuleList(row.content),
      generated_html: row.generated_html,
      updated_at: row.updated_at,
    })) as NewsletterRecord[];

    setNewsletters(mapped);
    setLoadingNewsletters(false);
  };

  const loadEvents = async () => {
    setLoadingEvents(true);
    const { data: eventRows, error: eventError } = await supabase
      .from("events")
      .select(
        "id,title,slug,image_url,starts_at,timezone,external_ticket_url,external_ticket_button_text,venue_id,status,hidden",
      )
      .neq("status", "archived")
      .eq("hidden", false)
      .order("starts_at", { ascending: true });

    if (eventError) {
      toast.error(eventError.message || "Failed to load events for newsletter module");
      setLoadingEvents(false);
      return;
    }

    const venueIds = Array.from(
      new Set((eventRows || []).map((event: any) => event.venue_id).filter(Boolean) as string[]),
    );

    let venuesById = new Map<string, { name: string; address: string | null }>();

    if (venueIds.length > 0) {
      const { data: venueRows } = await supabase.from("venues").select("id,name,address").in("id", venueIds);
      venuesById = new Map((venueRows || []).map((venue: any) => [venue.id, { name: venue.name, address: venue.address }]));
    }

    const mapped = (eventRows || []).map((event: any) => {
      const venue = venuesById.get(event.venue_id);
      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        image_url: event.image_url,
        starts_at: event.starts_at,
        timezone: event.timezone,
        external_ticket_url: event.external_ticket_url,
        external_ticket_button_text: event.external_ticket_button_text,
        venue_name: venue?.name || "Venue TBA",
        venue_address: venue?.address || "",
      } as NewsletterEventItem;
    });

    setEvents(mapped);
    setLoadingEvents(false);
  };

  useEffect(() => {
    loadNewsletters();
    loadEvents();
  }, []);

  const resetToNewNewsletter = () => {
    setSelectedNewsletterId(null);
    setNewsletterTitle("New Newsletter");
    setNewsletterSubject("");
    setNewsletterStatus("draft");
    setModules([createCustomModule()]);
    setGeneratedHtml("");
    setDirty(false);
  };

  const openNewsletter = (record: NewsletterRecord) => {
    setSelectedNewsletterId(record.id);
    setNewsletterTitle(record.title || "Untitled Newsletter");
    setNewsletterSubject(record.subject || "");
    setNewsletterStatus(record.status || "draft");
    setModules(record.content.length > 0 ? record.content : [createCustomModule()]);
    setGeneratedHtml(record.generated_html || "");
    setDirty(false);
  };

  const saveNewsletter = async (explicitStatus?: "draft" | "ready") => {
    const cleanTitle = newsletterTitle.trim() || "Untitled Newsletter";
    const cleanSubject = newsletterSubject.trim();
    const finalStatus = explicitStatus || newsletterStatus;

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const payload = {
        title: cleanTitle,
        subject: cleanSubject ? cleanSubject : null,
        status: finalStatus,
        content: modules,
        generated_html: generatedHtml || null,
        ...(selectedNewsletterId ? {} : { created_by: session?.user?.id || null }),
      };

      let saved: any = null;

      if (selectedNewsletterId) {
        const { data, error } = await supabase
          .from("newsletters")
          .update(payload)
          .eq("id", selectedNewsletterId)
          .select("id,title,subject,status,content,generated_html,updated_at")
          .single();

        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from("newsletters")
          .insert(payload)
          .select("id,title,subject,status,content,generated_html,updated_at")
          .single();

        if (error) throw error;
        saved = data;
      }

      const mappedSaved: NewsletterRecord = {
        id: saved.id,
        title: saved.title,
        subject: saved.subject,
        status: saved.status === "ready" ? "ready" : "draft",
        content: parseModuleList(saved.content),
        generated_html: saved.generated_html,
        updated_at: saved.updated_at,
      };

      setSelectedNewsletterId(mappedSaved.id);
      setNewsletterStatus(mappedSaved.status);
      setDirty(false);

      setNewsletters((prev) => {
        const others = prev.filter((entry) => entry.id !== mappedSaved.id);
        return [mappedSaved, ...others].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
      });

      toast.success(finalStatus === "draft" ? "Newsletter draft saved" : "Newsletter saved as ready");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save newsletter");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNewsletter = async (id: string) => {
    if (!confirm("Delete this newsletter draft? This action cannot be undone.")) {
      return;
    }

    const { error } = await supabase.from("newsletters").delete().eq("id", id);
    if (error) {
      toast.error(error.message || "Failed to delete newsletter");
      return;
    }

    setNewsletters((prev) => prev.filter((entry) => entry.id !== id));
    if (selectedNewsletterId === id) {
      resetToNewNewsletter();
    }

    toast.success("Newsletter deleted");
  };

  const handleGenerateHtml = () => {
    const html = buildNewsletterHtml({
      title: newsletterSubject.trim() || newsletterTitle.trim() || "Kyle Lam Sound Healing Newsletter",
      modules,
      events,
      siteUrl: baseUrl,
    });

    setGeneratedHtml(html);
    setNewsletterStatus("ready");
    setDirty(true);
    toast.success("Newsletter HTML generated");
  };

  const handleCopyHtml = async () => {
    const valueToCopy = generatedHtml || previewHtml;

    try {
      await navigator.clipboard.writeText(valueToCopy);
      toast.success("HTML copied. Ready to paste into Brevo.");
    } catch {
      toast.error("Clipboard copy failed. Please copy manually from the HTML box.");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setModules((current) => {
      const oldIndex = current.findIndex((module) => module.id === active.id);
      const newIndex = current.findIndex((module) => module.id === over.id);

      if (oldIndex < 0 || newIndex < 0) return current;
      markDirty();
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const updateModule = <T extends NewsletterModule["type"]>(
    moduleId: string,
    patch: Partial<Extract<NewsletterModule, { type: T }>>,
  ) => {
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) return module;
        return { ...module, ...patch } as NewsletterModule;
      }),
    );
    markDirty();
  };

  const toggleEventInModule = (moduleId: string, eventId: string, checked: boolean) => {
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId || module.type !== "events") return module;

        const hasEvent = module.eventIds.includes(eventId);
        if (checked && !hasEvent) {
          return { ...module, eventIds: [...module.eventIds, eventId] };
        }

        if (!checked && hasEvent) {
          return { ...module, eventIds: module.eventIds.filter((id) => id !== eventId) };
        }

        return module;
      }),
    );
    markDirty();
  };

  const deleteModule = (moduleId: string) => {
    setModules((current) => {
      const next = current.filter((module) => module.id !== moduleId);
      if (next.length > 0) {
        return next;
      }
      return [createCustomModule()];
    });
    markDirty();
  };

  const uploadModuleImage = async (moduleId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("Image is too large. Max size is 5 MB for email safety.");
      return;
    }

    if (file.size > 1_500_000) {
      toast.warning("Large image uploaded. Consider compressing for better email performance.");
    }

    const extension = file.name.split(".").pop() || "jpg";
    const path = `newsletters/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const { error } = await supabase.storage.from("newsletter-images").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      toast.error(error.message || "Failed to upload image");
      return;
    }

    const { data } = supabase.storage.from("newsletter-images").getPublicUrl(path);
    updateModule<"custom">(moduleId, { imageUrl: data.publicUrl });
    toast.success("Image uploaded");
  };

  return (
    <AdminRoute>
      <AdminHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Helmet>
          <title>Admin Newsletters | Kyle Lam Sound Healing</title>
          <meta
            name="description"
            content="Build branded, email-safe newsletters with drag-and-drop modules and export HTML for Brevo."
          />
          <link rel="canonical" href={`${baseUrl}/admin/newsletters`} />
        </Helmet>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Newsletter Builder</h1>
          <p className="text-muted-foreground">
            Create branded newsletters visually, preview the result, and generate Brevo-ready HTML.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Saved Drafts</CardTitle>
              <CardDescription>Open, continue editing, or remove old drafts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button type="button" className="w-full" onClick={resetToNewNewsletter}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Newsletter
              </Button>

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {loadingNewsletters ? (
                  <p className="text-sm text-muted-foreground">Loading newsletters...</p>
                ) : newsletters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No drafts yet.</p>
                ) : (
                  newsletters.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-md border p-3 transition-colors ${
                        selectedNewsletterId === entry.id ? "border-primary/50 bg-primary/10" : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        className="text-left w-full"
                        onClick={() => openNewsletter(entry)}
                        title={entry.title}
                      >
                        <div className="font-medium text-sm truncate">{entry.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatRelativeDate(entry.updated_at)}</div>
                        <div className="text-[11px] mt-1 text-muted-foreground uppercase tracking-wide">
                          {entry.status === "ready" ? "Ready" : "Draft"}
                        </div>
                      </button>
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive"
                          onClick={() => handleDeleteNewsletter(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Setup</CardTitle>
                <CardDescription>
                  Define the newsletter basics, then add and reorder content modules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="newsletter-title">Internal Title</Label>
                    <Input
                      id="newsletter-title"
                      value={newsletterTitle}
                      onChange={(event) => {
                        setNewsletterTitle(event.target.value);
                        markDirty();
                      }}
                      placeholder="Spring Sound Healing Newsletter"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newsletter-subject">Email Subject / Header Title</Label>
                    <Input
                      id="newsletter-subject"
                      value={newsletterSubject}
                      onChange={(event) => {
                        setNewsletterSubject(event.target.value);
                        markDirty();
                      }}
                      placeholder="Upcoming Events and Sound Healing Updates"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={() => saveNewsletter("draft")} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Draft"}
                  </Button>

                  <Button type="button" variant="secondary" onClick={handleGenerateHtml}>
                    <WandSparkles className="h-4 w-4 mr-2" />
                    Generate HTML
                  </Button>

                  <Button type="button" variant="outline" onClick={handleCopyHtml}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy HTML
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => saveNewsletter(generatedHtml ? "ready" : "draft")}
                    disabled={saving}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Save as {generatedHtml ? "Ready" : "Draft"}
                  </Button>

                  <span className="text-xs text-muted-foreground ml-auto">
                    Status: <strong>{newsletterStatus === "ready" ? "Ready" : "Draft"}</strong>
                    {dirty ? " (unsaved changes)" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Builder</CardTitle>
                <CardDescription>
                  Add custom content blocks, event modules, and optional divider lines. Drag to reorder.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModules((current) => [...current, createCustomModule()]);
                      markDirty();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Block
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModules((current) => [...current, createEventsModule()]);
                      markDirty();
                    }}
                    disabled={loadingEvents}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Events Module
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setModules((current) => [...current, createDividerModule()]);
                      markDirty();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Divider
                  </Button>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={modules.map((module) => module.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                      {modules.map((module, index) => {
                        if (module.type === "custom") {
                          return (
                            <SortableModuleCard
                              key={module.id}
                              moduleId={module.id}
                              title={`Custom Block ${index + 1}`}
                              subtitle="H2, image, rich text, and CTA button"
                              onDelete={() => deleteModule(module.id)}
                            >
                              <div className="space-y-4">
                                <div className="space-y-1.5">
                                  <Label>Title (H2)</Label>
                                  <Input
                                    value={module.title}
                                    onChange={(event) => updateModule<"custom">(module.id, { title: event.target.value })}
                                    placeholder="Section title"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Image</Label>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <label className="inline-flex">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) => {
                                          const file = event.target.files?.[0];
                                          if (!file) return;
                                          uploadModuleImage(module.id, file);
                                          event.currentTarget.value = "";
                                        }}
                                      />
                                      <Button type="button" variant="secondary" asChild>
                                        <span>
                                          <ImageUp className="h-4 w-4 mr-2" />
                                          Upload Image
                                        </span>
                                      </Button>
                                    </label>

                                    <Input
                                      value={module.imageUrl}
                                      onChange={(event) => updateModule<"custom">(module.id, { imageUrl: event.target.value })}
                                      placeholder="Or paste image URL"
                                    />
                                  </div>

                                  {module.imageUrl ? (
                                    <img
                                      src={module.imageUrl}
                                      alt="Block preview"
                                      className="w-full max-w-xl rounded-md border object-cover"
                                    />
                                  ) : null}
                                </div>

                                <div className="space-y-1.5">
                                  <Label>Body Text (Rich Text)</Label>
                                  <NewsletterRichTextEditor
                                    value={module.bodyHtml}
                                    onChange={(value) => {
                                      updateModule<"custom">(module.id, { bodyHtml: value });
                                    }}
                                  />
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <Label>Button Text</Label>
                                    <Input
                                      value={module.buttonText}
                                      onChange={(event) =>
                                        updateModule<"custom">(module.id, { buttonText: event.target.value })
                                      }
                                      placeholder="Learn More"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label>Button URL</Label>
                                    <Input
                                      value={module.buttonUrl}
                                      onChange={(event) =>
                                        updateModule<"custom">(module.id, { buttonUrl: event.target.value })
                                      }
                                      placeholder="https://..."
                                    />
                                  </div>
                                </div>
                              </div>
                            </SortableModuleCard>
                          );
                        }

                        if (module.type === "events") {
                          return (
                            <SortableModuleCard
                              key={module.id}
                              moduleId={module.id}
                              title={`Events Module ${index + 1}`}
                              subtitle="Select existing events and display count"
                              onDelete={() => deleteModule(module.id)}
                            >
                              <div className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="space-y-1.5 md:col-span-2">
                                    <Label>Module Title</Label>
                                    <Input
                                      value={module.title}
                                      onChange={(event) => updateModule<"events">(module.id, { title: event.target.value })}
                                      placeholder="Upcoming Events"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label>How Many Events</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={12}
                                      value={module.maxEvents}
                                      onChange={(event) =>
                                        updateModule<"events">(module.id, {
                                          maxEvents: Math.max(1, Math.min(12, Number(event.target.value) || 1)),
                                        })
                                      }
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <Label>Button Label (fallback)</Label>
                                  <Input
                                    value={module.buttonText}
                                    onChange={(event) => updateModule<"events">(module.id, { buttonText: event.target.value })}
                                    placeholder="Get Tickets"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label>Select Events</Label>
                                  <div className="rounded-md border p-3 max-h-64 overflow-y-auto space-y-2">
                                    {loadingEvents ? (
                                      <p className="text-sm text-muted-foreground">Loading events...</p>
                                    ) : events.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No events available.</p>
                                    ) : (
                                      events.map((event) => {
                                        const checked = module.eventIds.includes(event.id);

                                        return (
                                          <label
                                            key={event.id}
                                            className="flex items-start gap-2 rounded-md border border-border/70 bg-background p-2"
                                          >
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={(value) =>
                                                toggleEventInModule(module.id, event.id, Boolean(value))
                                              }
                                            />
                                            <span className="text-sm leading-relaxed">
                                              <span className="font-medium block">{event.title}</span>
                                              <span className="text-muted-foreground text-xs block">
                                                {formatDateTime(event.starts_at)} | {event.venue_name}
                                              </span>
                                            </span>
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Selected: {module.eventIds.length} event(s). The module will show up to {module.maxEvents}.
                                  </p>
                                </div>
                              </div>
                            </SortableModuleCard>
                          );
                        }

                        return (
                          <SortableModuleCard
                            key={module.id}
                            moduleId={module.id}
                            title={`Divider ${index + 1}`}
                            subtitle="Optional visual separator between sections"
                            onDelete={() => deleteModule(module.id)}
                          >
                            <div className="space-y-1.5 max-w-xs">
                              <Label>Divider Type</Label>
                              <Select
                                value={module.dividerStyle}
                                onValueChange={(value) =>
                                  updateModule<"divider">(module.id, {
                                    dividerStyle: value === "spacer" ? "spacer" : "line",
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select divider style" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="line">Line</SelectItem>
                                  <SelectItem value="spacer">Spacer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </SortableModuleCard>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Newsletter Preview</CardTitle>
                <CardDescription>
                  Responsive preview generated with email-safe HTML and inline styles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={previewMode === "desktop" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="h-4 w-4 mr-1.5" />
                    Desktop
                  </Button>

                  <Button
                    type="button"
                    variant={previewMode === "mobile" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-4 w-4 mr-1.5" />
                    Mobile
                  </Button>
                </div>

                <div className="rounded-md border bg-muted/20 p-3 overflow-x-auto">
                  <div
                    className="mx-auto"
                    style={{
                      width: previewMode === "mobile" ? 390 : "100%",
                      minWidth: previewMode === "mobile" ? 390 : undefined,
                    }}
                  >
                    <iframe
                      title="Newsletter preview"
                      srcDoc={previewHtml}
                      className="w-full rounded-md border bg-white"
                      style={{ height: 820 }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generated HTML</CardTitle>
                <CardDescription>
                  Use this code directly in your Brevo template editor. Generate first, then copy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={generatedHtml}
                  readOnly
                  className="min-h-[260px] font-mono text-xs leading-relaxed"
                  placeholder="Click 'Generate HTML' to produce the final email code"
                />

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={handleGenerateHtml}>
                    <WandSparkles className="h-4 w-4 mr-2" />
                    Regenerate HTML
                  </Button>

                  <Button type="button" variant="outline" onClick={handleCopyHtml}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy HTML
                  </Button>

                  <span className="text-xs text-muted-foreground self-center">
                    {selectedNewsletter
                      ? `Editing: ${selectedNewsletter.title}`
                      : "Editing unsaved newsletter"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </AdminRoute>
  );
};

export default NewslettersPage;
