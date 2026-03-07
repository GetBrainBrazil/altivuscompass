import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const stages = [
  { id: "new", label: "Nova Cotação", color: "bg-soft-blue" },
  { id: "sent", label: "Cotação Enviada", color: "bg-gold" },
  { id: "negotiation", label: "Negociação", color: "bg-warning" },
  { id: "confirmed", label: "Confirmada", color: "bg-success" },
  { id: "issued", label: "Bilhete Emitido", color: "bg-primary" },
  { id: "completed", label: "Concluída", color: "bg-muted-foreground" },
  { id: "post_sale", label: "Pós-Venda", color: "bg-soft-blue-light" },
];

type Quote = Tables<"quotes"> & { client_name?: string };

export default function Quotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

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
      const payload = {
        client_id: form.client_id || null,
        destination: form.destination || null,
        departure_city: form.departure_city || null,
        departure_airport: form.departure_airport || null,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        total_value: form.total_value ? Number(form.total_value) : 0,
        stage: form.stage || "new",
        airline_options: form.airline_options || null,
        hotel_options: form.hotel_options || null,
        notes: form.notes || null,
      };
      if (editingQuote) {
        const { error } = await supabase.from("quotes").update(payload).eq("id", editingQuote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quotes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingQuote ? "Cotação atualizada" : "Cotação criada" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

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

  const openCreate = () => {
    setEditingQuote(null);
    setForm({ stage: "new", total_value: "" });
    setDialogOpen(true);
  };

  const openEdit = (q: Quote) => {
    setEditingQuote(q);
    setForm({
      client_id: q.client_id ?? "", destination: q.destination ?? "", departure_city: q.departure_city ?? "",
      departure_airport: q.departure_airport ?? "", travel_date_start: q.travel_date_start ?? "",
      travel_date_end: q.travel_date_end ?? "", total_value: q.total_value ?? "",
      stage: q.stage, airline_options: q.airline_options ?? "", hotel_options: q.hotel_options ?? "",
      notes: q.notes ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingQuote(null); setForm({}); };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Pipeline de Cotações</h1>
          <p className="text-muted-foreground font-body mt-1">{quotes.length} cotações</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="font-body">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Nova Cotação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingQuote ? "Editar Cotação" : "Nova Cotação"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="font-body">Cliente</Label>
                  <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
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
                <div className="col-span-2 space-y-2">
                  <Label className="font-body">Estágio</Label>
                  <Select value={form.stage ?? "new"} onValueChange={(v) => setForm({ ...form, stage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="font-body">Opções de aéreas</Label>
                  <Textarea value={form.airline_options ?? ""} onChange={(e) => setForm({ ...form, airline_options: e.target.value })} rows={2} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="font-body">Opções de hotel</Label>
                  <Textarea value={form.hotel_options ?? ""} onChange={(e) => setForm({ ...form, hotel_options: e.target.value })} rows={2} />
                </div>
                <div className="col-span-2 space-y-2">
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

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageQuotes = quotes.filter((q) => q.stage === stage.id);
            return (
              <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-xs font-medium text-foreground font-body">{stage.label}</span>
                  <span className="text-xs text-muted-foreground font-body ml-auto">{stageQuotes.length}</span>
                </div>
                <div className="space-y-3">
                  {stageQuotes.map((quote) => (
                    <div key={quote.id} className="glass-card rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" onClick={() => openEdit(quote)}>
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium font-body text-foreground">{quote.destination || "Sem destino"}</p>
                        <span className="text-xs font-semibold text-foreground font-body">{formatCurrency(quote.total_value)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-body mb-3">{quote.client_name}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-body">
                        <span>{quote.travel_date_start ?? ""} {quote.travel_date_end ? `– ${quote.travel_date_end}` : ""}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-[10px]" onClick={(e) => { e.stopPropagation(); if (confirm("Remover cotação?")) deleteMutation.mutate(quote.id); }}>✕</Button>
                      </div>
                    </div>
                  ))}
                  {stageQuotes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
                      <p className="text-xs text-muted-foreground font-body">Sem cotações</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
