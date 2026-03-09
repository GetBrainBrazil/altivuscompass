import { useState, useEffect, useRef, useMemo } from "react";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Table as TableIcon, ArrowUp, ArrowDown, ArrowUpDown, ArrowLeft, Plus, Trash2, Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, Map, CalendarDays, Image as ImageIcon, X, ChevronsUpDown, Check, ExternalLink, Copy, Wand2, Loader2, Info, CalendarIcon, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import QuoteHistoryTab from "@/components/quotes/QuoteHistoryTab";

const stages = [
  { id: "new", label: "Nova Cotação", color: "bg-soft-blue" },
  { id: "sent", label: "Cotação Enviada", color: "bg-gold" },
  { id: "negotiation", label: "Negociação", color: "bg-warning" },
  { id: "confirmed", label: "Concluída", color: "bg-muted-foreground" },
];

const ITEM_TYPES = [
  { id: "flight", label: "Voos", icon: Plane },
  { id: "hotel", label: "Hospedagem", icon: Hotel },
  { id: "transport", label: "Transporte", icon: Bus },
  { id: "cruise", label: "Cruzeiro", icon: Ship },
  { id: "experience", label: "Experiências", icon: Sparkles },
  { id: "insurance", label: "Seguros", icon: Shield },
  { id: "other_service", label: "Outros Serviços", icon: Package },
  { id: "itinerary", label: "Roteiro Dia a Dia", icon: CalendarDays },
  { id: "map", label: "Mapa", icon: Map },
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
  client_name?: string;
  travel_date_start: string | null;
  travel_date_end: string | null;
  notes: string | null;
};

