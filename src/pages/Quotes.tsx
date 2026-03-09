import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Table as TableIcon, ArrowUp, ArrowDown, ArrowUpDown, ArrowLeft, Plus, Trash2, Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, Map, CalendarDays, Image as ImageIcon, X, ChevronsUpDown, Check, ExternalLink, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const { data, error } = await supabase.from("clients").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch passengers for selected client
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
        .select("*, client_a:clients!client_relationships_client_id_a_fkey(id, full_name), client_b:clients!client_relationships_client_id_b_fkey(id, full_name)")
        .or(`client_id_a.eq.${selectedClientId},client_id_b.eq.${selectedClientId}`);
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const isA = r.client_id_a === selectedClientId;
        return {
          id: isA ? r.client_b?.id : r.client_a?.id,
          full_name: isA ? r.client_b?.full_name : r.client_a?.full_name,
          relationship_type: r.relationship_type,
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
      if (pb && typeof pb === 'object' && Array.isArray((pb as any).linked_client_ids)) {
        setSelectedLinkedClients((pb as any).linked_client_ids);
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
        destination: form.destination || null,
        total_value: form.total_value ? Number(form.total_value) : 0,
        stage,
        conclusion_type,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        notes: form.notes || null,
        price_breakdown: { linked_client_ids: selectedLinkedClients },
      };

      if (editingQuote) {
        const coverUrl = await uploadCoverImage(editingQuote.id);
        payload.cover_image_url = coverUrl;
        const { error } = await supabase.from("quotes").update(payload).eq("id", editingQuote.id);
        if (error) throw error;
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
          const itemPayload = {
            quote_id: quoteId,
            item_type: item.item_type,
            title: item.title || null,
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
    setCoverFile(null);
    setCoverPreview(null);
    setActiveTab("flight");
    setDialogOpen(true);
  };

  const openEdit = (q: Quote) => {
    setEditingQuote(q);
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
    });
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

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
      <div className="max-w-full mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={closeDialog} className="shrink-0 h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-display font-semibold text-foreground">
            {editingQuote ? "Editar Cotação" : "Nova Cotação"}
          </h1>
        </div>

        {/* Main fields card */}
        <div className="glass-card rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-3">
            {/* Título */}
            <div className="col-span-2 space-y-1">
              <Label className="font-body text-xs">Título da Cotação</Label>
              <Input className="h-9 text-sm" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Viagem Europa - Família Silva" />
            </div>

            {/* Cliente */}
            <div className="col-span-2 lg:col-span-3 space-y-1">
              <Label className="font-body text-xs">Cliente</Label>
              <Select value={form.client_id ?? ""} onValueChange={(v) => { setForm({ ...form, client_id: v }); setSelectedPassengers([]); setSelectedLinkedClients([]); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Estágio */}
            <div className="col-span-2 lg:col-span-2 space-y-1">
              <Label className="font-body text-xs">Estágio</Label>
              <Select value={form.stage ?? "new"} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="col-span-2 lg:col-span-1 space-y-1">
              <Label className="font-body text-xs">Valor total (R$)</Label>
              <Input className="h-9 text-sm" type="number" step="0.01" value={form.total_value ?? ""} onChange={(e) => setForm({ ...form, total_value: e.target.value })} />
            </div>

            {form.stage === "confirmed" && (
              <div className="col-span-2 space-y-1">
                <Label className="font-body text-xs">Resultado</Label>
                <Select value={form.conclusion_type ?? "won"} onValueChange={(v) => setForm({ ...form, conclusion_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">Convertida em venda</SelectItem>
                    <SelectItem value="lost">Perdida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Imagem de capa */}
            <div className="col-span-2 space-y-1">
              <Label className="font-body text-xs">Imagem de Capa</Label>
              <div className="flex items-center gap-2">
                {coverPreview ? (
                  <div className="relative">
                    <img src={coverPreview} alt="Capa" className="h-9 w-16 object-cover rounded border border-border" />
                    <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); setForm({ ...form, cover_image_url: "" }); }} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 px-3 border border-dashed border-border rounded-md flex items-center gap-1.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors text-xs">
                    <ImageIcon className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </div>
            </div>

            {/* Passageiros & clientes vinculados */}
            {form.client_id && (clientPassengers.length > 0 || linkedClients.length > 0) && (
              <div className="col-span-2 lg:col-span-6 space-y-1">
                <Label className="font-body text-xs font-semibold">Passageiros e Clientes Vinculados</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-9 text-sm font-normal">
                      {(selectedPassengers.length + selectedLinkedClients.length) === 0
                        ? "Selecionar pessoas..."
                        : `${selectedPassengers.length + selectedLinkedClients.length} selecionado(s)`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty className="py-3 text-xs">Nenhum encontrado.</CommandEmpty>
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
              </div>
            )}
          </div>
        </div>

        {/* Tabs for items */}
        <div className="glass-card rounded-xl p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted p-0.5 w-full justify-start">
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
                  return (
                    <div key={globalIdx} className="border border-border rounded-md p-3 relative">
                      <button type="button" onClick={() => removeItem(globalIdx)} className="absolute top-2.5 right-2.5 text-destructive hover:text-destructive/80 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                    </div>
                  );
                })}

                <Button type="button" variant="outline" size="sm" className="gap-1 font-body text-xs h-8" onClick={() => addItem(type.id)}>
                  <Plus className="w-3 h-3" /> Adicionar {type.label}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Details card */}
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="lg:col-span-2 space-y-1">
              <Label className="font-body text-xs">Detalhes</Label>
              <Textarea value={form.details ?? ""} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={2} className="text-sm" placeholder="Descrição geral da viagem, roteiro resumido..." />
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
          <div>
            {editingQuote && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive font-body gap-1.5 text-xs"
                onClick={() => { if (confirm("Remover cotação?")) { deleteMutation.mutate(editingQuote.id); closeDialog(); } }}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir Cotação
              </Button>
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
                  <div key={stage.id} className="min-w-[240px] sm:min-w-[280px] flex-shrink-0">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      <span className="text-xs font-medium text-foreground font-body">{stage.label}</span>
                      <span className="text-xs text-muted-foreground font-body ml-auto">{stageQuotes.length}</span>
                    </div>
                    <div className="space-y-3">
                      {stageQuotes.map((quote: Quote) => (
                        <div key={quote.id} className="glass-card rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" onClick={() => openEdit(quote)}>
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
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-body">
                            <span>{quote.travel_date_start ?? ""} {quote.travel_date_end ? `– ${quote.travel_date_end}` : ""}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px]" onClick={(e) => { e.stopPropagation(); if (confirm("Remover cotação?")) deleteMutation.mutate(quote.id); }}>✕</Button>
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
                    <TableHead className="w-[80px]"></TableHead>
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
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Remover cotação?")) deleteMutation.mutate(quote.id); }}>
                              ✕
                            </Button>
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
