import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const saleStages = [
  { id: "issued", label: "Bilhete Emitido", color: "bg-soft-blue" },
  { id: "in_progress", label: "Em Andamento", color: "bg-gold" },
  { id: "completed", label: "Concluída", color: "bg-success" },
  { id: "post_sale", label: "Pós-Venda", color: "bg-primary" },
];

type Sale = {
  id: string;
  quote_id: string | null;
  client_id: string | null;
  stage: string;
  destination: string | null;
  total_value: number | null;
  travel_date_start: string | null;
  travel_date_end: string | null;
  ticket_number: string | null;
  ticket_issued_at: string | null;
  notes: string | null;
  created_at: string;
  client_name?: string;
};

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, clients(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ ...s, client_name: s.clients?.full_name ?? "Sem cliente" }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        stage: form.stage || "issued",
        destination: form.destination || null,
        total_value: form.total_value ? Number(form.total_value) : 0,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        ticket_number: form.ticket_number || null,
        notes: form.notes || null,
      };
      if (editingSale) {
        const { error } = await supabase.from("sales").update(payload).eq("id", editingSale.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Venda atualizada" });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openEdit = (s: Sale) => {
    setEditingSale(s);
    setForm({
      stage: s.stage, destination: s.destination ?? "", total_value: s.total_value ?? "",
      travel_date_start: s.travel_date_start ?? "", travel_date_end: s.travel_date_end ?? "",
      ticket_number: s.ticket_number ?? "", notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingSale(null); setForm({}); };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="max-w-full mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Pipeline de Vendas</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">{sales.length} vendas</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted sm:hidden">
          <button onClick={() => setViewMode("list")} className={`px-2 py-1 rounded text-xs font-body ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Lista</button>
          <button onClick={() => setViewMode("kanban")} className={`px-2 py-1 rounded text-xs font-body ${viewMode === "kanban" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Kanban</button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Venda</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-body">Estágio</Label>
                <Select value={form.stage ?? "issued"} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{saleStages.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Destino</Label>
                <Input value={form.destination ?? ""} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Nº do Bilhete</Label>
                <Input value={form.ticket_number ?? ""} onChange={(e) => setForm({ ...form, ticket_number: e.target.value })} />
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

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
      ) : (
        <>
          {/* Kanban */}
          <div className={`${viewMode === "list" ? "hidden sm:flex" : "flex"} gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0`}>
            {saleStages.map((stage) => {
              const stageSales = sales.filter((s: Sale) => s.stage === stage.id);
              return (
                <div key={stage.id} className="min-w-[240px] sm:min-w-[280px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <span className="text-xs font-medium text-foreground font-body">{stage.label}</span>
                    <span className="text-xs text-muted-foreground font-body ml-auto">{stageSales.length}</span>
                  </div>
                  <div className="space-y-3">
                    {stageSales.map((sale: Sale) => (
                      <div key={sale.id} className="glass-card rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" onClick={() => openEdit(sale)}>
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm font-medium font-body text-foreground">{sale.destination || "Sem destino"}</p>
                          <span className="text-xs font-semibold text-foreground font-body ml-2">{formatCurrency(sale.total_value)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-body mb-2">{sale.client_name}</p>
                        {sale.ticket_number && (
                          <p className="text-[10px] text-muted-foreground font-body mb-2">Bilhete: {sale.ticket_number}</p>
                        )}
                        <div className="text-[10px] text-muted-foreground font-body">
                          <span>{sale.travel_date_start ? sale.travel_date_start.split("-").reverse().join("/") : ""} {sale.travel_date_end ? `– ${sale.travel_date_end.split("-").reverse().join("/")}` : ""}</span>
                        </div>
                      </div>
                    ))}
                    {stageSales.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/50 p-4 sm:p-6 text-center">
                        <p className="text-xs text-muted-foreground font-body">Sem vendas</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* List view - mobile */}
          <div className={`${viewMode === "kanban" ? "hidden" : "block"} sm:hidden space-y-3`}>
            {sales.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-body">Nenhuma venda.</div>
            ) : (
              sales.map((sale: Sale) => {
                const stage = saleStages.find(s => s.id === sale.stage) ?? saleStages[0];
                return (
                  <div key={sale.id} className="glass-card rounded-xl p-4 space-y-2" onClick={() => openEdit(sale)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium font-body text-foreground">{sale.destination || "Sem destino"}</p>
                        <p className="text-xs text-muted-foreground font-body">{sale.client_name}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground font-body">{formatCurrency(sale.total_value)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      <span className="text-xs text-muted-foreground font-body">{stage.label}</span>
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