type QuoteItem = {
  id?: string;
  item_type: string;
  title: string;
  description: string;
  details: Record<string, any>;
  sort_order: number;
  _isNew?: boolean;
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
  const [activeTab, setActiveTab] = useState("flight");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedPassengers, setSelectedPassengers] = useState<string[]>([]);
  const [selectedLinkedClients, setSelectedLinkedClients] = useState<string[]>([]);
  const [clientSelfTraveling, setClientSelfTraveling] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [generatingDetails, setGeneratingDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [destOpen, setDestOpen] = useState(false);
  const [coverZoom, setCoverZoom] = useState(false);
  const [draggedQuoteId, setDraggedQuoteId] = useState<string | null>(null);
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((q: any) => ({ ...q, client_name: q.clients?.full_name ?? "Sem cliente" }));
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name, seat_preference, preferred_airports, travel_profile, travel_preferences, desired_destinations").order("full_name");
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

  // Load existing quote items when editing
  useEffect(() => {
    if (editingQuote) {
      supabase.from("quote_items").select("*").eq("quote_id", editingQuote.id).order("sort_order").then(({ data }) => {
        setItems((data ?? []).map((i: any) => ({ ...i, details: i.details ?? {} })));
      });
      supabase.from("quote_passengers").select("passenger_id").eq("quote_id", editingQuote.id).then(({ data }) => {
        setSelectedPassengers((data ?? []).map((p: any) => p.passenger_id));
      });
      // Load linked client IDs from price_breakdown
      const pb = (editingQuote as any).price_breakdown;
      if (pb && typeof pb === 'object') {
        if (Array.isArray((pb as any).linked_client_ids)) {
          setSelectedLinkedClients((pb as any).linked_client_ids);
        }
        setClientSelfTraveling(!!(pb as any).client_self_traveling);
      }
    }
  }, [editingQuote]);

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

  const saveQuote = async (closeAfter: boolean) => {
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
        stage,
        conclusion_type,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        notes: form.notes || null,
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

      toast({ title: editingQuote ? "Cotação atualizada" : "Cotação criada" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });

      if (closeAfter) {
        closeDialog();
      } else if (!editingQuote && quoteId) {
        setEditingQuote({ ...payload, id: quoteId, created_at: new Date().toISOString() } as Quote);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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

  const openCreate = () => {
    setEditingQuote(null);
    setForm({ stage: "new", total_value: "" });
    setItems([]);
    setSelectedPassengers([]);
    setSelectedLinkedClients([]);
    setClientSelfTraveling(false);
    setSelectedDestinations([]);
    setCoverFile(null);
    setCoverPreview(null);
    setActiveTab("flight");
    setDialogOpen(true);
  };

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
      stage: q.stage,
      conclusion_type: q.conclusion_type ?? "won",
      travel_date_start: q.travel_date_start ?? "",
      travel_date_end: q.travel_date_end ?? "",
      notes: q.notes ?? "",
      flexible_dates: pb?.flexible_dates ?? false,
      flexible_dates_description: pb?.flexible_dates_description ?? "",
    });
    setSelectedDestinations(q.destination ? q.destination.split(", ").filter(Boolean) : []);
    setClientSelfTraveling(pb?.client_self_traveling ?? false);
    setCoverFile(null);
    setCoverPreview(q.cover_image_url || null);
    setActiveTab("flight");
    setDialogOpen(true);
  };

  const closeDialog = () => {
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
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const addItem = (type: string) => {
    setItems([...items, { item_type: type, title: "", description: "", details: {}, sort_order: items.length, _isNew: true }]);
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

  const TRAVEL_PROFILE_LABELS: Record<string, string> = { economic: "Econômico", opportunity: "Oportunidade", sophisticated: "Sofisticado" };

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
          <h1 className="text-xl font-display font-semibold text-foreground">
            {editingQuote ? "Editar Cotação" : "Nova Cotação"}
          </h1>
        </div>

        {/* Stage stepper */}
        <div className="glass-card rounded-xl px-4 py-3">
          <div className="flex items-center gap-1">
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
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all cursor-pointer whitespace-nowrap",
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

        {/* Main fields card */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          {/* Row 1: Título, Cliente, Imagem de Capa */}
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-3">
            <div className="col-span-2 lg:col-span-4 space-y-1">
              <Label className="font-body text-xs">Título da Cotação</Label>
              <Input className="h-9 text-sm" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Viagem Europa - Família Silva" />
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

          {/* Row 2: Datas / Data Flexível, Destinos */}
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-3">
            {/* Data Flexível toggle */}
            <div className="col-span-1 lg:col-span-1 space-y-1">
              <Label className="font-body text-xs whitespace-nowrap">Flexível</Label>
              <div className="flex items-center h-9">
                <Switch checked={!!form.flexible_dates} onCheckedChange={(v) => setForm({ ...form, flexible_dates: v, ...(v ? { travel_date_start: "", travel_date_end: "" } : {}) })} />
              </div>
            </div>

            {!form.flexible_dates ? (
              <>
                <div className="col-span-1 lg:col-span-2 space-y-1">
                  <Label className="font-body text-xs">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left text-sm font-normal", !form.travel_date_start && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {form.travel_date_start ? format(parseISO(form.travel_date_start), "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.travel_date_start ? parseISO(form.travel_date_start) : undefined} onSelect={(date) => setForm({ ...form, travel_date_start: date ? format(date, "yyyy-MM-dd") : "" })} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-1 lg:col-span-2 space-y-1">
                  <Label className="font-body text-xs">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left text-sm font-normal", !form.travel_date_end && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {form.travel_date_end ? format(parseISO(form.travel_date_end), "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.travel_date_end ? parseISO(form.travel_date_end) : undefined} onSelect={(date) => setForm({ ...form, travel_date_end: date ? format(date, "yyyy-MM-dd") : "" })} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            ) : (
              <div className="col-span-1 lg:col-span-4 space-y-1">
                <Label className="font-body text-xs">Descrição das Datas</Label>
                <Input className="h-9 text-sm" value={form.flexible_dates_description ?? ""} onChange={(e) => setForm({ ...form, flexible_dates_description: e.target.value })} placeholder="Ex: Qualquer semana em julho..." />
              </div>
            )}

            {/* Viajantes (shown when client selected) */}
            {form.client_id && (
              <div className="col-span-2 lg:col-span-5 space-y-1">
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
                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0 mr-1">{RELATIONSHIP_LABELS[lc.relationship_type] || lc.relationship_type}</Badge>
                            <span className="truncate">{lc.full_name}</span>
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
          </div>

          {/* Row 3: Destino(s) */}
          <div className="grid grid-cols-2 lg:grid-cols-12 gap-x-3 gap-y-3">
            <div className="col-span-2 lg:col-span-5 space-y-1">
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
        </div>

        {/* Tabs for items */}
        <div className="glass-card rounded-xl p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted p-0.5 w-full justify-start">
              {editingQuote && (
                <TabsTrigger value="history" className="flex items-center gap-1 text-[11px] px-2 py-1 bg-primary/15 text-primary border border-primary/30 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary">
                  <History className="w-3 h-3" />
                  Histórico
                </TabsTrigger>
              )}
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
            </TabsList>

            {ITEM_TYPES.map((type) => (
              <TabsContent key={type.id} value={type.id} className="mt-3 space-y-2">
                {itemsForType(type.id).map((item, idx) => {
                  const globalIdx = items.indexOf(item);
                  const d = item.details || {};
                  const updateDetail = (key: string, value: any) => {
                    updateItem(globalIdx, { details: { ...d, [key]: value } });
                  };

                  return (
                    <div key={globalIdx} className="border border-border rounded-md p-3 relative">
                      <button type="button" onClick={() => removeItem(globalIdx)} className="absolute top-2.5 right-2.5 text-destructive hover:text-destructive/80 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {type.id === "flight" ? (
                        <div className="space-y-2.5 pr-6">
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
                              <Input value={d.duration || ""} onChange={(e) => updateDetail("duration", e.target.value)} placeholder="Ex: 12h30" className="h-8 text-xs" />
                            </div>
                            <div className="col-span-3 space-y-0.5">
                              <Label className="text-[11px] font-body">Companhia</Label>
                              <Input value={d.airline || ""} onChange={(e) => updateDetail("airline", e.target.value)} placeholder="Ex: LATAM" className="h-8 text-xs" />
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

                          {/* Row 5: Passenger counts */}
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-1 space-y-0.5">
                              <Label className="text-[11px] font-body text-center block">🧑 ADT</Label>
                              <Input type="number" min={0} value={d.pax_adults ?? 1} onChange={(e) => updateDetail("pax_adults", parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                            </div>
                            <div className="col-span-1 space-y-0.5">
                              <Label className="text-[11px] font-body text-center block">👶 CHD</Label>
                              <Input type="number" min={0} value={d.pax_children ?? 0} onChange={(e) => updateDetail("pax_children", parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                            </div>
                            <div className="col-span-1 space-y-0.5">
                              <Label className="text-[11px] font-body text-center block">🍼 INF</Label>
                              <Input type="number" min={0} value={d.pax_infants ?? 0} onChange={(e) => updateDetail("pax_infants", parseInt(e.target.value) || 0)} className="h-8 text-xs text-center" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Generic form for non-flight items */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-6">
                          <div className="space-y-0.5">
                            <Label className="text-[11px] font-body">Título</Label>
                            <Input value={item.title} onChange={(e) => updateItem(globalIdx, { title: e.target.value })} placeholder={`Nome do ${type.label.toLowerCase()}`} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-0.5">
                            <Label className="text-[11px] font-body">Descrição</Label>
                            <Input value={item.description} onChange={(e) => updateItem(globalIdx, { description: e.target.value })} placeholder="Detalhes adicionais" className="h-8 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <Button type="button" variant="outline" size="sm" className="gap-1 font-body text-xs h-8" onClick={() => addItem(type.id)}>
                  <Plus className="w-3 h-3" /> Adicionar {type.label}
                </Button>
              </TabsContent>
            ))}

            {editingQuote && (
              <TabsContent value="history" className="mt-3">
                <QuoteHistoryTab quoteId={editingQuote.id} />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Details card */}
        <div className="glass-card rounded-xl p-4">
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 pb-3">
          <div className="flex gap-2">
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
                  <Copy className="w-3.5 h-3.5" /> Copiar Link
                </Button>
                <Button type="button" variant="outline" size="sm" className="font-body gap-1.5 text-xs"
                  onClick={() => window.open(`/quote/${editingQuote.id}`, "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5" /> Visualizar
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeDialog} className="font-body gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </Button>
            <Button type="button" variant="outline" size="sm" className="font-body" onClick={() => saveQuote(true)}>
              Salvar e Voltar
            </Button>
            <Button type="button" size="sm" className="font-body" onClick={() => saveQuote(false)}>
              Salvar
            </Button>
          </div>
        </div>
      </div>

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
      </>
    );
  }

  // ─── LIST VIEW (pipeline / table) ─────────────────────────
  return (
    <div className="max-w-full mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Pipeline de Cotações</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">{quotes.length} cotações</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            <button onClick={() => setViewMode("kanban")} className={`p-2 rounded-md transition-colors ${viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`} title="Kanban">
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("table")} className={`p-2 rounded-md transition-colors ${viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"}`} title="Tabela">
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={openCreate} className="font-body">
            <Plus className="w-4 h-4" /> Nova Cotação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
      ) : (
        <>
          {viewMode === "kanban" ? (
            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
              {stages.map((stage) => {
                const stageQuotes = quotes.filter((q: Quote) => q.stage === stage.id);
                return (
                   <div key={stage.id} className="min-w-[240px] sm:min-w-[280px] flex-shrink-0"
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
                           className={cn("glass-card rounded-xl p-3 sm:p-4 cursor-grab hover:shadow-md transition-all animate-fade-in active:cursor-grabbing", draggedQuoteId === quote.id && "opacity-40")}
                           onClick={() => openEdit(quote)}
                         >
                          <div className="flex items-start justify-between mb-1">
                             <p className="text-sm font-medium font-body text-foreground">{quote.title || quote.destination || "Sem título"}</p>
                             <span className="text-xs font-semibold text-foreground font-body ml-2">{formatCurrency(quote.total_value)}</span>
                           </div>
                           <p className="text-xs text-muted-foreground font-body mb-2">{quote.client_name}</p>
                           {stage.id === "confirmed" && quote.conclusion_type && (
                             <Badge variant={quote.conclusion_type === "won" ? "default" : "destructive"} className="text-[10px] mb-2">
                               {quote.conclusion_type === "won" ? "Convertida" : "Perdida"}
                             </Badge>
                           )}
                           <div className="text-[10px] text-muted-foreground font-body">
                             <span>{quote.travel_date_start ?? ""} {quote.travel_date_end ? `– ${quote.travel_date_end}` : ""}</span>
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
                  {sortedQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center p-8 text-muted-foreground font-body">Nenhuma cotação encontrada.</TableCell>
                    </TableRow>
                  ) : (
                    sortedQuotes.map((quote: Quote) => {
                      const stage = stages.find((s) => s.id === quote.stage) ?? stages[0];
                      return (
                        <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(quote)}>
                          <TableCell className="font-medium font-body">{quote.title || quote.destination || "-"}</TableCell>
                          <TableCell className="font-body text-muted-foreground">{quote.client_name}</TableCell>
                          <TableCell className="font-body text-xs text-muted-foreground whitespace-nowrap">
                            {quote.travel_date_start ?? ""} {quote.travel_date_end ? `até ${quote.travel_date_end}` : ""}
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
                           <TableCell>
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
    </div>
  );
}
