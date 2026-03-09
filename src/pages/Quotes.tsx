import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Table as TableIcon, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const stages = [
  { id: "new", label: "Nova Cotação", color: "bg-soft-blue" },
  { id: "sent", label: "Cotação Enviada", color: "bg-gold" },
  { id: "negotiation", label: "Negociação", color: "bg-warning" },
  { id: "confirmed", label: "Concluída", color: "bg-muted-foreground" },
];

type Quote = {
  id: string;
  client_id: string | null;
  destination: string | null;
  departure_city: string | null;
  departure_airport: string | null;
  travel_date_start: string | null;
  travel_date_end: string | null;
  total_value: number | null;
  stage: string;
  airline_options: string | null;
  hotel_options: string | null;
  notes: string | null;
  conclusion_type: string | null;
  created_at: string;
  client_name?: string;
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const stage = form.stage || "new";
      const conclusion_type = stage === "confirmed" ? (form.conclusion_type || "won") : null;
      const payload: any = {
        client_id: form.client_id || null, destination: form.destination || null,
        departure_city: form.departure_city || null, departure_airport: form.departure_airport || null,
        travel_date_start: form.travel_date_start || null, travel_date_end: form.travel_date_end || null,
        total_value: form.total_value ? Number(form.total_value) : 0, stage,
        airline_options: form.airline_options || null, hotel_options: form.hotel_options || null, 
        notes: form.notes || null, conclusion_type,
      };
      if (editingQuote) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", editingQuote.id);
        if (error) throw error;
        // If converting to sale, create a sale record
        if (stage === "confirmed" && conclusion_type === "won" && editingQuote.stage !== "confirmed") {
          await createSaleFromQuote(editingQuote.id, payload);
        }
      } else {
        const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
        if (error) throw error;
        if (stage === "confirmed" && conclusion_type === "won") {
          await createSaleFromQuote(data.id, payload);
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingQuote ? "Cotação atualizada" : "Cotação criada" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

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
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cotação removida" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditingQuote(null); setForm({ stage: "new", total_value: "" }); setDialogOpen(true); };
  const openEdit = (q: Quote) => {
    setEditingQuote(q);
    setForm({
      client_id: q.client_id ?? "", destination: q.destination ?? "", departure_city: q.departure_city ?? "",
      departure_airport: q.departure_airport ?? "", travel_date_start: q.travel_date_start ?? "",
      travel_date_end: q.travel_date_end ?? "", total_value: q.total_value ?? "",
      stage: q.stage, conclusion_type: q.conclusion_type ?? "won",
      airline_options: q.airline_options ?? "", hotel_options: q.hotel_options ?? "", notes: q.notes ?? "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingQuote(null); setForm({}); };

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
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50 inline-block" />;
    return sortDir === "asc" ? <ArrowUp className="ml-2 h-4 w-4 inline-block" /> : <ArrowDown className="ml-2 h-4 w-4 inline-block" />;
  };

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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="font-body">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Nova Cotação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingQuote ? "Editar Cotação" : "Nova Cotação"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-body">Cliente</Label>
                    <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                      <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Destino</Label>
                    <Input value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Cidade de saída</Label>
                    <Input value={form.departure_city ?? ""} onChange={(e) => setForm({ ...form, departure_city: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Aeroporto de saída</Label>
                    <Input value={form.departure_airport ?? ""} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} placeholder="GRU" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Valor total (R$)</Label>
                    <Input type="number" step="0.01" value={form.total_value ?? ""} onChange={(e) => setForm({ ...form, total_value: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Data ida</Label>
                    <Input type="date" value={form.travel_date_start ?? ""} onChange={(e) => setForm({ ...form, travel_date_start: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Data volta</Label>
                    <Input type="date" value={form.travel_date_end ?? ""} onChange={(e) => setForm({ ...form, travel_date_end: e.target.value })} />
                  </div>
                  <div className={`space-y-2 ${form.stage === "confirmed" ? "" : "sm:col-span-2"}`}>
                    <Label className="font-body">Estágio</Label>
                    <Select value={form.stage ?? "new"} onValueChange={(v) => setForm({ ...form, stage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.stage === "confirmed" && (
                    <div className="space-y-2">
                      <Label className="font-body">Resultado</Label>
                      <Select value={form.conclusion_type ?? "won"} onValueChange={(v) => setForm({ ...form, conclusion_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="won">Convertida em venda</SelectItem>
                          <SelectItem value="lost">Perdida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-body">Opções de aéreas</Label>
                    <Textarea value={form.airline_options ?? ""} onChange={(e) => setForm({ ...form, airline_options: e.target.value })} rows={2} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-body">Opções de hotel</Label>
                    <Textarea value={form.hotel_options ?? ""} onChange={(e) => setForm({ ...form, hotel_options: e.target.value })} rows={2} />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-body">Observações</Label>
                    <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog} className="font-body">Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending} className="font-body">
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
      ) : (
        <>
          {/* Kanban */}
          <div className={`${viewMode === "list" ? "hidden sm:flex" : "flex"} gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0`}>
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
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-medium font-body text-foreground">{quote.destination || "Sem destino"}</p>
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

          {/* List view - mobile */}
          <div className={`${viewMode === "kanban" ? "hidden" : "block"} sm:hidden space-y-3`}>
            {quotes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-body">Nenhuma cotação.</div>
            ) : (
              quotes.map((quote: Quote) => {
                const stage = stages.find(s => s.id === quote.stage) ?? stages[0];
                return (
                  <div key={quote.id} className="glass-card rounded-xl p-4 space-y-2" onClick={() => openEdit(quote)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium font-body text-foreground">{quote.destination || "Sem destino"}</p>
                        <p className="text-xs text-muted-foreground font-body">{quote.client_name}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground font-body">{formatCurrency(quote.total_value)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                        <span className="text-xs text-muted-foreground font-body">{stage.label}</span>
                        {quote.stage === "confirmed" && quote.conclusion_type && (
                          <Badge variant={quote.conclusion_type === "won" ? "default" : "destructive"} className="text-[10px]">
                            {quote.conclusion_type === "won" ? "Convertida" : "Perdida"}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-body">{quote.travel_date_start ?? ""}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
