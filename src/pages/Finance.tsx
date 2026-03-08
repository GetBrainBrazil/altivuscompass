import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type Transaction = {
  id: string; description: string; type: string; amount: number; date: string;
  status: string | null; category?: string | null; due_date?: string | null;
  party_name?: string | null; created_at: string;
};

const typeLabels: Record<string, string> = {
  receivable: "A Receber", payable: "A Pagar", sale: "Venda", expense: "Despesa", commission: "Comissão",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-gold/10 text-gold" },
  paid: { label: "Pago", color: "bg-success/10 text-success" },
  received: { label: "Recebido", color: "bg-success/10 text-success" },
  overdue: { label: "Vencido", color: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
};

export default function Finance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState("all");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["financial-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_transactions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description: form.description, type: form.type || "receivable",
        amount: Number(form.amount), date: form.date || new Date().toISOString().split("T")[0],
        status: form.status || "pending", category: form.category || form.type || "receivable",
        due_date: form.due_date || null, party_name: form.party_name || null,
      };
      if (editing) {
        const { error } = await supabase.from("financial_transactions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Transação atualizada" : "Transação criada" });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Transação removida" });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = (type: string = "receivable") => {
    setEditing(null);
    setForm({ type, category: type, status: "pending", date: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      description: t.description, type: t.type, amount: t.amount, date: t.date,
      status: t.status ?? "pending", category: t.category ?? t.type,
      due_date: t.due_date ?? "", party_name: t.party_name ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({}); };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const receivables = transactions.filter(t => t.category === "receivable" || t.type === "sale" || t.type === "commission");
  const payables = transactions.filter(t => t.category === "payable" || t.type === "expense");
  const pendingReceivables = receivables.filter(t => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const pendingPayables = payables.filter(t => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const totalReceived = receivables.filter(t => t.status === "received" || t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const totalPaid = payables.filter(t => t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);

  const filtered = filter === "all" ? transactions : filter === "receivable" ? receivables : payables;

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Contas a pagar e receber.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreate("payable")} className="font-body flex-1 sm:flex-none text-xs sm:text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">Conta a </span>Pagar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreate("receivable")} className="font-body flex-1 sm:flex-none text-xs sm:text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                <span className="hidden sm:inline">Conta a </span>Receber
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editing ? "Editar Transação" : "Nova Transação"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-body">Descrição *</Label>
                    <Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Tipo</Label>
                    <Select value={form.type ?? "receivable"} onValueChange={(v) => setForm({ ...form, type: v, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receivable">A Receber</SelectItem>
                        <SelectItem value="payable">A Pagar</SelectItem>
                        <SelectItem value="sale">Venda</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="commission">Comissão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Valor (R$) *</Label>
                    <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Data</Label>
                    <Input type="date" value={form.date ?? ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Vencimento</Label>
                    <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Status</Label>
                    <Select value={form.status ?? "pending"} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="received">Recebido</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Parte / Fornecedor</Label>
                    <Input value={form.party_name ?? ""} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="A Receber (Pendente)" value={formatCurrency(pendingReceivables)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
        } />
        <MetricCard title="A Pagar (Pendente)" value={formatCurrency(pendingPayables)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M2 7l4 4 4-4 4 6 4-2 4 4" /><path d="M2 3h20" /></svg>
        } />
        <MetricCard title="Total Recebido" value={formatCurrency(totalReceived)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h6M9 15h6" /></svg>
        } />
        <MetricCard title="Total Pago" value={formatCurrency(totalPaid)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z" /></svg>
        } />
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {[{ id: "all", label: "Todas" }, { id: "receivable", label: "A Receber" }, { id: "payable", label: "A Pagar" }].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium font-body transition-colors ${filter === f.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Desktop list */}
      <div className="glass-card rounded-xl hidden sm:block">
        <div className="p-4 sm:p-5 border-b border-border/50">
          <h2 className="font-display text-lg font-semibold">Transações</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma transação encontrada.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((t) => {
              const st = statusLabels[t.status ?? "pending"] ?? statusLabels.pending;
              const isPayable = t.category === "payable" || t.type === "expense";
              return (
                <div key={t.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(t)}>
                  <div className="flex-1">
                    <p className="text-sm font-medium font-body text-foreground">{t.description}</p>
                    <p className="text-xs text-muted-foreground font-body">
                      {typeLabels[t.type] ?? t.type}{t.party_name ? ` · ${t.party_name}` : ""}{t.due_date ? ` · Venc: ${t.due_date}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${st.color}`}>{st.label}</span>
                  <span className={`text-sm font-medium font-body w-28 text-right ${isPayable ? "text-destructive" : "text-foreground"}`}>
                    {isPayable ? "- " : ""}{formatCurrency(Number(t.amount))}
                  </span>
                  <span className="text-xs text-muted-foreground font-body w-24 text-right">{t.date}</span>
                  <Button variant="ghost" size="sm" className="text-destructive h-6 px-2" onClick={(e) => { e.stopPropagation(); if (confirm("Remover transação?")) deleteMutation.mutate(t.id); }}>✕</Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma transação encontrada.</div>
        ) : (
          filtered.map((t) => {
            const st = statusLabels[t.status ?? "pending"] ?? statusLabels.pending;
            const isPayable = t.category === "payable" || t.type === "expense";
            return (
              <div key={t.id} className="glass-card rounded-xl p-4 space-y-2" onClick={() => openEdit(t)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-body text-foreground truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground font-body">{typeLabels[t.type] ?? t.type}{t.party_name ? ` · ${t.party_name}` : ""}</p>
                  </div>
                  <span className={`text-sm font-semibold font-body ml-2 ${isPayable ? "text-destructive" : "text-foreground"}`}>
                    {isPayable ? "-" : ""}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${st.color}`}>{st.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-body">{t.date}</span>
                    <Button variant="ghost" size="sm" className="text-destructive h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); if (confirm("Remover?")) deleteMutation.mutate(t.id); }}>✕</Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
