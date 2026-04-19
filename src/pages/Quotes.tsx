import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import QuoteItemCommercialFields from "@/components/quotes/QuoteItemCommercialFields";
import QuoteItemSupplierFields from "@/components/quotes/QuoteItemSupplierFields";
import QuoteItemAttachments from "@/components/quotes/QuoteItemAttachments";
import QuoteOptionsManager from "@/components/quotes/QuoteOptionsManager";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Table as TableIcon, ArrowUp, ArrowDown, ArrowUpDown, ArrowLeft, Plus, Trash2, Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, CalendarDays, Image as ImageIcon, X, ChevronsUpDown, Check, ExternalLink, Copy, Wand2, Loader2, Info, CalendarIcon, History, ChevronDown, ChevronRight, Backpack, BriefcaseBusiness, Luggage, MessageCircle, FileText, MoreVertical, ClipboardCopy, Search, Archive, ArchiveRestore, TrendingUp, DollarSign, Target } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildQuoteSummary, pickClientWhatsappNumber } from "@/lib/quote-summary";
import { Dialog as WhatsAppDialog, DialogContent as WhatsAppDialogContent, DialogHeader as WhatsAppDialogHeader, DialogTitle as WhatsAppDialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PhoneInput, formatBrazilPhone, stripBrazilPhone } from "@/components/ui/phone-input";
import { KanbanSkeleton, TableSkeleton } from "@/components/ui/loading-skeletons";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import QuoteHistoryTab from "@/components/quotes/QuoteHistoryTab";
import QuoteInteractionsTab from "@/components/quotes/QuoteInteractionsTab";
import { QuoteCardBadges, ProbabilityBadge, PROBABILITY_OPTIONS } from "@/components/quotes/QuoteCardBadges";
import ItineraryTimeline from "@/components/itineraries/ItineraryTimeline";
import ItineraryMapView from "@/components/itineraries/ItineraryMapView";

const stages = [
  { id: "new", label: "Nova Cotação", color: "bg-soft-blue" },
  { id: "sent", label: "Cotação Enviada", color: "bg-gold" },
  { id: "negotiation", label: "Negociação", color: "bg-warning" },
  { id: "confirmed", label: "Concluída", color: "bg-muted-foreground" },
];

const LEAD_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "site", label: "Site" },
  { value: "indication", label: "Indicação" },
  { value: "other", label: "Outro" },
];
const LEAD_SOURCE_LABEL: Record<string, string> = LEAD_SOURCE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }), {} as Record<string, string>,
);

const ITEM_TYPES = [
  { id: "flight", label: "Voos", icon: Plane },
  { id: "hotel", label: "Hospedagem", icon: Hotel },
  { id: "transport", label: "Transporte", icon: Bus },
  { id: "cruise", label: "Cruzeiro", icon: Ship },
  { id: "experience", label: "Experiências", icon: Sparkles },
  { id: "insurance", label: "Seguros", icon: Shield },
  { id: "other_service", label: "Outros Serviços", icon: Package },
];

type Quote = {
  id: string;
  title: string | null;
  client_id: string | null;
  cover_image_url: string | null;
  details: string | null;
  payment_terms: string | null;
  terms_conditions: string | null;
  other_info: string | null;
  destination: string | null;
  total_value: number | null;
  stage: string;
  conclusion_type: string | null;
  created_at: string;
  updated_at?: string | null;
  client_name?: string;
  travel_date_start: string | null;
  travel_date_end: string | null;
  notes: string | null;
  lead_source?: string | null;
  assigned_to?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  is_template?: boolean | null;
  close_probability?: string | null;
  internal_due_date?: string | null;
  quote_validity?: string | null;
};

type QuoteItem = {
  id?: string;
  item_type: string;
  title: string;
  description: string;
  details: Record<string, any>;
  sort_order: number;
  _isNew?: boolean;
  // Commercial fields (real columns in quote_items)
  unit_cost?: number | null;
  unit_price?: number | null;
  quantity?: number | null;
  supplier_id?: string | null;
  payment_source?: string | null;
  commission_amount?: number | null;
  commission_status?: string | null;
  attachment_urls?: string[] | null;
  external_url?: string | null;
  // Option grouping fields
  option_group?: string | null;
  option_label?: string | null;
  option_order?: number | null;
  is_recommended?: boolean;
  is_selected?: boolean;
};

const QUOTE_EDITOR_DRAFT_KEY = "quotes-editor-draft";

type QuoteEditorDraft = {
  dialogOpen: boolean;
  editingQuote: Quote | null;
  form: Record<string, any>;
  items: QuoteItem[];
  activeTab: string;
  selectedPassengers: string[];
  selectedLinkedClients: string[];
  clientSelfTraveling: boolean;
  selectedDestinations: string[];
  coverPreview: string | null;
};

