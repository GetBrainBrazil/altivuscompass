import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, TrendingUp, AlertTriangle, ArrowDown, ArrowUp,
  Search, MoreHorizontal, Plus, Pencil, Trash2, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ----- types & constants -----
type TxType = "payable" | "receivable";
type TxStatus = "pending" | "paid" | "overdue" | "cancelled";

const tourismCategories = [
  "Passagens Aéreas", "Hospedagem", "Transporte/Transfer", "Seguro Viagem",
  "Experiências/Passeios", "Cruzeiro", "Comissão", "Custo Operacional", "Outros",
];

const recurrenceOptions = [
  { value: "none", label: "Sem recorrência" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

const paymentMethods = [
  "Pix", "Boleto", "Cartão de Crédito", "Cartão de Débito",
  "Transferência", "Dinheiro", "Outros",
];

const datePresets = [
  { value: "this_month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
  { value: "next_month", label: "Próximo Mês" },
  { value: "this_quarter", label: "Este Trimestre" },
  { value: "this_year", label: "Este Ano" },
  { value: "all", label: "Todos os Períodos" },
];

const statusBadge: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  pending: { label: "Pendente", cls: "bg-gold/15 text-gold border-gold/30" },
  overdue: { label: "Atrasado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function getPresetRange(preset: string): { from?: string; to?: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "this_month":
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "next_month":
      return { from: iso(new Date(y, m + 1, 1)), to: iso(new Date(y, m + 2, 0)) };
    case "this_quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { from: iso(new Date(y, qs, 1)), to: iso(new Date(y, qs + 3, 0)) };
    }
    case "this_year":
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    default:
      return {};
  }
}

// ----- empty form -----
const emptyForm = {
  type: "payable" as TxType,
  description: "",
  category: "",
  cost_center: "",
  project: "",
  client_id: "",
  supplier_id: "",
  competence_date: new Date().toISOString().slice(0, 10),
  due_date: new Date().toISOString().slice(0, 10),
  bank_account_id: "",
  payment_method: "",
  base_amount: "",
  discount_amount: "",
  interest_amount: "",
  fine_amount: "",
  admin_fee_amount: "",
  installment_total: "1",
  installment_interval_days: "30",
  recurrence_type: "none",
  observations: "",
};

export default function PayablesReceivables() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ----- UI state -----
  const [activeTab, setActiveTab] = useState<TxType>("payable");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState("this_month");
  const [hideFutureRecurrence, setHideFutureRecurrence] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [recurrenceFilter, setRecurrenceFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  // ----- data fetching -----
  const { data: transactions = [] } = useQuery({
    queryKey: ["finance-transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("financial_transactions") as any)
        .select("*").order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["finance-clients-only"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients").select("id, full_name").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers").select("id, name, trade_name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["finance-banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts").select("id, bank_name, agency, account_number").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ----- maps for fast lookup -----
  const clientsMap = useMemo(
    () => Object.fromEntries(clients.map((c: any) => [c.id, c.full_name])),
    [clients],
  );
  const suppliersMap = useMemo(
    () => Object.fromEntries(suppliers.map((s: any) => [s.id, s.trade_name || s.name])),
    [suppliers],
  );

  // ----- filtering -----
  const filtered = useMemo(() => {
    const range = getPresetRange(datePreset);
    return transactions.filter((t: any) => {
      if (t.type !== activeTab) return false;
      if (hideFutureRecurrence && t.is_future_recurrence) return false;
      if (statusFilter !== "all" && (t.status || "pending") !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (bankFilter !== "all" && t.bank_account_id !== bankFilter) return false;
      if (methodFilter !== "all" && t.payment_method !== methodFilter) return false;
      if (recurrenceFilter !== "all") {
        if (recurrenceFilter === "none" && t.recurrence_type && t.recurrence_type !== "none") return false;
        if (recurrenceFilter !== "none" && t.recurrence_type !== recurrenceFilter) return false;
      }
      if (partyFilter !== "all") {
        const pid = t.client_id || t.supplier_id;
        if (pid !== partyFilter) return false;
      }
      if (range.from && t.due_date && t.due_date < range.from) return false;
      if (range.to && t.due_date && t.due_date > range.to) return false;
      if (search) {
        const q = search.toLowerCase();
        const partyName = clientsMap[t.client_id] || suppliersMap[t.supplier_id] || t.party_name || "";
        const haystack = `${t.description ?? ""} ${partyName} ${t.category ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, activeTab, hideFutureRecurrence, statusFilter, partyFilter, categoryFilter,
      bankFilter, methodFilter, recurrenceFilter, datePreset, search, clientsMap, suppliersMap]);

  // ----- summary cards (from filtered set) -----
  const todayStr = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => {
    let pending = 0, paid = 0, overdue = 0;
    for (const t of filtered) {
      const total = computeTotal(t);
      const status: TxStatus = (t.status as TxStatus) || "pending";
      if (status === "paid") paid += total;
      else if (status === "cancelled") continue;
      else if (t.due_date && t.due_date < todayStr) overdue += total;
      else pending += total;
    }
    return { pending, paid, overdue };
  }, [filtered, todayStr]);

  // ----- mutations -----
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const installments = Math.max(1, parseInt(payload.installment_total || "1", 10));
      const intervalDays = Math.max(1, parseInt(payload.installment_interval_days || "30", 10));
      const baseAmount = parseFloat(payload.base_amount || "0");
      const discount = parseFloat(payload.discount_amount || "0");
      const interest = parseFloat(payload.interest_amount || "0");
      const fine = parseFloat(payload.fine_amount || "0");
      const adminFee = parseFloat(payload.admin_fee_amount || "0");
      const totalPerRow = baseAmount - discount + interest + fine + adminFee;

      const rowBase = {
        type: payload.type,
        description: payload.description,
        category: payload.category || null,
        cost_center: payload.cost_center || null,
        project: payload.project || null,
        client_id: payload.client_id || null,
        supplier_id: payload.supplier_id || null,
        competence_date: payload.competence_date || null,
        bank_account_id: payload.bank_account_id || null,
        payment_method: payload.payment_method || null,
        base_amount: baseAmount,
        discount_amount: discount,
        interest_amount: interest,
        fine_amount: fine,
        admin_fee_amount: adminFee,
        amount: totalPerRow,
        date: payload.competence_date || todayStr,
        observations: payload.observations || null,
        recurrence_type: payload.recurrence_type === "none" ? null : payload.recurrence_type,
        status: "pending",
        party_name:
          (payload.type === "payable" ? suppliersMap[payload.supplier_id] : clientsMap[payload.client_id]) ?? null,
      };

      if (editingId) {
        const { error } = await (supabase.from("financial_transactions") as any)
          .update({ ...rowBase, due_date: payload.due_date }).eq("id", editingId);
        if (error) throw error;
        return;
      }

      // Build N installment rows
      const groupId = installments > 1 ? crypto.randomUUID() : null;
      const rows: any[] = [];
      const baseDue = new Date(payload.due_date + "T00:00:00");
      for (let i = 0; i < installments; i++) {
        const d = new Date(baseDue);
        d.setDate(d.getDate() + i * intervalDays);
        rows.push({
          ...rowBase,
          due_date: d.toISOString().slice(0, 10),
          installment_number: installments > 1 ? i + 1 : null,
          installment_total: installments > 1 ? installments : null,
          installment_group_id: groupId,
          is_future_recurrence: i > 0,
        });
      }
      const { error } = await (supabase.from("financial_transactions") as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: editingId ? "Movimentação atualizada" : "Movimentação criada" });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("financial_transactions") as any)
        .update({ status: "paid", payment_date: todayStr }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marcado como pago" });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Movimentação removida" });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
    },
  });

  // ----- handlers -----
  const openNew = (type: TxType) => {
    setEditingId(null);
    setForm({ ...emptyForm, type });
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      type: t.type,
      description: t.description ?? "",
      category: t.category ?? "",
      cost_center: t.cost_center ?? "",
      project: t.project ?? "",
      client_id: t.client_id ?? "",
      supplier_id: t.supplier_id ?? "",
      competence_date: t.competence_date ?? t.date ?? todayStr,
      due_date: t.due_date ?? todayStr,
      bank_account_id: t.bank_account_id ?? "",
      payment_method: t.payment_method ?? "",
      base_amount: String(t.base_amount ?? t.amount ?? ""),
      discount_amount: String(t.discount_amount ?? ""),
      interest_amount: String(t.interest_amount ?? ""),
      fine_amount: String(t.fine_amount ?? ""),
      admin_fee_amount: String(t.admin_fee_amount ?? ""),
      installment_total: String(t.installment_total ?? "1"),
      installment_interval_days: "30",
      recurrence_type: t.recurrence_type ?? "none",
      observations: t.observations ?? "",
    });
    setDialogOpen(true);
  };

  const totalPreview = useMemo(() => {
    const b = parseFloat(form.base_amount || "0");
    const d = parseFloat(form.discount_amount || "0");
    const i = parseFloat(form.interest_amount || "0");
    const f = parseFloat(form.fine_amount || "0");
    const a = parseFloat(form.admin_fee_amount || "0");
    return b - d + i + f + a;
  }, [form]);

  const partyOptions = useMemo(() => {
    const all = [
      ...clients.map((c: any) => ({ id: c.id, name: c.full_name })),
      ...suppliers.map((s: any) => ({ id: s.id, name: s.trade_name || s.name })),
    ];
    return all;
  }, [clients, suppliers]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold">Contas a Pagar / Receber</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todas as movimentações financeiras da agência
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openNew("payable")} className="gap-2">
            <ArrowDown className="h-4 w-4" /> Conta a Pagar
          </Button>
          <Button onClick={() => openNew("receivable")} className="gap-2">
            <ArrowUp className="h-4 w-4" /> Conta a Receber
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Pendente"
          value={brl(summary.pending)}
          icon={<Clock className="h-5 w-5 text-foreground" />}
        />
        <div className="glass-card rounded-xl p-3 sm:p-5 animate-fade-in">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-2.5 rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-semibold font-display text-success">{brl(summary.paid)}</p>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">Total Pago/Recebido</p>
        </div>
        <div className="glass-card rounded-xl p-3 sm:p-5 animate-fade-in">
          <div className="flex items-start justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-2.5 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-semibold font-display text-destructive">{brl(summary.overdue)}</p>
          <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">Total em Atraso</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TxType)}>
        <TabsList>
          <TabsTrigger value="payable">A Pagar</TabsTrigger>
          <TabsTrigger value="receivable">A Receber</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search / period / toggle */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, vinculação ou categoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {datePresets.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border">
          <Switch
            id="hide-future"
            checked={hideFutureRecurrence}
            onCheckedChange={setHideFutureRecurrence}
          />
          <Label htmlFor="hide-future" className="text-sm cursor-pointer whitespace-nowrap">
            Ocultar parcelas futuras
          </Label>
        </div>
      </div>

      {/* Pill filters */}
      <div className="flex flex-wrap gap-2">
        <PillSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "Todos" },
          { value: "pending", label: "Pendente" },
          { value: "paid", label: "Pago" },
          { value: "overdue", label: "Atrasado" },
          { value: "cancelled", label: "Cancelado" },
        ]} />
        <PillSelect label="Vinculado a" value={partyFilter} onChange={setPartyFilter} options={[
          { value: "all", label: "Todos" },
          ...partyOptions.map((p) => ({ value: p.id, label: p.name })),
        ]} />
        <PillSelect label="Categoria" value={categoryFilter} onChange={setCategoryFilter} options={[
          { value: "all", label: "Todas" },
          ...tourismCategories.map((c) => ({ value: c, label: c })),
        ]} />
        <PillSelect label="Conta Bancária" value={bankFilter} onChange={setBankFilter} options={[
          { value: "all", label: "Todas" },
          ...bankAccounts.map((b: any) => ({ value: b.id, label: b.bank_name })),
        ]} />
        <PillSelect label="Meio de Pagamento" value={methodFilter} onChange={setMethodFilter} options={[
          { value: "all", label: "Todos" },
          ...paymentMethods.map((m) => ({ value: m, label: m })),
        ]} />
        <PillSelect label="Recorrência" value={recurrenceFilter} onChange={setRecurrenceFilter} options={[
          { value: "all", label: "Todas" },
          ...recurrenceOptions.map((r) => ({ value: r.value, label: r.label })),
        ]} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Vinculado a</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhuma movimentação encontrada para os filtros aplicados.
                </td></tr>
              )}
              {filtered.map((t: any) => {
                const partyName =
                  clientsMap[t.client_id] || suppliersMap[t.supplier_id] || t.party_name || "—";
                const total = computeTotal(t);
                const isPayable = t.type === "payable";
                let status: TxStatus = (t.status as TxStatus) || "pending";
                if (status === "pending" && t.due_date && t.due_date < todayStr) status = "overdue";
                const sb = statusBadge[status];

                return (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {(partyName || "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[180px]">{partyName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[260px]">{t.description}</div>
                      {t.installment_total > 1 && (
                        <span className="text-[10px] text-muted-foreground">
                          Parcela {t.installment_number}/{t.installment_total}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.category || "—"}</td>
                    <td className={cn(
                      "px-4 py-3 text-right font-medium",
                      isPayable ? "text-destructive" : "text-success",
                    )}>
                      {isPayable ? "− " : "+ "}{brl(total)}
                    </td>
                    <td className="px-4 py-3">{fmtDate(t.due_date)}</td>
                    <td className="px-4 py-3">{fmtDate(t.payment_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("border", sb.cls)}>{sb.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          {status !== "paid" && (
                            <DropdownMenuItem onClick={() => markPaidMutation.mutate(t.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(t.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar movimentação" : "Nova movimentação financeira"}
            </DialogTitle>
          </DialogHeader>

          {/* Type cards */}
          <div className="grid grid-cols-2 gap-3">
            {(["payable", "receivable"] as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={cn(
                  "p-4 rounded-lg border-2 text-left transition-all",
                  form.type === t
                    ? "border-success bg-success/5"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {t === "payable" ? <ArrowDown className="h-4 w-4 text-destructive" /> : <ArrowUp className="h-4 w-4 text-success" />}
                  <span className="font-semibold">{t === "payable" ? "Conta a Pagar" : "Conta a Receber"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t === "payable" ? "Despesa ou pagamento a fornecedores" : "Recebimento de cliente ou venda"}
                </p>
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição da Movimentação *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: Reserva de hotel — Cliente João"
            />
          </div>

          {/* Classification */}
          <FormSection title="Classificação Financeira">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {tourismCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Input value={form.cost_center} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Projeto / Cotação</Label>
                <Input
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  placeholder="Vincular a uma viagem"
                />
              </div>
            </div>
          </FormSection>

          {/* Linkage */}
          <FormSection title="Vinculação">
            <div className="grid sm:grid-cols-2 gap-3">
              {form.type === "receivable" ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Cliente</Label>
                  <div className="flex gap-2">
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                      <SelectContent>
                        {clients.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Nenhum cliente cadastrado.
                          </div>
                        )}
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button" variant="outline" size="icon"
                      onClick={() => window.open("/clients", "_blank")}
                      title="Cadastrar novo cliente"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Apenas Clientes da base aparecem (não inclui Leads ou Prospects).
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Fornecedor</Label>
                  <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um fornecedor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.trade_name || s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </FormSection>

          {/* Dates */}
          <FormSection title="Datas e Condições">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data de Competência *</Label>
                <Input type="date" value={form.competence_date}
                  onChange={(e) => setForm({ ...form, competence_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Conta Bancária</Label>
                <Select value={form.bank_account_id}
                  onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label>Meio de Pagamento</Label>
                <Select value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          {/* Amounts */}
          <FormSection title="Valores e Encargos">
            <div className="grid sm:grid-cols-3 gap-3">
              <MoneyField label="Valor Base (R$) *" value={form.base_amount}
                onChange={(v) => setForm({ ...form, base_amount: v })} />
              <MoneyField label="Desconto Previsto" value={form.discount_amount}
                onChange={(v) => setForm({ ...form, discount_amount: v })} />
              <MoneyField label="Juros Previstos" value={form.interest_amount}
                onChange={(v) => setForm({ ...form, interest_amount: v })} />
              <MoneyField label="Multa Prevista" value={form.fine_amount}
                onChange={(v) => setForm({ ...form, fine_amount: v })} />
              <MoneyField label="Taxas ADM" value={form.admin_fee_amount}
                onChange={(v) => setForm({ ...form, admin_fee_amount: v })} />
              <div className="space-y-2 flex flex-col justify-end">
                <Label>Total Calculado</Label>
                <div className="h-10 px-3 rounded-md border border-border bg-muted/30 flex items-center font-semibold">
                  {brl(totalPreview)}
                </div>
              </div>
            </div>
          </FormSection>

          {/* Installments + recurrence */}
          {!editingId && (
            <FormSection title="Parcelamento e Recorrência">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade de Parcelas</Label>
                  <Input type="number" min={1} value={form.installment_total}
                    onChange={(e) => setForm({ ...form, installment_total: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo (dias)</Label>
                  <Input type="number" min={1} value={form.installment_interval_days}
                    onChange={(e) => setForm({ ...form, installment_interval_days: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Recorrência</Label>
                  <Select value={form.recurrence_type}
                    onValueChange={(v) => setForm({ ...form, recurrence_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              rows={2} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.description || !form.category || !form.base_amount || !form.due_date || !form.competence_date) {
                  toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
                  return;
                }
                saveMutation.mutate(form);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando…" : "Salvar movimentação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----- Helpers / sub-components -----
function computeTotal(t: any): number {
  if (t.base_amount != null) {
    const b = Number(t.base_amount) || 0;
    const d = Number(t.discount_amount) || 0;
    const i = Number(t.interest_amount) || 0;
    const f = Number(t.fine_amount) || 0;
    const a = Number(t.admin_fee_amount) || 0;
    return b - d + i + f + a;
  }
  return Number(t.amount) || 0;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function MoneyField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number" step="0.01" min="0" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
      />
    </div>
  );
}

function PillSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value);
  const isActive = value !== "all";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(
        "h-8 w-auto rounded-full border px-3 text-xs gap-1",
        isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-background",
      )}>
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{current?.label ?? "Todos"}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