export default function Quotes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [activeTab, setActiveTab] = useState("main");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [selectedLinkedClients, setSelectedLinkedClients] = useState<string[]>([]);
  const [clientSelfTraveling, setClientSelfTraveling] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingDetails, setGeneratingDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [destOpen, setDestOpen] = useState(false);
  const [collapsedFlights, setCollapsedFlights] = useState<Set<number>>(new Set());
  const [coverZoom, setCoverZoom] = useState(false);
  const hotelAutocompleteRefs = useRef<Map<string, any>>(new Map());
  const hotelMapsLoaded = useRef(false);
  const [draggedQuoteId, setDraggedQuoteId] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappQuoteId, setWhatsappQuoteId] = useState<string | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [summaryFallbackText, setSummaryFallbackText] = useState<string | null>(null);
  const initialSnapshotRef = useRef<string>("");

  // Pipeline filters / search / sort / archive view
  const navigate = useNavigate();
  const location = useLocation();
  const [showArchived, setShowArchived] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterLeadSource, setFilterLeadSource] = useState<string>("all");
  const [pipelineSort, setPipelineSort] = useState<"recent" | "oldest" | "value_desc" | "value_asc" | "updated">("recent");
  const [archiveTarget, setArchiveTarget] = useState<Quote | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<Quote | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes", showArchived],
    queryFn: async () => {
      let query = supabase
        .from("quotes")
        .select("*, clients(full_name)")
        .eq("is_template", false)
        .order("created_at", { ascending: false });
      if (showArchived) {
        query = query.not("archived_at", "is", null);
      } else {
        query = query.is("archived_at", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((q: any) => ({ ...q, client_name: q.clients?.full_name ?? "Sem cliente" }));
    },
  });

  // Active (non-archived, non-template) quotes for global metrics — independent of filters/search
  const { data: metricsQuotes = [] } = useQuery({
    queryKey: ["quotes-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, stage, total_value, conclusion_type, archived_at, is_template")
        .eq("is_template", false)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sellers list for the assignee filter
  const { data: sellers = [] } = useQuery({
    queryKey: ["profiles-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name, phone, seat_preference, preferred_airports, travel_profile, travel_preferences, desired_destinations").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch destinations from cities, countries, and custom destinations
  const { data: citiesRaw = [] } = useQuery({
    queryKey: ["cities-for-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name, countries(name)").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: countriesRaw = [] } = useQuery({
    queryKey: ["countries-for-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customDestinations = [] } = useQuery({
    queryKey: ["custom-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_destinations").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const allDestinations = useMemo(() => {
    const items: { label: string; value: string; group: string }[] = [];
    customDestinations.forEach((d: any) => items.push({ label: d.name, value: d.name, group: "Destinos" }));
    countriesRaw.forEach((c: any) => items.push({ label: c.name, value: c.name, group: "Países" }));
    citiesRaw.forEach((c: any) => {
      const country = (c as any).countries?.name ?? "";
      items.push({ label: `${c.name}${country ? `, ${country}` : ""}`, value: `${c.name}${country ? `, ${country}` : ""}`, group: "Cidades" });
    });
    return items;
  }, [citiesRaw, countriesRaw, customDestinations]);

  // Fetch airports for flight origin/destination
  const { data: airports = [] } = useQuery({
    queryKey: ["airports-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airports").select("id, iata_code, name, city, country").order("iata_code");
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        ...a,
        label: `${a.iata_code} - ${a.name} (${a.city}, ${a.country})`,
        value: `${a.iata_code} - ${a.name}`,
      }));
    },
  });

  // Fetch airlines for flight companhia field
  const { data: airlinesData = [] } = useQuery({
    queryKey: ["airlines-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airlines").select("id, name, iata_code").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedClientId = form.client_id;
  const { data: clientPassengers = [] } = useQuery({
    queryKey: ["client-passengers", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("passengers")
        .select("id, full_name, relationship_type")
        .eq("client_id", selectedClientId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch linked clients (relationships)
  const { data: linkedClients = [] } = useQuery({
    queryKey: ["client-relationships", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_relationships")
        .select("*, client_a:clients!client_relationships_client_id_a_fkey(id, full_name, seat_preference, preferred_airports, travel_profile, travel_preferences, desired_destinations), client_b:clients!client_relationships_client_id_b_fkey(id, full_name, seat_preference, preferred_airports, travel_profile, travel_preferences, desired_destinations)")
        .or(`client_id_a.eq.${selectedClientId},client_id_b.eq.${selectedClientId}`);
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const isA = r.client_id_a === selectedClientId;
        const other = isA ? r.client_b : r.client_a;
        return {
          id: other?.id,
          full_name: other?.full_name,
          relationship_type: r.relationship_type,
          seat_preference: other?.seat_preference,
          preferred_airports: other?.preferred_airports,
          travel_profile: other?.travel_profile,
          travel_preferences: other?.travel_preferences,
          desired_destinations: other?.desired_destinations,
        };
      });
    },
  });

  // Fetch itinerary linked to current quote
  const currentQuoteId = editingQuote?.id;
  const { data: linkedItinerary, refetch: refetchLinkedItinerary } = useQuery({
    queryKey: ["quote-itinerary", currentQuoteId],
    enabled: !!currentQuoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itineraries")
        .select("id, title, destination, travel_date_start, travel_date_end")
        .eq("quote_id", currentQuoteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all itineraries for association picker
  const { data: allItineraries = [] } = useQuery({
    queryKey: ["itineraries-for-link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itineraries")
        .select("id, title, destination, quote_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [itineraryLinkOpen, setItineraryLinkOpen] = useState(false);

  useEffect(() => {
    try {
      const storedDraft = localStorage.getItem(QUOTE_EDITOR_DRAFT_KEY);
      if (!storedDraft) {
        setDraftRestored(true);
        return;
      }

      const draft = JSON.parse(storedDraft) as QuoteEditorDraft;
      if (!draft?.dialogOpen) {
        setDraftRestored(true);
        return;
      }

      setDialogOpen(true);
      setEditingQuote(draft.editingQuote ?? null);
      setForm(draft.form ?? {});
      setItems((draft.items ?? []).map((item) => ({ ...item, details: item.details ?? {} })));
      setActiveTab(draft.activeTab || "main");
      setSelectedPassengers(draft.selectedPassengers ?? []);
      setSelectedLinkedClients(draft.selectedLinkedClients ?? []);
      setClientSelfTraveling(!!draft.clientSelfTraveling);
      setSelectedDestinations(draft.selectedDestinations ?? []);
      setCoverPreview(draft.coverPreview ?? null);
    } catch {
      localStorage.removeItem(QUOTE_EDITOR_DRAFT_KEY);
    } finally {
      setDraftRestored(true);
    }
  }, []);

  const persistQuoteEditorDraft = useCallback(() => {
    try {
      if (!dialogOpen) {
        localStorage.removeItem(QUOTE_EDITOR_DRAFT_KEY);
        return;
      }

      const draft: QuoteEditorDraft = {
        dialogOpen,
        editingQuote,
        form,
        items,
        activeTab,
        selectedPassengers,
        selectedLinkedClients,
        clientSelfTraveling,
        selectedDestinations,
        coverPreview,
      };

      localStorage.setItem(QUOTE_EDITOR_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore persistence errors
    }
  }, [dialogOpen, editingQuote, form, items, activeTab, selectedPassengers, selectedLinkedClients, clientSelfTraveling, selectedDestinations, coverPreview]);

  useEffect(() => {
    if (!draftRestored) return;
    const timer = window.setTimeout(() => {
      persistQuoteEditorDraft();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [draftRestored, persistQuoteEditorDraft]);

  useEffect(() => {
    if (!draftRestored) return;

    const saveDraft = () => persistQuoteEditorDraft();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        persistQuoteEditorDraft();
      }
    };

    window.addEventListener("beforeunload", saveDraft);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", saveDraft);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [draftRestored, persistQuoteEditorDraft]);

  // Google Places Autocomplete for hotel address fields
  useEffect(() => {
    if (activeTab !== "hotel" || !dialogOpen) return;

    const loadAndAttach = async () => {
      // Load Google Maps if not loaded yet
      if (!hotelMapsLoaded.current && !(window as any).google?.maps?.places) {
        try {
          const { data } = await supabase.functions.invoke("get-maps-key");
          const apiKey = data?.key;
          if (!apiKey) return;
          if (!(window as any).google?.maps) {
            await new Promise<void>((resolve) => {
              (window as any).__hotelMapsInit = () => { resolve(); };
              const script = document.createElement("script");
              script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__hotelMapsInit&libraries=places`;
              script.async = true;
              document.head.appendChild(script);
            });
          }
          hotelMapsLoaded.current = true;
        } catch { return; }
      }

      // Attach autocomplete to each hotel address input
      const hotelItems = items.filter(i => i.item_type === "hotel");
      hotelItems.forEach((item) => {
        const globalIdx = items.indexOf(item);
        const inputId = `hotel-address-${globalIdx}`;
        const inputEl = document.getElementById(inputId) as HTMLInputElement | null;
        if (!inputEl || hotelAutocompleteRefs.current.has(inputId)) return;

        const autocomplete = new (window as any).google.maps.places.Autocomplete(inputEl, {
          types: ["establishment", "geocode"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place) return;
          const addr = place.formatted_address || place.name || "";
          const newDetails = { ...items[globalIdx].details, address: addr };
          const updated = [...items];
          updated[globalIdx] = { ...updated[globalIdx], details: newDetails };
          setItems(updated);
        });
        hotelAutocompleteRefs.current.set(inputId, autocomplete);
      });
    };

    const timer = setTimeout(loadAndAttach, 300);
    return () => clearTimeout(timer);
  }, [activeTab, dialogOpen, items]);

  // Capture initial snapshot when editing an existing quote (after data is hydrated)
  useEffect(() => {
    if (!dialogOpen || !editingQuote) return;
    // wait a tick so items / passengers / linkedClients have settled
    const t = window.setTimeout(() => {
      initialSnapshotRef.current = JSON.stringify({
        form,
        items,
        selectedPassengers,
        selectedLinkedClients,
        clientSelfTraveling,
        selectedDestinations,
        coverPreview,
      });
    }, 400);
    return () => window.clearTimeout(t);
    // we intentionally only depend on editingQuote.id and dialogOpen — snapshot once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, editingQuote?.id]);

  // Keyboard shortcut: Ctrl/Cmd+S to save inside the quote editor
  const saveQuoteRef = useRef<((closeAfter: boolean) => Promise<string | null>) | null>(null);
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
      if (isSave) {
        e.preventDefault();
        saveQuoteRef.current?.(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  // Load existing quote items when editing
  useEffect(() => {
    if (editingQuote && !draftRestored) return;

    if (editingQuote && items.length === 0) {
      supabase.from("quote_items").select("*").eq("quote_id", editingQuote.id).order("sort_order").then(({ data }) => {
        const loadedItems = (data ?? []).map((i: any) => ({ ...i, details: i.details ?? {} }));
        setItems((current) => current.length > 0 ? current : loadedItems);
        const flightIndices = new Set<number>();
        loadedItems.forEach((it: any, idx: number) => { if (it.item_type === "flight") flightIndices.add(idx); });
        setCollapsedFlights(flightIndices);
      });
      supabase.from("quote_passengers").select("passenger_id").eq("quote_id", editingQuote.id).then(({ data }) => {
        setSelectedPassengers((current) => current.length > 0 ? current : (data ?? []).map((p: any) => p.passenger_id));
      });
      const pb = (editingQuote as any).price_breakdown;
      if (pb && typeof pb === 'object') {
        if (Array.isArray((pb as any).linked_client_ids)) {
          setSelectedLinkedClients((current) => current.length > 0 ? current : (pb as any).linked_client_ids);
        }
        setClientSelfTraveling((current) => current || !!(pb as any).client_self_traveling);
      }
    }
  }, [editingQuote, draftRestored, items.length]);

  const uploadCoverImage = async (quoteId: string): Promise<string | null> => {
    if (!coverFile) return form.cover_image_url || null;
    const ext = coverFile.name.split(".").pop();
    const path = `${quoteId}/cover.${ext}`;
    const { error } = await supabase.storage.from("quote-images").upload(path, coverFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("quote-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const generateCoverWithAI = async () => {
    const destination = form.destination || form.title;
    if (!destination) {
      toast({ title: "Preencha o destino ou título antes de gerar a imagem", variant: "destructive" });
      return;
    }
    setGeneratingCover(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-image", {
        body: { destination, quoteId: editingQuote?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Always use base64 for immediate preview
      const previewSrc = data.base64 || data.imageUrl;
      if (previewSrc) {
        setCoverPreview(previewSrc);
        if (data.imageUrl) {
          // Add cache-buster to storage URL
          const cacheBustedUrl = `${data.imageUrl}?t=${Date.now()}`;
          setForm((f: any) => ({ ...f, cover_image_url: cacheBustedUrl }));
          setCoverFile(null);
        } else if (data.base64) {
          // Convert base64 to File for upload
          const res = await fetch(data.base64);
          const blob = await res.blob();
          const file = new File([blob], "cover-ai.png", { type: "image/png" });
          setCoverFile(file);
        }
        toast({ title: "Imagem gerada com sucesso!" });
      }
    } catch (e: any) {
      console.error("AI cover error:", e);
      toast({ title: e.message || "Erro ao gerar imagem", variant: "destructive" });
    } finally {
      setGeneratingCover(false);
    }
  };

  const logHistory = async (quoteId: string, action: string, description: string, details?: Record<string, any>) => {
    let userName = user?.email ?? "Sistema";
    try {
      if (user?.id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
        if (profile?.full_name) userName = profile.full_name;
      }
    } catch {}
    await supabase.from("quote_history").insert({
      quote_id: quoteId,
      user_id: user?.id ?? null,
      user_name: userName,
      action,
      description,
      details: details ?? {},
    });
  };

  const saveQuote = async (closeAfter: boolean): Promise<string | null> => {
    try {
      const stage = form.stage || "new";
      const conclusion_type = stage === "confirmed" ? (form.conclusion_type || "won") : null;

      let quoteId = editingQuote?.id;

      const payload: any = {
        title: form.title || null,
        client_id: form.client_id || null,
        details: form.details || null,
        payment_terms: form.payment_terms || null,
        terms_conditions: form.terms_conditions || null,
        other_info: form.other_info || null,
        destination: selectedDestinations.length > 0 ? selectedDestinations.join(", ") : null,
        total_value: form.total_value ? Number(form.total_value) : 0,
        discount_amount: form.discount_amount ? Number(form.discount_amount) : 0,
        discount_percent: form.discount_percent ? Number(form.discount_percent) : 0,
        stage,
        conclusion_type,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        notes: form.notes || null,
        lead_source: form.lead_source || null,
        price_breakdown: { linked_client_ids: selectedLinkedClients, client_self_traveling: clientSelfTraveling, flexible_dates: !!form.flexible_dates, flexible_dates_description: form.flexible_dates_description || null },
      };

      if (editingQuote) {
        const coverUrl = await uploadCoverImage(editingQuote.id);
        payload.cover_image_url = coverUrl;
        const { error } = await supabase.from("quotes").update(payload).eq("id", editingQuote.id);
        if (error) throw error;

        // Log changes
        const changedFields: Record<string, any> = {};
        const fieldLabels: Record<string, string> = {
          title: "Título", client_id: "Cliente", destination: "Destino", total_value: "Valor",
          stage: "Etapa", details: "Detalhes", payment_terms: "Pagamento", terms_conditions: "Termos",
          other_info: "Outras Info", travel_date_start: "Data Início", travel_date_end: "Data Fim",
          notes: "Observações", conclusion_type: "Resultado", cover_image_url: "Imagem de Capa",
        };
        for (const key of Object.keys(fieldLabels)) {
          const oldVal = (editingQuote as any)[key] ?? null;
          const newVal = payload[key] ?? null;
          if (String(oldVal) !== String(newVal)) changedFields[fieldLabels[key]] = { de: oldVal, para: newVal };
        }

        if (editingQuote.stage !== stage) {
          const oldStage = stages.find(s => s.id === editingQuote.stage)?.label ?? editingQuote.stage;
          const newStage = stages.find(s => s.id === stage)?.label ?? stage;
          await logHistory(editingQuote.id, "stage_change", `Etapa alterada de "${oldStage}" para "${newStage}"`);
        } else if (Object.keys(changedFields).length > 0) {
          const fieldNames = Object.keys(changedFields).join(", ");
          await logHistory(editingQuote.id, "updated", `Campos alterados: ${fieldNames}`, changedFields);
        }

        if (stage === "confirmed" && conclusion_type === "won" && editingQuote.stage !== "confirmed") {
          await createSaleFromQuote(editingQuote.id, payload);
        }
      } else {
        const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
        if (error) throw error;
        quoteId = data.id;
        const coverUrl = await uploadCoverImage(data.id);
        if (coverUrl) {
          await supabase.from("quotes").update({ cover_image_url: coverUrl }).eq("id", data.id);
        }
        await logHistory(data.id, "created", "Cotação criada");
        if (stage === "confirmed" && conclusion_type === "won") {
          await createSaleFromQuote(data.id, payload);
        }
      }

      // Save quote items
      if (quoteId) {
        // Delete removed items
        const existingIds = items.filter(i => i.id && !i._isNew).map(i => i.id!);
        const { data: dbItems } = await supabase.from("quote_items").select("id").eq("quote_id", quoteId);
        const toDelete = (dbItems ?? []).filter(d => !existingIds.includes(d.id)).map(d => d.id);
        if (toDelete.length) await supabase.from("quote_items").delete().in("id", toDelete);

        // Auto-correct: ensure exactly one is_recommended per option_group
        const groupMap = new Map<string, number[]>();
        items.forEach((it, idx) => {
          if (it.option_group) {
            if (!groupMap.has(it.option_group)) groupMap.set(it.option_group, []);
            groupMap.get(it.option_group)!.push(idx);
          }
        });
        groupMap.forEach((indices) => {
          const sorted = [...indices].sort(
            (a, b) => (items[a].option_order ?? 0) - (items[b].option_order ?? 0)
          );
          const recommendedIndices = sorted.filter((i) => items[i].is_recommended);
          if (recommendedIndices.length === 0) {
            items[sorted[0]].is_recommended = true;
          } else if (recommendedIndices.length > 1) {
            recommendedIndices.slice(1).forEach((i) => {
              items[i].is_recommended = false;
            });
          }
        });

        // Upsert items
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          // Auto-generate title for flights from details
          let itemTitle = item.title || null;
          if (item.item_type === "flight" && item.details) {
            const dd = item.details;
            const dirLabels: Record<string, string> = { outbound: "Ida", return: "Volta", domestic: "Interno" };
            const parts: string[] = [];
            if (dd.flight_direction) parts.push(`[${dirLabels[dd.flight_direction] || dd.flight_direction}]`);
            if (dd.origin || dd.destination) parts.push(`${dd.origin || "?"} → ${dd.destination || "?"}`);
            if (dd.airline) parts.push(`(${dd.airline}${dd.flight_number ? ` ${dd.flight_number}` : ""})`);
            if (parts.length) itemTitle = parts.join(" ");
          }
          const itemPayload = {
            quote_id: quoteId,
            item_type: item.item_type,
            title: itemTitle,
            description: item.description || null,
            details: item.details || {},
            sort_order: i,
            unit_cost: Number(item.unit_cost) || 0,
            unit_price: Number(item.unit_price) || 0,
            quantity: Number(item.quantity) || 1,
            supplier_id: item.supplier_id || null,
            payment_source: item.payment_source || null,
            commission_amount: Number(item.commission_amount) || 0,
            commission_status: item.commission_status || "pending",
            attachment_urls: item.attachment_urls ?? [],
            external_url: item.external_url || null,
            option_group: item.option_group ?? null,
            option_label: item.option_label ?? null,
            option_order: item.option_order ?? null,
            is_recommended: !!item.is_recommended,
            is_selected: !!item.is_selected,
          };
          if (item.id && !item._isNew) {
            await supabase.from("quote_items").update(itemPayload).eq("id", item.id);
          } else {
            await supabase.from("quote_items").insert(itemPayload);
          }
        }

        // Save passengers
        await supabase.from("quote_passengers").delete().eq("quote_id", quoteId);
        if (selectedPassengers.length) {
          await supabase.from("quote_passengers").insert(
            selectedPassengers.map(pid => ({ quote_id: quoteId!, passenger_id: pid }))
          );
        }
      }

      toast({ title: editingQuote ? "Cotação atualizada" : "Cotação criada", duration: 2000 });
      localStorage.removeItem(QUOTE_EDITOR_DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });

      if (closeAfter) {
        performCloseDialog();
      } else if (!editingQuote && quoteId) {
        setEditingQuote({ ...payload, id: quoteId, created_at: new Date().toISOString() } as Quote);
        // Reset snapshot baseline so subsequent edits compare correctly
        initialSnapshotRef.current = "";
      } else {
        // Update snapshot baseline post-save so the editor isn't "dirty" anymore
        initialSnapshotRef.current = JSON.stringify({
          form,
          items,
          selectedPassengers,
          selectedLinkedClients,
          clientSelfTraveling,
          selectedDestinations,
          coverPreview,
        });
      }
      return quoteId ?? null;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      return null;
    }
  };

  const createSaleFromQuote = async (quoteId: string, payload: any) => {
    await supabase.from("sales").insert({
      quote_id: quoteId,
      client_id: payload.client_id,
      destination: payload.destination,
      total_value: payload.total_value,
      travel_date_start: payload.travel_date_start,
      travel_date_end: payload.travel_date_end,
      stage: "issued",
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("quote_items").delete().eq("quote_id", id);
      await supabase.from("quote_passengers").delete().eq("quote_id", id);
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cotação removida" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (q: Quote) => {
      const { error } = await supabase
        .from("quotes")
        .update({ archived_at: new Date().toISOString(), archived_by: user?.id ?? null } as any)
        .eq("id", q.id);
      if (error) throw error;
      try { await logHistory(q.id, "archived", "Cotação arquivada"); } catch {}
    },
    onSuccess: () => {
      toast({ title: "Cotação arquivada" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quotes-metrics"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (q: Quote) => {
      const { error } = await supabase
        .from("quotes")
        .update({ archived_at: null, archived_by: null } as any)
        .eq("id", q.id);
      if (error) throw error;
      try { await logHistory(q.id, "unarchived", "Cotação desarquivada"); } catch {}
    },
    onSuccess: () => {
      toast({ title: "Cotação desarquivada" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quotes-metrics"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = (preset?: { client_id?: string }) => {
    setEditingQuote(null);
    setForm({ stage: "new", total_value: "", ...(preset?.client_id ? { client_id: preset.client_id } : {}) });
    setItems([]);
    setSelectedPassengers([]);
    setSelectedLinkedClients([]);
    setClientSelfTraveling(false);
    setSelectedDestinations([]);
    setCoverFile(null);
    setCoverPreview(null);
    setActiveTab("main");
    initialSnapshotRef.current = ""; // empty = "new quote" mode
    setDialogOpen(true);
  };

  // Open editor pre-filled when navigated from elsewhere (e.g. Clients page)
  useEffect(() => {
    const state = (location.state ?? {}) as { newQuote?: boolean; clientId?: string };
    if (state.newQuote) {
      openCreate({ client_id: state.clientId });
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const openEdit = (q: Quote) => {
    setEditingQuote(q);
    const pb = (q as any).price_breakdown;
    setForm({
      title: q.title ?? "",
      client_id: q.client_id ?? "",
      cover_image_url: q.cover_image_url ?? "",
      details: q.details ?? "",
      payment_terms: q.payment_terms ?? "",
      terms_conditions: q.terms_conditions ?? "",
      other_info: q.other_info ?? "",
      destination: q.destination ?? "",
      total_value: q.total_value ?? "",
      discount_amount: (q as any).discount_amount ?? "",
      discount_percent: (q as any).discount_percent ?? "",
      stage: q.stage,
      conclusion_type: q.conclusion_type ?? "won",
      travel_date_start: q.travel_date_start ?? "",
      travel_date_end: q.travel_date_end ?? "",
      notes: q.notes ?? "",
      lead_source: (q as any).lead_source ?? "",
      flexible_dates: pb?.flexible_dates ?? false,
      flexible_dates_description: pb?.flexible_dates_description ?? "",
    });
    setItems([]);
    setSelectedPassengers([]);
    setSelectedLinkedClients([]);
    setSelectedDestinations(q.destination ? q.destination.split(", ").filter(Boolean) : []);
    setClientSelfTraveling(pb?.client_self_traveling ?? false);
    setCoverFile(null);
    setCoverPreview(q.cover_image_url || null);
    setActiveTab("main");
    setDialogOpen(true);
    // Snapshot captured shortly after, once items load (handled by effect below)
  };

  const buildEditorSnapshot = useCallback(() => {
    return JSON.stringify({
      form,
      items,
      selectedPassengers,
      selectedLinkedClients,
      clientSelfTraveling,
      selectedDestinations,
      coverPreview,
    });
  }, [form, items, selectedPassengers, selectedLinkedClients, clientSelfTraveling, selectedDestinations, coverPreview]);

  const hasUnsavedChanges = useCallback(() => {
    if (!initialSnapshotRef.current) {
      // New quote: dirty if any field filled or any item present
      return Object.values(form ?? {}).some((v) => v !== "" && v !== null && v !== undefined && v !== false) || items.length > 0;
    }
    return buildEditorSnapshot() !== initialSnapshotRef.current;
  }, [buildEditorSnapshot, form, items]);

  const performCloseDialog = () => {
    localStorage.removeItem(QUOTE_EDITOR_DRAFT_KEY);
    setDialogOpen(false);
    setEditingQuote(null);
    setForm({});
    setItems([]);
    setSelectedPassengers([]);
    setSelectedLinkedClients([]);
    setClientSelfTraveling(false);
    setSelectedDestinations([]);
    setCoverFile(null);
    setCoverPreview(null);
    initialSnapshotRef.current = "";
  };

  const closeDialog = () => {
    if (hasUnsavedChanges()) {
      setConfirmCloseOpen(true);
      return;
    }
    performCloseDialog();
  };

  const openWhatsappDialog = async () => {
    const client = clients.find((c: any) => c.id === form.client_id);
    const phone = client?.phone || "";
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "";
    const previewQuoteUrl = editingQuote?.id
      ? `https://compass.altivusturismo.com.br/quote/${editingQuote.id}`
      : "[o link será gerado ao confirmar o envio]";
    const destination = form.destination || form.title || "sua viagem";

    setWhatsappQuoteId(editingQuote?.id ?? null);
    setWhatsappPhone(formattedPhone);
    setWhatsappMessage(`Olá! Segue o orçamento de *${destination}* preparado pela *Altivus Turismo*: ${previewQuoteUrl}`);
    setWhatsappOpen(true);
  };

  const handleSendWhatsapp = async () => {
    if (!whatsappPhone.trim()) {
      toast({ title: "Informe o número de telefone", variant: "destructive" });
      return;
    }

    setSendingWhatsapp(true);
    try {
      const savedQuoteId = await saveQuote(false);
      if (!savedQuoteId) {
        throw new Error("Não foi possível salvar a cotação antes do envio.");
      }

      const finalMessage = whatsappMessage.replace(
        "[o link será gerado ao confirmar o envio]",
        `https://compass.altivusturismo.com.br/quote/${savedQuoteId}`,
      );

      const quoteUrl = `https://compass.altivusturismo.com.br/quote/${savedQuoteId}`;

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          action: "send-link",
          phone: whatsappPhone,
          message: finalMessage,
          link_url: quoteUrl,
          link_title: "Altivus Compass",
          link_description: `Sistema de gestão da Altivus\ncompass.altivusturismo.com.br`,
          image_url: "https://storage.googleapis.com/gpt-engineer-file-uploads/Q5PyjPx9DmYrShMRadDhPe4XruD2/social-images/social-1772900670484-img_1010.webp",
          quote_id: savedQuoteId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setWhatsappQuoteId(savedQuoteId);
      setWhatsappMessage(finalMessage);
      toast({ title: "✅ Mensagem enviada!", description: `WhatsApp enviado com sucesso para ${whatsappPhone}.` });
      setWhatsappOpen(false);
      queryClient.invalidateQueries({ queryKey: ["quote-history"] });
    } catch (err: any) {
      toast({ title: "❌ Falha ao enviar WhatsApp", description: err.message || "Verifique o número e tente novamente.", variant: "destructive" });
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const addItem = (type: string, extra?: Partial<QuoteItem>) => {
    setItems([...items, {
      item_type: type,
      title: "",
      description: "",
      details: {},
      sort_order: items.length,
      _isNew: true,
      quantity: 1,
      unit_cost: 0,
      unit_price: 0,
      supplier_id: null,
      payment_source: null,
      commission_amount: 0,
      commission_status: "pending",
      attachment_urls: [],
      external_url: null,
      ...(extra || {}),
    }]);
  };

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    setItems(items.map((it, i) => i === index ? { ...it, ...updates } : it));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const togglePassenger = (passengerId: string) => {
    setSelectedPassengers(prev =>
      prev.includes(passengerId) ? prev.filter(p => p !== passengerId) : [...prev, passengerId]
    );
  };

  const toggleLinkedClient = (clientId: string) => {
    setSelectedLinkedClients(prev =>
      prev.includes(clientId) ? prev.filter(c => c !== clientId) : [...prev, clientId]
    );
  };

  const TRAVEL_PROFILE_LABELS: Record<string, string> = { economic: "Econômico", opportunity: "Conforto", sophisticated: "Premium" };

  const renderPrefsTooltip = (client: any) => {
    const hasPrefs = client.seat_preference || (client.preferred_airports?.length > 0) || client.travel_profile || client.travel_preferences || (client.desired_destinations?.length > 0);
    if (!hasPrefs) return null;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 shrink-0 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs space-y-1 p-3">
            <p className="font-semibold text-foreground mb-1">Preferências de {client.full_name}</p>
            {client.travel_profile && <p><span className="text-muted-foreground">Perfil:</span> {TRAVEL_PROFILE_LABELS[client.travel_profile] || client.travel_profile}</p>}
            {client.seat_preference && <p><span className="text-muted-foreground">Assento:</span> {client.seat_preference === "window" ? "Janela" : client.seat_preference === "aisle" ? "Corredor" : client.seat_preference}</p>}
            {client.preferred_airports?.length > 0 && <p><span className="text-muted-foreground">Aeroportos:</span> {client.preferred_airports.join(", ")}</p>}
            {client.desired_destinations?.length > 0 && <p><span className="text-muted-foreground">Destinos desejados:</span> {client.desired_destinations.join(", ")}</p>}
            {client.travel_preferences && <p><span className="text-muted-foreground">Obs:</span> {client.travel_preferences}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const toggleDestination = (dest: string) => {
    setSelectedDestinations(prev =>
      prev.includes(dest) ? prev.filter(d => d !== dest) : [...prev, dest]
    );
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  // ----- WhatsApp summary helpers (productivity) -----
  const fetchSummaryDataFor = async (quote: Quote) => {
    if (editingQuote && editingQuote.id === quote.id) {
      const pax = (clientPassengers as any[]).filter((p: any) => selectedPassengers.includes(p.id));
      return { items, passengers: pax };
    }
    const [{ data: itemsData }, { data: paxLink }] = await Promise.all([
      supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("sort_order"),
      supabase.from("quote_passengers").select("passenger_id").eq("quote_id", quote.id),
    ]);
    let pax: any[] = [];
    const ids = (paxLink ?? []).map((r: any) => r.passenger_id).filter(Boolean);
    if (ids.length) {
      const { data: paxData } = await supabase.from("passengers").select("id, full_name").in("id", ids);
      pax = paxData ?? [];
    }
    return { items: (itemsData ?? []) as any[], passengers: pax };
  };

  const fallbackCopyToClipboard = (text: string): boolean => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopySummary = async (quote: Quote) => {
    try {
      const { items: qItems, passengers: qPax } = await fetchSummaryDataFor(quote);
      const summary = buildQuoteSummary(quote, qItems, qPax, clients as any[]);
      let copied = false;
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(summary);
          copied = true;
        } catch {
          copied = fallbackCopyToClipboard(summary);
        }
      } else {
        copied = fallbackCopyToClipboard(summary);
      }
      if (copied) {
        toast({ title: "Resumo copiado", description: "Cole no WhatsApp do cliente." });
        try { await logHistory(quote.id, "summary_copied", "Resumo copiado pro WhatsApp"); } catch {}
      } else {
        setSummaryFallbackText(summary);
      }
    } catch (err: any) {
      toast({ title: "Erro ao copiar", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const handleOpenInWhatsapp = async (quote: Quote) => {
    try {
      const phone = pickClientWhatsappNumber(quote, clients as any[]);
      if (!phone) {
        toast({ title: "Cliente sem telefone", description: "Cadastre um telefone para o cliente antes.", variant: "destructive" });
        return;
      }
      const { items: qItems, passengers: qPax } = await fetchSummaryDataFor(quote);
      const summary = buildQuoteSummary(quote, qItems, qPax, clients as any[]);
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      try { await logHistory(quote.id, "summary_whatsapp_opened", "Resumo aberto no WhatsApp"); } catch {}
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const updateQuoteStage = async (quoteId: string, newStage: string) => {
    try {
      const q = quotes.find((q: Quote) => q.id === quoteId);
      const { error } = await supabase.from("quotes").update({ stage: newStage as any }).eq("id", quoteId);
      if (error) throw error;
      const oldLabel = stages.find(s => s.id === q?.stage)?.label ?? q?.stage;
      const newLabel = stages.find(s => s.id === newStage)?.label ?? newStage;
      await logHistory(quoteId, "stage_change", `Etapa alterada de "${oldLabel}" para "${newLabel}"`);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (err: any) {
      toast({ title: "Erro ao mover cotação", description: err.message, variant: "destructive" });
    }
  };

  const sortedQuotes = [...quotes].sort((a: any, b: any) => {
    if (!sortField) return 0;
    let aValue = a[sortField];
    let bValue = b[sortField];
    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    const modifier = sortDir === "asc" ? 1 : -1;
    return aValue > bValue ? modifier : -modifier;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50 inline-block" />;
    return sortDir === "asc" ? <ArrowUp className="ml-2 h-4 w-4 inline-block" /> : <ArrowDown className="ml-2 h-4 w-4 inline-block" />;
  };

  const RELATIONSHIP_LABELS: Record<string, string> = {
    spouse: "Cônjuge", child: "Filho(a)", parent: "Pai/Mãe", employee: "Funcionário(a)",
    partner: "Sócio(a)", sibling: "Irmão(ã)", other: "Outro",
  };

  // Keep the saveQuote ref pointing at the latest closure for the keyboard shortcut
  saveQuoteRef.current = saveQuote;

  // Apply search + assignee + lead source filters then sort (must be before any early return)
  const filteredQuotes = useMemo(() => {
    let list = quotes as Quote[];
    if (searchTerm) {
      list = list.filter((q) => {
        const hay = `${q.title ?? ""} ${q.destination ?? ""} ${q.client_name ?? ""} ${q.id}`.toLowerCase();
        return hay.includes(searchTerm);
      });
    }
    if (filterAssignee !== "all") {
      list = list.filter((q) => (q.assigned_to ?? "") === filterAssignee);
    }
    if (filterLeadSource !== "all") {
      list = list.filter((q) => (q.lead_source ?? "") === filterLeadSource);
    }
    const sorted = [...list];
    sorted.sort((a: any, b: any) => {
      switch (pipelineSort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "value_desc":
          return Number(b.total_value ?? 0) - Number(a.total_value ?? 0);
        case "value_asc":
          return Number(a.total_value ?? 0) - Number(b.total_value ?? 0);
        case "updated":
          return new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [quotes, searchTerm, filterAssignee, filterLeadSource, pipelineSort]);

  // ─── FORM VIEW ─────────────────────────────────────────────
  if (dialogOpen) {
    const itemsForType = (type: string) => items.filter(i => i.item_type === type);
    const itemCount = (type: string) => items.filter(i => i.item_type === type).length;

    return (
      <>
      <div className="max-w-full mx-auto space-y-4">
        {/* Header + Stepper */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={closeDialog} className="shrink-0 h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">
              {editingQuote ? "Editar Cotação" : "Nova Cotação"}
            </h1>
            {editingQuote && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[
                  form.title,
                  clients.find((c: any) => c.id === form.client_id)?.full_name,
                  form.flexible_dates
                    ? (form.flexible_dates_description || null)
                    : form.travel_date_start
                      ? `${format(parseISO(form.travel_date_start), "dd/MM/yyyy")}${form.travel_date_end ? ` a ${format(parseISO(form.travel_date_end), "dd/MM/yyyy")}` : ""}`
                      : null,
                ].filter(Boolean).join(" — ")}
              </p>
            )}
          </div>
        </div>

        {/* Stage stepper */}
        <div className="glass-card rounded-xl px-3 sm:px-4 py-3">
          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
            {stages.map((stage, idx) => {
              const currentIdx = stages.findIndex(s => s.id === (form.stage || "new"));
              const isActive = stage.id === form.stage;
              const isPast = idx < currentIdx;
              const isLast = idx === stages.length - 1;
              return (
                <div key={stage.id} className="flex items-center flex-1">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, stage: stage.id })}
                    className={cn(
                      "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-body font-medium transition-all cursor-pointer whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isPast
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold",
                      isActive ? "bg-primary-foreground text-primary" : isPast ? "bg-primary text-primary-foreground" : "bg-muted-foreground/30 text-muted-foreground"
                    )}>
                      {isPast ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                    </span>
                    {stage.label}
                  </button>
                  {!isLast && (
                    <div className={cn("flex-1 h-0.5 mx-1 rounded-full min-w-[8px]", isPast ? "bg-primary/40" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
          {form.stage === "confirmed" && (
            <div className="mt-2 flex items-center gap-2 pl-1">
              <Label className="font-body text-xs text-muted-foreground">Resultado:</Label>
              <div className="flex gap-1">
                <button type="button" onClick={() => setForm({ ...form, conclusion_type: "won" })}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-body transition-colors",
                    form.conclusion_type === "won" ? "bg-emerald-500/20 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>Convertida em venda</button>
                <button type="button" onClick={() => setForm({ ...form, conclusion_type: "lost" })}
                  className={cn("px-2.5 py-1 rounded-md text-xs font-body transition-colors",
                    form.conclusion_type === "lost" ? "bg-destructive/20 text-destructive border border-destructive/30" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}>Perdida</button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs for items */}
        <div className="glass-card rounded-xl p-4">
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v);
            if (v === "flight") {
              const flightIndices = new Set<number>();
              items.forEach((it, idx) => { if (it.item_type === "flight") flightIndices.add(idx); });
              setCollapsedFlights(flightIndices);
            }
          }}>
            <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted p-0.5 w-full justify-start">
              <TabsTrigger value="main" className="flex items-center gap-1 text-[11px] px-2 py-1">
                <FileText className="w-3 h-3" />
                Principal
              </TabsTrigger>
              {ITEM_TYPES.map((type) => {
                const count = itemCount(type.id);
                const Icon = type.icon;
                return (
                  <TabsTrigger key={type.id} value={type.id} className="flex items-center gap-1 text-[11px] px-2 py-1">
                    <Icon className="w-3 h-3" />
                    {type.label}
                    {count > 0 && <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">{count}</Badge>}
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="roteiro" className="flex items-center gap-1 text-[11px] px-2 py-1">
                <CalendarDays className="w-3 h-3" />
                Roteiro
                {linkedItinerary && <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">1</Badge>}
              </TabsTrigger>
              {editingQuote && (
                <TabsTrigger value="history" className="flex items-center gap-1 text-[11px] px-2 py-1 bg-primary/15 text-primary border border-primary/30 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">
                  <History className="w-3 h-3" />
                  Histórico
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="main" className="mt-3 space-y-3">
              {/* Row 1: Título, Cliente, Imagem de Capa */}
              <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-3">
                <div className="col-span-2 lg:col-span-3 space-y-1">
                  <Label className="font-body text-xs">Título da Cotação</Label>
                  <Input className="h-9 text-sm" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Viagem Europa - Família Silva" />
                </div>
                <div className="col-span-2 lg:col-span-2 space-y-1">
                  <Label className="font-body text-xs">Origem do lead</Label>
                  <Select value={form.lead_source || "_none"} onValueChange={(v) => setForm({ ...form, lead_source: v === "_none" ? "" : v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Não definido</SelectItem>
                      {LEAD_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 lg:col-span-4 space-y-1">
                  <Label className="font-body text-xs">Cliente</Label>
                  <Select value={form.client_id ?? ""} onValueChange={(v) => { setForm({ ...form, client_id: v }); setSelectedPassengers([]); setSelectedLinkedClients([]); setClientSelfTraveling(false); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 lg:col-span-4 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="font-body text-xs">Imagem de Capa</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] text-xs">
                          <p>A IA usa o <strong>título da cotação</strong> para gerar a imagem automaticamente.</p>
                          <p className="mt-1">Para upload manual, a largura ideal é <strong>1200×630px</strong> (proporção 1.9:1).</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center gap-2">
                    {coverPreview ? (
                      <div className="relative">
                        <img src={coverPreview} alt="Capa" className="h-9 w-16 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setCoverZoom(true)} />
                        <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); setForm({ ...form, cover_image_url: "" }); }} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 px-3 border border-dashed border-border rounded-md flex items-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors text-xs">
                          <ImageIcon className="w-3.5 h-3.5" /> Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={generateCoverWithAI}
                          disabled={generatingCover}
                          className="h-9 px-3 border border-dashed border-accent rounded-md flex items-center gap-1.5 text-accent-foreground hover:bg-accent/10 hover:border-accent transition-colors text-xs disabled:opacity-50"
                        >
                          {generatingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                          {generatingCover ? "Gerando..." : "Gerar com IA"}
                        </button>
                      </>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </div>
                </div>
              </div>

              {/* Row 2: Datas / Data Flexível */}
              <div className="grid grid-cols-[auto_1fr_1fr] lg:grid-cols-[auto_minmax(130px,1fr)_minmax(130px,1fr)] gap-x-3 gap-y-3 items-start">
                <div className="space-y-1">
                  <Label className="font-body text-xs whitespace-nowrap">Flexível</Label>
                  <div className="flex items-center h-9">
                    <Switch checked={!!form.flexible_dates} onCheckedChange={(v) => setForm({ ...form, flexible_dates: v, ...(v ? { travel_date_start: "", travel_date_end: "" } : {}) })} />
                  </div>
                </div>

                {!form.flexible_dates ? (
                  <>
                    <div className="space-y-1">
                      <Label className="font-body text-xs">Data Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-9 justify-start text-left text-sm font-normal overflow-hidden", !form.travel_date_start && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{form.travel_date_start ? format(parseISO(form.travel_date_start), "dd/MM/yyyy") : "Selecionar"}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={form.travel_date_start ? parseISO(form.travel_date_start) : undefined} onSelect={(date) => setForm({ ...form, travel_date_start: date ? format(date, "yyyy-MM-dd") : "" })} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="font-body text-xs">Data Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-9 justify-start text-left text-sm font-normal overflow-hidden", !form.travel_date_end && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{form.travel_date_end ? format(parseISO(form.travel_date_end), "dd/MM/yyyy") : "Selecionar"}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={form.travel_date_end ? parseISO(form.travel_date_end) : undefined} onSelect={(date) => setForm({ ...form, travel_date_end: date ? format(date, "yyyy-MM-dd") : "" })} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 space-y-1">
                    <Label className="font-body text-xs">Período desejado</Label>
                    <Input className="h-9 text-sm" value={form.flexible_dates_description ?? ""} onChange={(e) => setForm({ ...form, flexible_dates_description: e.target.value })} placeholder="Ex: Qualquer semana em julho..." />
                  </div>
                )}
              </div>

              {/* Row 3: Viajantes + Destino(s) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-3 gap-y-3 items-start">
                {form.client_id && (
                  <div className="space-y-1">
                    <Label className="font-body text-xs">Viajantes</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                          {(() => {
                            const total = (clientSelfTraveling ? 1 : 0) + selectedPassengers.length + selectedLinkedClients.length;
                            return total === 0 ? "Selecionar viajantes..." : `${total} selecionado(s)`;
                          })()}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar..." className="h-8 text-xs" />
                          <CommandList>
                            <CommandEmpty className="py-3 text-xs">Nenhum encontrado.</CommandEmpty>
                            {(() => {
                              const selectedClient = clients.find((c: any) => c.id === form.client_id);
                              if (!selectedClient) return null;
                              return (
                                <CommandItem key={`self-${selectedClient.id}`} onSelect={() => setClientSelfTraveling(prev => !prev)} className="text-xs cursor-pointer">
                                  <Check className={cn("mr-2 h-3.5 w-3.5", clientSelfTraveling ? "opacity-100" : "opacity-0")} />
                                  <Badge className="text-[9px] h-4 px-1 shrink-0 mr-1 bg-primary/20 text-primary border-primary/30">Cliente</Badge>
                                  <span className="truncate font-medium">{selectedClient.full_name}</span>
                                </CommandItem>
                              );
                            })()}
                            {clientPassengers.map((p) => (
                              <CommandItem key={`p-${p.id}`} onSelect={() => togglePassenger(p.id)} className="text-xs cursor-pointer">
                                <Check className={cn("mr-2 h-3.5 w-3.5", selectedPassengers.includes(p.id) ? "opacity-100" : "opacity-0")} />
                                <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 mr-1">Passageiro</Badge>
                                <span className="truncate">{p.full_name}</span>
                                {p.relationship_type && <span className="ml-auto text-[10px] text-muted-foreground">({RELATIONSHIP_LABELS[p.relationship_type] || p.relationship_type})</span>}
                              </CommandItem>
                            ))}
                            {linkedClients.map((lc: any) => (
                              <CommandItem key={`lc-${lc.id}`} onSelect={() => toggleLinkedClient(lc.id)} className="text-xs cursor-pointer">
                                <Check className={cn("mr-2 h-3.5 w-3.5", selectedLinkedClients.includes(lc.id) ? "opacity-100" : "opacity-0")} />
                                <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 mr-1">{RELATIONSHIP_LABELS[(lc as any).relationship_type] || (lc as any).relationship_type}</Badge>
                                <span className="truncate">{(lc as any).full_name}</span>
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {(clientSelfTraveling || selectedPassengers.length > 0 || selectedLinkedClients.length > 0) && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {clientSelfTraveling && (() => {
                          const selectedClient = clients.find((c: any) => c.id === form.client_id);
                          if (!selectedClient) return null;
                          return (
                            <Badge key="self-client" className="text-xs gap-1 pr-1 bg-primary/20 text-primary border-primary/30">
                              {selectedClient.full_name}
                              <span className="text-[9px]">(Cliente)</span>
                              {renderPrefsTooltip(selectedClient)}
                              <button type="button" onClick={() => setClientSelfTraveling(false)} className="ml-0.5 hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                            </Badge>
                          );
                        })()}
                        {selectedPassengers.map((pid) => {
                          const p = clientPassengers.find((cp) => cp.id === pid);
                          if (!p) return null;
                          return (
                            <Badge key={`sp-${pid}`} variant="secondary" className="text-xs gap-1 pr-1">
                              {p.full_name}
                              {p.relationship_type && <span className="text-[9px] text-muted-foreground">({RELATIONSHIP_LABELS[p.relationship_type] || p.relationship_type})</span>}
                              <button type="button" onClick={() => togglePassenger(pid)} className="ml-0.5 hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                            </Badge>
                          );
                        })}
                        {selectedLinkedClients.map((cid) => {
                          const lc = linkedClients.find((l: any) => l.id === cid);
                          if (!lc) return null;
                          return (
                            <Badge key={`slc-${cid}`} variant="outline" className="text-xs gap-1 pr-1">
                              {(lc as any).full_name}
                              <span className="text-[9px] text-muted-foreground">({RELATIONSHIP_LABELS[(lc as any).relationship_type] || (lc as any).relationship_type})</span>
                              {renderPrefsTooltip(lc)}
                              <button type="button" onClick={() => toggleLinkedClient(cid)} className="ml-0.5 hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="font-body text-xs">Destino(s)</Label>
                  <Popover open={destOpen} onOpenChange={setDestOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                        {selectedDestinations.length === 0
                          ? "Buscar destino..."
                          : `${selectedDestinations.length} destino(s)`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cidade, país..." className="h-8 text-xs" />
                        <CommandList>
                          <CommandEmpty className="py-3 text-xs">Nenhum destino encontrado.</CommandEmpty>
                          {allDestinations.map((d) => (
                            <CommandItem key={d.value} onSelect={() => toggleDestination(d.value)} className="text-xs cursor-pointer">
                              <Check className={cn("mr-2 h-3.5 w-3.5", selectedDestinations.includes(d.value) ? "opacity-100" : "opacity-0")} />
                              <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 mr-1">{d.group}</Badge>
                              <span className="truncate">{d.label}</span>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedDestinations.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedDestinations.map((dest) => (
                        <Badge key={dest} variant="secondary" className="text-xs gap-1 pr-1">
                          {dest}
                          <button type="button" onClick={() => toggleDestination(dest)} className="ml-0.5 hover:text-destructive transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-border/50 pt-3"></div>

              {/* Detalhes, Pagamento, Termos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="lg:col-span-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="font-body text-xs">Detalhes</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-xs z-[9999]">
                          A IA gera automaticamente uma descrição da viagem com base no título e destinos selecionados. Você pode editar o texto depois.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <button
                      type="button"
                      onClick={async () => {
                        const dest = selectedDestinations.length > 0 ? selectedDestinations.join(", ") : form.destination;
                        const title = form.title;
                        if (!dest && !title) {
                          toast({ title: "Preencha o título ou destino antes de gerar com IA", variant: "destructive" });
                          return;
                        }
                        setGeneratingDetails(true);
                        try {
                          const { data, error } = await supabase.functions.invoke("generate-quote-details", {
                            body: { title, destinations: dest },
                          });
                          if (error) throw error;
                          if (data?.error) throw new Error(data.error);
                          if (data?.text) {
                            setForm((f: any) => ({ ...f, details: data.text }));
                            toast({ title: "Texto gerado com sucesso!" });
                          }
                        } catch (e: any) {
                          toast({ title: e.message || "Erro ao gerar texto", variant: "destructive" });
                        } finally {
                          setGeneratingDetails(false);
                        }
                      }}
                      disabled={generatingDetails}
                      className="inline-flex items-center gap-1 px-2 py-0.5 border border-dashed border-accent rounded-md text-accent-foreground hover:bg-accent/10 transition-colors text-[10px] disabled:opacity-50"
                    >
                      {generatingDetails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {generatingDetails ? "Gerando..." : "Gerar com IA"}
                    </button>
                  </div>
                  <Textarea value={form.details ?? ""} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={3} className="text-sm" placeholder="Descrição geral da viagem, roteiro resumido..." />
                </div>
                <div className="space-y-1">
                  <Label className="font-body text-xs">Forma de Pagamento</Label>
                  <Textarea value={form.payment_terms ?? ""} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} rows={2} className="text-sm" placeholder="Ex: 50% na confirmação, 50% até 30 dias antes" />
                </div>
                <div className="space-y-1">
                  <Label className="font-body text-xs">Termos e Condições</Label>
                  <Textarea value={form.terms_conditions ?? ""} onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })} rows={2} className="text-sm" placeholder="Políticas de cancelamento, reembolso..." />
                </div>
                <div className="lg:col-span-2 space-y-1">
                  <Label className="font-body text-xs">Outras Informações</Label>
                  <Textarea value={form.other_info ?? ""} onChange={(e) => setForm({ ...form, other_info: e.target.value })} rows={2} className="text-sm" placeholder="Informações complementares..." />
                </div>
              </div>

              {/* Desconto geral */}
              {(() => {
                const discountMode: "amount" | "percent" =
                  Number(form.discount_percent) > 0 && !Number(form.discount_amount)
                    ? "percent"
                    : "amount";
                const totalValue = Number(form.total_value) || 0;
                const discountAmount = Number(form.discount_amount) || 0;
                const discountPercent = Number(form.discount_percent) || 0;
                const computedDiscount =
                  discountMode === "percent"
                    ? (totalValue * discountPercent) / 100
                    : discountAmount;
                const totalWithDiscount = Math.max(0, totalValue - computedDiscount);
                return (
                  <div className="border-t border-border/50 pt-3 space-y-2">
                    <Label className="font-body text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Desconto geral
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 items-end">
                      <RadioGroup
                        value={discountMode}
                        onValueChange={(v) => {
                          if (v === "amount") {
                            setForm({ ...form, discount_percent: "" });
                          } else {
                            setForm({ ...form, discount_amount: "" });
                          }
                        }}
                        className="flex gap-3 h-9 items-center"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="amount" id="disc-amount" />
                          <Label htmlFor="disc-amount" className="text-xs font-body cursor-pointer">
                            Valor (R$)
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="percent" id="disc-percent" />
                          <Label htmlFor="disc-percent" className="text-xs font-body cursor-pointer">
                            Porcentagem (%)
                          </Label>
                        </div>
                      </RadioGroup>
                      <div className="space-y-0.5">
                        <Label className="text-[11px] font-body">
                          {discountMode === "amount" ? "Desconto em R$" : "Desconto em %"}
                        </Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                            {discountMode === "amount" ? "R$" : "%"}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            max={discountMode === "percent" ? 100 : undefined}
                            value={discountMode === "amount" ? (form.discount_amount ?? "") : (form.discount_percent ?? "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (discountMode === "amount") {
                                setForm({ ...form, discount_amount: v, discount_percent: "" });
                              } else {
                                setForm({ ...form, discount_percent: v, discount_amount: "" });
                              }
                            }}
                            placeholder="0"
                            className="h-9 text-sm pl-7"
                          />
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <Label className="text-[11px] font-body text-muted-foreground">
                          Total com desconto
                        </Label>
                        <div className="text-base font-semibold font-body text-foreground">
                          {formatCurrency(totalWithDiscount)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {ITEM_TYPES.map((type) => (
              <TabsContent key={type.id} value={type.id} className="mt-3 space-y-2">
                <QuoteOptionsManager<QuoteItem>
                  itemType={type.id}
                  itemTypeLabel={type.label}
                  items={itemsForType(type.id)}
                  allItems={items}
                  addButtonLabel={`Adicionar ${type.label}`}
                  onAddItem={(extra) => addItem(type.id, extra)}
                  onUpdateItemGlobal={(gi, patch) => updateItem(gi, patch)}
                  onRemoveItemGlobal={(gi) => removeItem(gi)}
                  renderItem={(item, globalIdx, idx) => {
                  const d = item.details || {};
                  const updateDetail = (key: string, value: any) => {
                    const newDetails = { ...d, [key]: value };
                    // Auto-calc duration when date/time fields change
                    if (["departure_date", "departure_time", "arrival_date", "arrival_time"].includes(key)) {
                      const depDate = key === "departure_date" ? value : d.departure_date;
                      const depTime = key === "departure_time" ? value : d.departure_time;
                      const arrDate = key === "arrival_date" ? value : d.arrival_date;
                      const arrTime = key === "arrival_time" ? value : d.arrival_time;
                      if (depDate && arrDate) {
                        const dep = new Date(`${depDate}T${depTime || "00:00"}`);
                        const arr = new Date(`${arrDate}T${arrTime || "00:00"}`);
                        const diffMs = arr.getTime() - dep.getTime();
                        if (diffMs > 0) {
                          const totalMin = Math.floor(diffMs / 60000);
                          const h = Math.floor(totalMin / 60);
                          const m = totalMin % 60;
                          newDetails.duration = `${h}h${m.toString().padStart(2, "0")}`;
                        }
                      }
                    }
                    updateItem(globalIdx, { details: newDetails });
                  };

                  return (
                    <div key={globalIdx} className="border border-border rounded-md relative">
                      {type.id === "flight" ? (() => {
                        const isCollapsed = collapsedFlights.has(globalIdx);
                        const toggleCollapse = () => {
                          setCollapsedFlights(prev => {
                            const next = new Set(prev);
                            if (next.has(globalIdx)) next.delete(globalIdx); else next.add(globalIdx);
                            return next;
                          });
                        };
                        const dirLabels: Record<string, string> = { outbound: "Ida", return: "Volta", domestic: "Interno" };
                        const summary = [
                          d.flight_direction ? dirLabels[d.flight_direction] : "",
                          d.origin && d.destination ? `${d.origin} → ${d.destination}` : d.origin || d.destination || "",
                          d.airline || "",
                          d.flight_number || "",
                        ].filter(Boolean).join(" · ") || `Voo ${idx + 1}`;

                        return (
                          <>
                            <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" onClick={toggleCollapse}>
                              {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                              <Plane className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs font-medium text-foreground truncate">{summary}</span>
                              {d.departure_date && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{d.departure_date.split("-").reverse().join("/")}{d.departure_time ? ` ${d.departure_time}` : ""}</span>}
                              <button type="button" onClick={(e) => { e.stopPropagation(); removeItem(globalIdx); }} className="ml-2 text-destructive hover:text-destructive/80 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {!isCollapsed && (
                              <div className="px-3 pb-3 space-y-2.5">
                          {/* Row 1: Direction + Origin + Departure date/time */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Tipo <span className="text-destructive">*</span></Label>
                              <Select value={d.flight_direction || ""} onValueChange={(v) => updateDetail("flight_direction", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="outbound">Ida</SelectItem>
                                  <SelectItem value="return">Volta</SelectItem>
                                  <SelectItem value="domestic">Interno</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-5 space-y-0.5">
                              <Label className="text-[11px] font-body">Origem <span className="text-destructive">*</span></Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal px-2.5">
                                    <span className="truncate">{d.origin || "Selecione o aeroporto"}</span>
                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Buscar aeroporto..." className="text-xs h-8" />
                                    <CommandList>
                                      <CommandEmpty className="text-xs p-2">Nenhum aeroporto encontrado</CommandEmpty>
                                      {airports.map((ap: any) => (
                                        <CommandItem key={ap.id} value={ap.label} onSelect={() => updateDetail("origin", ap.value)} className="text-xs cursor-pointer">
                                          <Check className={cn("mr-2 h-3 w-3", d.origin === ap.value ? "opacity-100" : "opacity-0")} />
                                          <span className="font-medium mr-1">{ap.iata_code}</span>
                                          <span className="truncate text-muted-foreground">{ap.name} ({ap.city})</span>
                                        </CommandItem>
                                      ))}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="col-span-3 space-y-0.5">
                              <Label className="text-[11px] font-body">Embarque <span className="text-destructive">*</span></Label>
                              <Input type="date" value={d.departure_date || ""} onChange={(e) => updateDetail("departure_date", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Horário</Label>
                              <Input type="time" value={d.departure_time || ""} onChange={(e) => updateDetail("departure_time", e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>

                          {/* Row 2: Destination + Arrival date/time */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-2" />
                            <div className="col-span-5 space-y-0.5">
                              <Label className="text-[11px] font-body">Destino <span className="text-destructive">*</span></Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal px-2.5">
                                    <span className="truncate">{d.destination || "Selecione o aeroporto"}</span>
                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Buscar aeroporto..." className="text-xs h-8" />
                                    <CommandList>
                                      <CommandEmpty className="text-xs p-2">Nenhum aeroporto encontrado</CommandEmpty>
                                      {airports.map((ap: any) => (
                                        <CommandItem key={ap.id} value={ap.label} onSelect={() => updateDetail("destination", ap.value)} className="text-xs cursor-pointer">
                                          <Check className={cn("mr-2 h-3 w-3", d.destination === ap.value ? "opacity-100" : "opacity-0")} />
                                          <span className="font-medium mr-1">{ap.iata_code}</span>
                                          <span className="truncate text-muted-foreground">{ap.name} ({ap.city})</span>
                                        </CommandItem>
                                      ))}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="col-span-3 space-y-0.5">
                              <Label className="text-[11px] font-body">Chegada <span className="text-destructive">*</span></Label>
                              <Input type="date" value={d.arrival_date || ""} onChange={(e) => updateDetail("arrival_date", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Horário</Label>
                              <Input type="time" value={d.arrival_time || ""} onChange={(e) => updateDetail("arrival_time", e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>

                          {/* Row 3: Duration, Airline, Flight#, Locator, Purchase# */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Duração</Label>
                              <Input
                                value={d.duration || ""}
                                onChange={(e) => updateDetail("duration", e.target.value)}
                                placeholder="Ex: 12h30"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-3 space-y-0.5">
                              <Label className="text-[11px] font-body">Companhia</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal px-2.5">
                                    <span className="truncate">{d.airline || "Selecione"}</span>
                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Buscar companhia..." className="text-xs h-8" />
                                    <CommandList>
                                      <CommandEmpty className="text-xs p-2">Nenhuma companhia encontrada</CommandEmpty>
                                      {airlinesData.map((al: any) => (
                                        <CommandItem key={al.id} value={`${al.name} ${al.iata_code || ""}`} onSelect={() => updateDetail("airline", al.iata_code ? `${al.name} (${al.iata_code})` : al.name)} className="text-xs cursor-pointer">
                                          <Check className={cn("mr-2 h-3 w-3", d.airline === (al.iata_code ? `${al.name} (${al.iata_code})` : al.name) ? "opacity-100" : "opacity-0")} />
                                          <span className="font-medium mr-1">{al.iata_code || "—"}</span>
                                          <span className="truncate text-muted-foreground">{al.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Nº do Voo</Label>
                              <Input value={d.flight_number || ""} onChange={(e) => updateDetail("flight_number", e.target.value)} placeholder="Ex: LA8084" className="h-8 text-xs" />
                            </div>
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Localizador</Label>
                              <Input value={d.locator || ""} onChange={(e) => updateDetail("locator", e.target.value)} placeholder="" className="h-8 text-xs" />
                            </div>
                            <div className="col-span-3 space-y-0.5">
                              <Label className="text-[11px] font-body">Nº da Compra</Label>
                              <Input value={d.purchase_number || ""} onChange={(e) => updateDetail("purchase_number", e.target.value)} placeholder="" className="h-8 text-xs" />
                            </div>
                          </div>

                          {/* Row 4: Passengers (ADT/CHD/INF), Class, Connections, Check-in notification */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Classe</Label>
                              <Select value={d.cabin_class || ""} onValueChange={(v) => updateDetail("cabin_class", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="economy">Econômica</SelectItem>
                                  <SelectItem value="premium_economy">Premium Economy</SelectItem>
                                  <SelectItem value="business">Executiva</SelectItem>
                                  <SelectItem value="first">Primeira</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2 space-y-0.5">
                              <Label className="text-[11px] font-body">Conexões</Label>
                              <Select value={d.connections || ""} onValueChange={(v) => updateDetail("connections", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="direct">Voo direto</SelectItem>
                                  <SelectItem value="1">1 conexão</SelectItem>
                                  <SelectItem value="2">2 conexões</SelectItem>
                                  <SelectItem value="3+">3+ conexões</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-3 space-y-0.5">
                              <Label className="text-[11px] font-body">Notificação Check-in</Label>
                              <Select value={d.checkin_notification || ""} onValueChange={(v) => updateDetail("checkin_notification", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Não notificar</SelectItem>
                                  <SelectItem value="24h">Notificar 24h antes</SelectItem>
                                  <SelectItem value="48h">Notificar 48h antes</SelectItem>
                                  <SelectItem value="72h">Notificar 72h antes</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-5 space-y-0.5">
                              <Label className="text-[11px] font-body">Observação</Label>
                              <Input value={d.observation || ""} onChange={(e) => updateDetail("observation", e.target.value)} placeholder="" className="h-8 text-xs" />
                            </div>
                          </div>

                          {/* Row 5: Baggage counts */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-1 space-y-0.5">
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Label className="text-[11px] font-body text-center flex items-center justify-center gap-1 cursor-help"><Backpack className="w-3.5 h-3.5" /></Label>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">Mochila</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Input type="number" min={0} value={d.pax_adults ?? 1} onChange={(e) => updateDetail("pax_adults", parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                            </div>
                            <div className="col-span-1 space-y-0.5">
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Label className="text-[11px] font-body text-center flex items-center justify-center gap-1 cursor-help"><BriefcaseBusiness className="w-3.5 h-3.5" /></Label>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">Mala de Mão</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Input type="number" min={0} value={d.pax_children ?? 0} onChange={(e) => updateDetail("pax_children", parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                            </div>
                            <div className="col-span-1 space-y-0.5">
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Label className="text-[11px] font-body text-center flex items-center justify-center gap-1 cursor-help"><Luggage className="w-3.5 h-3.5" /></Label>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">Bagagem Despachada</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Input type="number" min={0} value={d.pax_infants ?? 0} onChange={(e) => updateDetail("pax_infants", parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                            </div>
                          </div>
                        </div>
                            )}
                          </>
                        );
                      })() : type.id === "hotel" ? (
                        /* Hotel-specific form */
                        <>
                          <button type="button" onClick={() => removeItem(globalIdx)} className="absolute top-2.5 right-2.5 text-destructive hover:text-destructive/80 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="space-y-2 p-3 pr-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Nome da Hospedagem</Label>
                                <Input value={item.title} onChange={(e) => updateItem(globalIdx, { title: e.target.value })} placeholder="Nome do hotel / pousada" className="h-8 text-xs" />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Endereço</Label>
                                <Input key={`addr-${globalIdx}-${d.address?.length || 0}`} defaultValue={d.address || ""} onBlur={(e) => updateDetail("address", e.target.value)} placeholder="Buscar endereço..." className="h-8 text-xs" id={`hotel-address-${globalIdx}`} />
                              </div>
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Data Check-in</Label>
                                <Input type="date" value={d.checkin_date || ""} onChange={(e) => updateDetail("checkin_date", e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Hora Check-in</Label>
                                <Input type="time" value={d.checkin_time || ""} onChange={(e) => updateDetail("checkin_time", e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Detalhes</Label>
                                <Input value={d.hotel_details || ""} onChange={(e) => updateDetail("hotel_details", e.target.value)} placeholder="Tipo de quarto, regime, etc." className="h-8 text-xs" />
                              </div>
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Data Check-out</Label>
                                <Input type="date" value={d.checkout_date || ""} onChange={(e) => updateDetail("checkout_date", e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Hora Check-out</Label>
                                <Input type="time" value={d.checkout_time || ""} onChange={(e) => updateDetail("checkout_time", e.target.value)} className="h-8 text-xs" />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-[11px] font-body">Descrição</Label>
                                <Input value={item.description} onChange={(e) => updateItem(globalIdx, { description: e.target.value })} placeholder="Informações adicionais" className="h-8 text-xs" />
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Generic form for non-flight items */
                        <>
                          <button type="button" onClick={() => removeItem(globalIdx)} className="absolute top-2.5 right-2.5 text-destructive hover:text-destructive/80 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 pr-8">
                            <div className="space-y-0.5">
                              <Label className="text-[11px] font-body">Título</Label>
                              <Input value={item.title} onChange={(e) => updateItem(globalIdx, { title: e.target.value })} placeholder={`Nome do ${type.label.toLowerCase()}`} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[11px] font-body">Descrição</Label>
                              <Input value={item.description} onChange={(e) => updateItem(globalIdx, { description: e.target.value })} placeholder="Detalhes adicionais" className="h-8 text-xs" />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Commercial fields shared across all item types */}
                      <div className="px-3 pb-3 space-y-3">
                        <QuoteItemCommercialFields
                          quantity={Number(item.quantity ?? 1)}
                          unitCost={Number(item.unit_cost ?? 0)}
                          unitPrice={Number(item.unit_price ?? 0)}
                          onChange={(patch) =>
                            updateItem(globalIdx, {
                              ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
                              ...(patch.unitCost !== undefined ? { unit_cost: patch.unitCost } : {}),
                              ...(patch.unitPrice !== undefined ? { unit_price: patch.unitPrice } : {}),
                            })
                          }
                        />
                        <QuoteItemSupplierFields
                          supplierId={item.supplier_id ?? null}
                          paymentSource={item.payment_source ?? null}
                          commissionAmount={Number(item.commission_amount ?? 0)}
                          commissionStatus={item.commission_status ?? "pending"}
                          onChange={(patch) =>
                            updateItem(globalIdx, {
                              ...(patch.supplierId !== undefined ? { supplier_id: patch.supplierId } : {}),
                              ...(patch.paymentSource !== undefined ? { payment_source: patch.paymentSource } : {}),
                              ...(patch.commissionAmount !== undefined ? { commission_amount: patch.commissionAmount } : {}),
                              ...(patch.commissionStatus !== undefined ? { commission_status: patch.commissionStatus } : {}),
                            })
                          }
                        />
                        <QuoteItemAttachments
                          externalUrl={item.external_url ?? null}
                          attachmentUrls={item.attachment_urls ?? []}
                          quoteId={editingQuote?.id}
                          itemId={item.id}
                          isNew={!!item._isNew}
                          onChange={(patch) =>
                            updateItem(globalIdx, {
                              ...(patch.externalUrl !== undefined ? { external_url: patch.externalUrl } : {}),
                              ...(patch.attachmentUrls !== undefined ? { attachment_urls: patch.attachmentUrls } : {}),
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                  }}
                />
              </TabsContent>
            ))}

            <TabsContent value="roteiro" className="mt-3">
              {linkedItinerary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{linkedItinerary.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {[
                          linkedItinerary.destination,
                          linkedItinerary.travel_date_start ? format(parseISO(linkedItinerary.travel_date_start), "dd/MM/yyyy") : null,
                          linkedItinerary.travel_date_end ? `a ${format(parseISO(linkedItinerary.travel_date_end), "dd/MM/yyyy")}` : null,
                        ].filter(Boolean).join(" — ")}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => window.open(`/itineraries?edit=${linkedItinerary.id}`, "_blank")}>
                        <ExternalLink className="w-3 h-3" /> Abrir Roteiro
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive gap-1" onClick={async () => {
                        if (!confirm("Desvincular roteiro desta cotação?")) return;
                        await supabase.from("itineraries").update({ quote_id: null }).eq("id", linkedItinerary.id);
                        refetchLinkedItinerary();
                        queryClient.invalidateQueries({ queryKey: ["itineraries-for-link"] });
                        toast({ title: "Roteiro desvinculado" });
                      }}>
                        <X className="w-3 h-3" /> Desvincular
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3 min-h-[400px]">
                    <div className="w-1/2 overflow-y-auto max-h-[500px] pr-2">
                      <ItineraryTimeline
                        itineraryId={linkedItinerary.id}
                        selectedDayId={selectedDayId}
                        onSelectDay={setSelectedDayId}
                        selectedActivityId={selectedActivityId}
                        onSelectActivity={setSelectedActivityId}
                      />
                    </div>
                    <div className="w-1/2">
                      <ItineraryMapView
                        itineraryId={linkedItinerary.id}
                        selectedDayId={selectedDayId}
                        selectedActivityId={selectedActivityId}
                        onSelectActivity={setSelectedActivityId}
                        height="h-[500px]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Nenhum roteiro associado a esta cotação.</p>
                  <div className="flex gap-2 items-center flex-wrap">
                    {editingQuote && (
                      <>
                        <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={async () => {
                          const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
                          const { data: newIt, error } = await supabase.from("itineraries").insert({
                            title: form.title || "Roteiro",
                            destination: selectedDestinations.join(", ") || form.destination || null,
                            travel_date_start: form.travel_date_start || null,
                            travel_date_end: form.travel_date_end || null,
                            client_id: form.client_id || null,
                            quote_id: editingQuote.id,
                            public_token: token,
                          }).select("id").single();
                          if (error) { toast({ title: "Erro ao criar roteiro", description: error.message, variant: "destructive" }); return; }
                          refetchLinkedItinerary();
                          queryClient.invalidateQueries({ queryKey: ["itineraries-for-link"] });
                          toast({ title: "Roteiro criado e vinculado!" });
                        }}>
                          <Plus className="w-3 h-3" /> Criar Novo Roteiro
                        </Button>

                        <span className="text-xs text-muted-foreground">ou</span>

                        <Popover open={itineraryLinkOpen} onOpenChange={setItineraryLinkOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                              <CalendarDays className="w-3 h-3" /> Vincular Roteiro Existente
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar roteiro..." className="h-8 text-xs" />
                              <CommandList>
                                <CommandEmpty className="py-3 text-xs">Nenhum roteiro encontrado.</CommandEmpty>
                                {allItineraries.filter((it: any) => !it.quote_id).map((it: any) => (
                                  <CommandItem key={it.id} onSelect={async () => {
                                    await supabase.from("itineraries").update({ quote_id: editingQuote.id }).eq("id", it.id);
                                    setItineraryLinkOpen(false);
                                    refetchLinkedItinerary();
                                    queryClient.invalidateQueries({ queryKey: ["itineraries-for-link"] });
                                    toast({ title: "Roteiro vinculado!" });
                                  }} className="text-xs cursor-pointer">
                                    <span className="truncate font-medium">{it.title}</span>
                                    {it.destination && <span className="ml-auto text-[10px] text-muted-foreground truncate">{it.destination}</span>}
                                  </CommandItem>
                                ))}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {editingQuote && (
              <TabsContent value="history" className="mt-3">
                <QuoteHistoryTab quoteId={editingQuote.id} />
              </TabsContent>
            )}
          </Tabs>
        </div>


        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 pb-3">
          <div className="flex flex-wrap gap-2">
            {editingQuote && (
              <>
                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive font-body gap-1.5 text-xs"
                  onClick={() => { if (confirm("Remover cotação?")) { deleteMutation.mutate(editingQuote.id); closeDialog(); } }}>
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </Button>
                <Button type="button" variant="outline" size="sm" className="font-body gap-1.5 text-xs"
                  onClick={() => {
                    const url = `${window.location.origin}/quote/${editingQuote.id}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: "Link copiado!", description: "Compartilhe com seu cliente." });
                  }}>
                  <Copy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Copiar Link</span><span className="sm:hidden">Link</span>
                </Button>
                <Button type="button" variant="outline" size="sm" className="font-body gap-1.5 text-xs"
                  onClick={() => window.open(`/quote/${editingQuote.id}`, "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Visualizar</span>
                </Button>
                <Button type="button" variant="outline" size="sm" className="font-body gap-1.5 text-xs"
                  onClick={() => handleCopySummary(editingQuote)}>
                  <ClipboardCopy className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Copiar resumo</span><span className="sm:hidden">Resumo</span>
                </Button>
                <Button type="button" variant="outline" size="sm" className="font-body gap-1.5 text-xs text-green-600 border-green-300 hover:bg-green-50"
                  onClick={openWhatsappDialog}>
                  <MessageCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">WhatsApp</span>
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={closeDialog} className="font-body gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </Button>
            <Button type="button" variant="outline" size="sm" className="font-body" onClick={() => saveQuote(true)}>
              Salvar e Voltar
            </Button>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="sm" className="font-body" onClick={() => saveQuote(false)}>
                    Salvar
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Salvar (Ctrl+S)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* WhatsApp Dialog */}
      <WhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <WhatsAppDialogContent className="max-w-md p-4 gap-0">
          <WhatsAppDialogHeader className="pb-2">
            <WhatsAppDialogTitle className="font-body flex items-center gap-2 text-base">
              <MessageCircle className="w-4 h-4 text-primary" /> Prévia do WhatsApp
            </WhatsAppDialogTitle>
          </WhatsAppDialogHeader>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-0.5">
                <Label className="font-body text-xs">Telefone do cliente</Label>
                <PhoneInput
                  value={whatsappPhone}
                  onChange={(digits) => setWhatsappPhone(digits)}
                  className="font-body h-8 text-sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-2.5">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-2.5 py-2 text-primary-foreground shadow-sm">
                  <div className="mb-1.5 overflow-hidden rounded-lg border border-primary-foreground/20 bg-primary-foreground/10">
                    <img src="https://storage.googleapis.com/gpt-engineer-file-uploads/Q5PyjPx9DmYrShMRadDhPe4XruD2/social-images/social-1772900670484-img_1010.webp" alt="Preview" className="h-20 w-full object-cover" />
                    <div className="px-2 py-1.5">
                      <p className="text-[11px] font-semibold text-primary-foreground leading-tight">Altivus Compass</p>
                      <p className="text-[9px] text-primary-foreground/70 leading-tight">Sistema de gestão da Altivus</p>
                      <p className="text-[9px] text-primary-foreground/60 leading-tight">compass.altivusturismo.com.br</p>
                    </div>
                  </div>
                  <p className="whitespace-pre-line break-words text-[13px] font-body leading-snug">{whatsappMessage}</p>
                  <p className="mt-0.5 text-right text-[9px] text-primary-foreground/80">agora</p>
                </div>
              </div>
            </div>

            <div className="space-y-0.5">
              <Label className="font-body text-xs">Mensagem</Label>
              <Textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={3}
                className="font-body text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setWhatsappOpen(false)} className="font-body h-8">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSendWhatsapp} disabled={sendingWhatsapp} className="font-body gap-1.5 h-8">
                {sendingWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                {sendingWhatsapp ? "Enviando..." : "Confirmar envio"}
              </Button>
            </div>
          </div>
        </WhatsAppDialogContent>
      </WhatsAppDialog>

      {/* Cover image zoom overlay */}
      {coverZoom && coverPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setCoverZoom(false)}>
          <div className="relative max-w-4xl max-h-[85vh] p-2">
            <img src={coverPreview} alt="Capa ampliada" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
            <button type="button" onClick={() => setCoverZoom(false)} className="absolute top-4 right-4 bg-background/80 text-foreground rounded-full p-1.5 hover:bg-background transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Unsaved changes confirmation */}
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">As mudanças não salvas serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="font-body bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setConfirmCloseOpen(false); performCloseDialog(); }}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  // Aggregate metrics (always over the global active set, not the filtered list)
  const activeStages = ["new", "sent", "negotiation"];
  const activeQuotesCount = (metricsQuotes as any[]).filter((q) => activeStages.includes(q.stage)).length;
  const negotiatingValue = (metricsQuotes as any[])
    .filter((q) => ["sent", "negotiation"].includes(q.stage))
    .reduce((sum, q) => sum + Number(q.total_value ?? 0), 0);
  const closedQuotes = (metricsQuotes as any[]).filter((q) => ["confirmed", "completed"].includes(q.stage));
  const wonCount = closedQuotes.filter((q) => q.conclusion_type === "won").length;
  const conversionRate = closedQuotes.length === 0
    ? "—"
    : `${Math.round((wonCount / closedQuotes.length) * 100)}%`;

  const hasActiveFilters = searchTerm !== "" || filterAssignee !== "all" || filterLeadSource !== "all";

  // ─── LIST VIEW (pipeline / table) ─────────────────────────
  return (
    <div className="max-w-full mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Pipeline de Cotações</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">
            {filteredQuotes.length} de {quotes.length} cotações{showArchived ? " arquivadas" : ""}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-2 text-xs font-body text-muted-foreground cursor-pointer select-none">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Ver arquivadas
          </label>
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button onClick={() => setViewMode("kanban")} className={`p-2 rounded-md transition-colors ${viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`} title="Kanban">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("table")} className={`p-2 rounded-md transition-colors ${viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`} title="Tabela">
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => openCreate()} className="font-body">
            <Plus className="w-4 h-4" /> Nova Cotação
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          title="Cotações ativas"
          value={String(activeQuotesCount)}
          icon={<TrendingUp className="w-4 h-4 text-soft-blue" />}
        />
        <MetricCard
          title="Valor em negociação"
          value={formatCurrency(negotiatingValue)}
          icon={<DollarSign className="w-4 h-4 text-gold" />}
        />
        <MetricCard
          title="Taxa de conversão"
          value={conversionRate}
          subtitle={closedQuotes.length > 0 ? `${wonCount} de ${closedQuotes.length} fechadas` : undefined}
          icon={<Target className="w-4 h-4 text-success" />}
        />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por título, destino, cliente ou ID..."
            className="pl-9 h-9 font-body text-sm"
          />
        </div>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-9 w-full sm:w-[180px] font-body text-sm"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {(sellers as any[]).map((s) => (
              <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLeadSource} onValueChange={setFilterLeadSource}>
          <SelectTrigger className="h-9 w-full sm:w-[170px] font-body text-sm"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {LEAD_SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pipelineSort} onValueChange={(v) => setPipelineSort(v as any)}>
          <SelectTrigger className="h-9 w-full sm:w-[180px] font-body text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigas</SelectItem>
            <SelectItem value="value_desc">Maior valor</SelectItem>
            <SelectItem value="value_asc">Menor valor</SelectItem>
            <SelectItem value="updated">Atualização recente</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="font-body h-9 gap-1.5"
            onClick={() => { setSearchInput(""); setFilterAssignee("all"); setFilterLeadSource("all"); }}
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      {showArchived && (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs font-body text-muted-foreground flex items-center gap-2">
          <Archive className="w-3.5 h-3.5" /> Mostrando apenas cotações arquivadas. Clique no toggle no topo para voltar.
        </div>
      )}

      {isLoading ? (
        viewMode === "kanban" ? <KanbanSkeleton columns={4} cardsPerColumn={3} /> : <TableSkeleton rows={6} columns={6} />
      ) : (
        <>
          {viewMode === "kanban" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 pb-4">
              {stages.map((stage) => {
                const stageQuotes = filteredQuotes.filter((q: Quote) => q.stage === stage.id);
                return (
                   <div key={stage.id} className="min-w-0 flex flex-col"
                     onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-accent/10"); }}
                     onDragLeave={(e) => { e.currentTarget.classList.remove("bg-accent/10"); }}
                     onDrop={(e) => {
                       e.preventDefault();
                       e.currentTarget.classList.remove("bg-accent/10");
                       if (draggedQuoteId) {
                         const q = quotes.find((q: Quote) => q.id === draggedQuoteId);
                         if (q && q.stage !== stage.id) updateQuoteStage(draggedQuoteId, stage.id);
                         setDraggedQuoteId(null);
                       }
                     }}
                   >
                    <div className="flex items-center gap-2 mb-3 px-1">
                       <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                       <span className="text-xs font-medium text-foreground font-body">{stage.label}</span>
                       <span className="text-xs text-muted-foreground font-body ml-auto">{stageQuotes.length}</span>
                     </div>
                     <div className="space-y-3 min-h-[60px] rounded-lg transition-colors">
                       {stageQuotes.map((quote: Quote) => (
                         <div key={quote.id}
                           draggable
                           onDragStart={() => setDraggedQuoteId(quote.id)}
                           onDragEnd={() => setDraggedQuoteId(null)}
                          className={cn("glass-card rounded-xl p-3 cursor-grab hover:shadow-md transition-all animate-fade-in active:cursor-grabbing", draggedQuoteId === quote.id && "opacity-40", showArchived && "opacity-60")}
                           onClick={() => openEdit(quote)}
                         >
                           <div className="flex items-start justify-between mb-1 gap-2">
                              <p className="text-sm font-medium font-body text-foreground flex-1 min-w-0 truncate">{quote.title || quote.destination || "Sem título"}</p>
                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs font-semibold text-foreground font-body">{formatCurrency(quote.total_value)}</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()} aria-label="Ações">
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="font-body" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onClick={() => handleCopySummary(quote)}>
                                      <ClipboardCopy className="w-3.5 h-3.5 mr-2" /> Copiar resumo
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenInWhatsapp(quote)}>
                                      <MessageCircle className="w-3.5 h-3.5 mr-2" /> Abrir no WhatsApp
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                           <p className="text-xs text-muted-foreground font-body mb-2">{quote.client_name}</p>
                           {stage.id === "confirmed" && quote.conclusion_type && (
                             <Badge variant={quote.conclusion_type === "won" ? "default" : "destructive"} className="text-[10px] mb-2">
                               {quote.conclusion_type === "won" ? "Convertida" : "Perdida"}
                             </Badge>
                           )}
                           <div className="text-[10px] text-muted-foreground font-body">
                             <span>{quote.travel_date_start ? quote.travel_date_start.split("-").reverse().join("/") : ""} {quote.travel_date_end ? `– ${quote.travel_date_end.split("-").reverse().join("/")}` : ""}</span>
                           </div>
                         </div>
                       ))}
                      {stageQuotes.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/50 p-4 sm:p-6 text-center">
                          <p className="text-xs text-muted-foreground font-body">Sem cotações</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer font-body" onClick={() => handleSort("title")}>
                      Título {getSortIcon("title")}
                    </TableHead>
                    <TableHead className="cursor-pointer font-body" onClick={() => handleSort("client_name")}>
                      Cliente {getSortIcon("client_name")}
                    </TableHead>
                    <TableHead className="cursor-pointer font-body" onClick={() => handleSort("travel_date_start")}>
                      Data {getSortIcon("travel_date_start")}
                    </TableHead>
                    <TableHead className="cursor-pointer font-body" onClick={() => handleSort("stage")}>
                      Estágio {getSortIcon("stage")}
                    </TableHead>
                     <TableHead className="cursor-pointer font-body" onClick={() => handleSort("total_value")}>
                       Valor {getSortIcon("total_value")}
                     </TableHead>
                     <TableHead className="font-body w-10"></TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center p-8 text-muted-foreground font-body">Nenhuma cotação encontrada.</TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotes.map((quote: Quote) => {
                      const stage = stages.find((s) => s.id === quote.stage) ?? stages[0];
                      return (
                        <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(quote)}>
                          <TableCell className="font-medium font-body">{quote.title || quote.destination || "-"}</TableCell>
                          <TableCell className="font-body text-muted-foreground">{quote.client_name}</TableCell>
                          <TableCell className="font-body text-xs text-muted-foreground whitespace-nowrap">
                            {quote.travel_date_start ? quote.travel_date_start.split("-").reverse().join("/") : ""} {quote.travel_date_end ? `até ${quote.travel_date_end.split("-").reverse().join("/")}` : ""}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.color}`} />
                              <span className="text-xs text-muted-foreground font-body whitespace-nowrap">{stage.label}</span>
                              {quote.stage === "confirmed" && quote.conclusion_type && (
                                <Badge variant={quote.conclusion_type === "won" ? "default" : "destructive"} className="text-[10px]">
                                  {quote.conclusion_type === "won" ? "Convertida" : "Perdida"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                           <TableCell className="font-body font-medium">{formatCurrency(quote.total_value)}</TableCell>
                           <TableCell onClick={(e) => e.stopPropagation()}>
                             <div className="flex items-center gap-1">
                               <TooltipProvider>
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <Button
                                       variant="ghost"
                                       size="icon"
                                       className="h-7 w-7"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         window.open(`/orcamento/${quote.id}`, "_blank");
                                       }}
                                     >
                                       <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                     </Button>
                                   </TooltipTrigger>
                                   <TooltipContent>Ver cotação pública</TooltipContent>
                                 </Tooltip>
                               </TooltipProvider>
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações">
                                     <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                   </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end" className="font-body">
                                   <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopySummary(quote); }}>
                                     <ClipboardCopy className="w-3.5 h-3.5 mr-2" /> Copiar resumo
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenInWhatsapp(quote); }}>
                                     <MessageCircle className="w-3.5 h-3.5 mr-2" /> Abrir no WhatsApp
                                   </DropdownMenuItem>
                                   {quote.archived_at ? (
                                     <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setUnarchiveTarget(quote); }}>
                                       <ArchiveRestore className="w-3.5 h-3.5 mr-2" /> Desarquivar
                                     </DropdownMenuItem>
                                   ) : (
                                     <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setArchiveTarget(quote); }}>
                                       <Archive className="w-3.5 h-3.5 mr-2" /> Arquivar
                                     </DropdownMenuItem>
                                   )}
                                 </DropdownMenuContent>
                               </DropdownMenu>
                             </div>
                           </TableCell>
                         </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Summary fallback dialog (when clipboard API is unavailable) */}
      <WhatsAppDialog open={!!summaryFallbackText} onOpenChange={(o) => { if (!o) setSummaryFallbackText(null); }}>
        <WhatsAppDialogContent className="max-w-lg">
          <WhatsAppDialogHeader>
            <WhatsAppDialogTitle className="font-body text-base">Copie o resumo manualmente</WhatsAppDialogTitle>
          </WhatsAppDialogHeader>
          <Textarea readOnly value={summaryFallbackText ?? ""} rows={14} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSummaryFallbackText(null)}>Fechar</Button>
          </div>
        </WhatsAppDialogContent>
      </WhatsAppDialog>

      {/* WhatsApp Dialog */}
      <WhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen}>
        <WhatsAppDialogContent className="max-w-md p-4 gap-0">
          <WhatsAppDialogHeader className="pb-2">
            <WhatsAppDialogTitle className="font-body flex items-center gap-2 text-base">
              <MessageCircle className="w-4 h-4 text-primary" /> Prévia do WhatsApp
            </WhatsAppDialogTitle>
          </WhatsAppDialogHeader>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-0.5">
                <Label className="font-body text-xs">Telefone do cliente</Label>
                <PhoneInput
                  value={whatsappPhone}
                  onChange={(digits) => setWhatsappPhone(digits)}
                  className="font-body h-8 text-sm"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-2.5">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-2.5 py-2 text-primary-foreground shadow-sm">
                  <div className="mb-1.5 overflow-hidden rounded-lg border border-primary-foreground/20 bg-primary-foreground/10">
                    <img src="https://storage.googleapis.com/gpt-engineer-file-uploads/Q5PyjPx9DmYrShMRadDhPe4XruD2/social-images/social-1772900670484-img_1010.webp" alt="Preview" className="h-20 w-full object-cover" />
                    <div className="px-2 py-1.5">
                      <p className="text-[11px] font-semibold text-primary-foreground leading-tight">Altivus Compass</p>
                      <p className="text-[9px] text-primary-foreground/70 leading-tight">Sistema de gestão da Altivus</p>
                      <p className="text-[9px] text-primary-foreground/60 leading-tight">compass.altivusturismo.com.br</p>
                    </div>
                  </div>
                  <p className="whitespace-pre-line break-words text-[13px] font-body leading-snug">{whatsappMessage}</p>
                  <p className="mt-0.5 text-right text-[9px] text-primary-foreground/80">agora</p>
                </div>
              </div>
            </div>

            <div className="space-y-0.5">
              <Label className="font-body text-xs">Mensagem</Label>
              <Textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={3}
                className="font-body text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setWhatsappOpen(false)} className="font-body h-8">
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSendWhatsapp} disabled={sendingWhatsapp} className="font-body gap-1.5 h-8">
                {sendingWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                Confirmar envio
              </Button>
            </div>
          </div>
        </WhatsAppDialogContent>
      </WhatsAppDialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Arquivar cotação?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              A cotação "{archiveTarget?.title || "sem título"}" será movida para o arquivo e deixará de aparecer no kanban principal. Você poderá desarquivá-la a qualquer momento ativando "Ver arquivadas".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="font-body"
              onClick={() => {
                if (archiveTarget) {
                  archiveMutation.mutate(archiveTarget);
                  setArchiveTarget(null);
                }
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unarchive confirmation */}
      <AlertDialog open={!!unarchiveTarget} onOpenChange={(open) => !open && setUnarchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Desarquivar cotação?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              A cotação "{unarchiveTarget?.title || "sem título"}" voltará a aparecer no kanban principal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="font-body"
              onClick={() => {
                if (unarchiveTarget) {
                  unarchiveMutation.mutate(unarchiveTarget);
                  setUnarchiveTarget(null);
                }
              }}
            >
              Desarquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
