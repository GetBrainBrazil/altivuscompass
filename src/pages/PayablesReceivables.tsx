import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, TrendingUp, AlertTriangle, ArrowDown, ArrowUp, Wallet,
  Search, MoreHorizontal, Pencil, Trash2, CheckCircle2, Copy,
  SlidersHorizontal, ChevronDown, ChevronUp, Inbox, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

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

export default function PayablesReceivables() {
  const navigate = useNavigate();
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
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showChart, setShowChart] = useState(true);

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
        .from("bank_accounts").select("id, bank_name").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ----- maps -----
  const clientsMap = useMemo(
    () => Object.fromEntries(clients.map((c: any) => [c.id, c.full_name])), [clients]);
  const suppliersMap = useMemo(
    () => Object.fromEntries(suppliers.map((s: any) => [s.id, s.trade_name || s.name])), [suppliers]);

  const partyOptions = useMemo(
    () => [
      ...clients.map((c: any) => ({ id: c.id, name: c.full_name })),
      ...suppliers.map((s: any) => ({ id: s.id, name: s.trade_name || s.name })),
    ],
    [clients, suppliers],
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

  // ----- summary cards (current + previous period for trends) -----
  const todayStr = new Date().toISOString().slice(0, 10);

  const periodTotals = useMemo(() => {
    // Compute over ALL transactions (not filtered by tab) for the selected period
    const range = getPresetRange(datePreset);
    const inRange = (d?: string | null) => {
      if (!d) return false;
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return true;
    };

    // Previous period of same length
    let prevFrom: string | undefined, prevTo: string | undefined;
    if (range.from && range.to) {
      const a = new Date(range.from + "T00:00:00").getTime();
      const b = new Date(range.to + "T00:00:00").getTime();
      const span = b - a;
      const pa = new Date(a - span - 86400000);
      const pb = new Date(a - 86400000);
      prevFrom = pa.toISOString().slice(0, 10);
      prevTo = pb.toISOString().slice(0, 10);
    }

    const acc = (from?: string, to?: string) => {
      let payable = 0, receivable = 0, pending = 0, paid = 0, overdue = 0;
      for (const t of transactions) {
        const d = t.due_date as string | null;
        if (!d) continue;
        if (from && d < from) continue;
        if (to && d > to) continue;
        const total = computeTotal(t);
        const status: TxStatus = (t.status as TxStatus) || "pending";
        if (status === "cancelled") continue;
        if (t.type === "payable") payable += total; else receivable += total;
        if (status === "paid") paid += total;
        else if (d < todayStr) overdue += total;
        else pending += total;
      }
      return { payable, receivable, pending, paid, overdue, net: receivable - payable };
    };

    const current = acc(range.from, range.to);
    const previous = acc(prevFrom, prevTo);

    const pct = (curr: number, prev: number): number | null => {
      if (!prev) return null;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return {
      current,
      previous,
      trends: {
        pending: pct(current.pending, previous.pending),
        paid: pct(current.paid, previous.paid),
        overdue: pct(current.overdue, previous.overdue),
        net: pct(current.net, previous.net),
      },
    };
  }, [transactions, datePreset, todayStr]);

  // ----- monthly chart (last 6 months) -----
  const chartData = useMemo(() => {
    const today = new Date();
    const months: { key: string; label: string; entradas: number; saidas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      months.push({ key, label, entradas: 0, saidas: 0 });
    }
    const idxByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));
    for (const t of transactions) {
      if (!t.due_date) continue;
      const status: TxStatus = (t.status as TxStatus) || "pending";
      if (status === "cancelled") continue;
      const k = t.due_date.slice(0, 7);
      const idx = idxByKey[k];
      if (idx === undefined) continue;
      const total = computeTotal(t);
      if (t.type === "receivable") months[idx].entradas += total;
      else months[idx].saidas += total;
    }
    return months;
  }, [transactions]);

  // ----- row mutations -----
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

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const orig = transactions.find((t: any) => t.id === id);
      if (!orig) throw new Error("Movimentação não encontrada");
      const { id: _id, created_at, updated_at, ...rest } = orig;
      const copy = {
        ...rest,
        status: "pending",
        payment_date: null,
        description: `${orig.description ?? ""} (cópia)`.trim(),
      };
      const { error } = await (supabase.from("financial_transactions") as any).insert([copy]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Movimentação duplicada" });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
    },
    onError: (e: any) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
  });

  const openNew = (type: TxType) =>
    navigate(`/finance/payables-receivables/new?type=${type}`);
  const openEdit = (id: string) =>
    navigate(`/finance/payables-receivables/${id}/edit`);

  const activeAdvancedFilters = [partyFilter, categoryFilter, bankFilter, methodFilter, recurrenceFilter]
    .filter((v) => v !== "all").length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total a Receber"
          value={brl(periodTotals.current.receivable)}
          icon={<ArrowUp className="h-5 w-5 text-success" />}
          gradientFrom="from-success/20"
          gradientTo="to-success/5"
          valueClass="text-success"
          trend={periodTotals.trends.paid /* approx receita trend */}
        />
        <SummaryCard
          title="Total a Pagar"
          value={brl(periodTotals.current.payable)}
          icon={<ArrowDown className="h-5 w-5 text-destructive" />}
          gradientFrom="from-destructive/20"
          gradientTo="to-destructive/5"
          valueClass="text-destructive"
          trend={periodTotals.trends.pending}
        />
        <SummaryCard
          title="Total em Atraso"
          value={brl(periodTotals.current.overdue)}
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          gradientFrom="from-destructive/15"
          gradientTo="to-transparent"
          valueClass="text-destructive"
          trend={periodTotals.trends.overdue}
          invertTrend
        />
        <SummaryCard
          title="Saldo Líquido"
          value={brl(periodTotals.current.net)}
          icon={<Wallet className={cn("h-5 w-5", periodTotals.current.net >= 0 ? "text-success" : "text-destructive")} />}
          gradientFrom={periodTotals.current.net >= 0 ? "from-success/20" : "from-destructive/20"}
          gradientTo={periodTotals.current.net >= 0 ? "to-success/5" : "to-destructive/5"}
          valueClass={periodTotals.current.net >= 0 ? "text-success" : "text-destructive"}
          trend={periodTotals.trends.net}
        />
      </div>

      {/* Monthly chart */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Visão mensal — últimos 6 meses</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowChart((v) => !v)} className="h-7 gap-1 text-xs">
            {showChart ? <><ChevronUp className="h-3.5 w-3.5" /> Esconder</> : <><ChevronDown className="h-3.5 w-3.5" /> Mostrar</>}
          </Button>
        </div>
        {showChart && (
          <div className="p-3" style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} width={40} />
                <Tooltip
                  formatter={(v: any) => brl(Number(v))}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                <Bar dataKey="entradas" fill="hsl(var(--success))" name="Entradas" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="saidas" fill="hsl(var(--destructive))" name="Saídas" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TxType)}>
        <TabsList>
          <TabsTrigger value="payable">A Pagar</TabsTrigger>
          <TabsTrigger value="receivable">A Receber</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search / period / status / more filters */}
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
        <PillSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "Todos" },
          { value: "pending", label: "Pendente" },
          { value: "paid", label: "Pago" },
          { value: "overdue", label: "Atrasado" },
          { value: "cancelled", label: "Cancelado" },
        ]} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMoreFilters((v) => !v)}
          className="gap-2 h-9"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Mais Filtros
          {activeAdvancedFilters > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activeAdvancedFilters}</Badge>
          )}
          {showMoreFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
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

      {/* Advanced (collapsible) filters */}
      {showMoreFilters && (
        <div className="flex flex-wrap gap-2 animate-fade-in">
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
      )}

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
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="p-4 rounded-full bg-muted/50">
                        <Inbox className="h-10 w-10 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm text-muted-foreground">Nenhuma movimentação neste período</p>
                      <div className="flex flex-wrap gap-2 justify-center mt-1">
                        <Button size="sm" variant="outline" onClick={() => openNew("payable")} className="gap-2">
                          <ArrowDown className="h-4 w-4" /> Registrar conta a pagar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openNew("receivable")} className="gap-2">
                          <ArrowUp className="h-4 w-4" /> Registrar conta a receber
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
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
                  <tr
                    key={t.id}
                    onClick={() => openEdit(t.id)}
                    className="border-t border-border hover:bg-muted/20 cursor-pointer"
                  >
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
                      "px-4 py-3 text-right font-medium tabular-nums",
                      isPayable ? "text-destructive" : "text-success",
                    )}>
                      {isPayable ? "− " : "+ "}{brl(total)}
                    </td>
                    <td className="px-4 py-3">{fmtDate(t.due_date)}</td>
                    <td className="px-4 py-3">{fmtDate(t.payment_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("border", sb.cls)}>{sb.label}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {status !== "paid" && (
                            <DropdownMenuItem onClick={() => markPaidMutation.mutate(t.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEdit(t.id)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(t.id)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(t.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
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
    </div>
  );
}

// ----- subcomponents -----
function SummaryCard({
  title, value, icon, gradientFrom, gradientTo, valueClass, trend, invertTrend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  valueClass?: string;
  trend?: number | null;
  invertTrend?: boolean;
}) {
  const hasTrend = trend !== null && trend !== undefined && isFinite(trend);
  const positive = hasTrend ? (trend! >= 0) : false;
  // For things like overdue, "up" is bad
  const goodDirection = invertTrend ? !positive : positive;

  return (
    <div className="relative rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in overflow-hidden">
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className={cn("p-2 sm:p-2.5 rounded-lg bg-gradient-to-br", gradientFrom, gradientTo)}>
          {icon}
        </div>
      </div>
      <p className={cn("text-lg sm:text-2xl font-semibold font-display", valueClass ?? "text-foreground")}>{value}</p>
      <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1">{title}</p>
      {hasTrend && (
        <p className={cn(
          "text-[11px] font-body mt-1.5 flex items-center gap-1",
          goodDirection ? "text-success" : "text-destructive",
        )}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {positive ? "+" : ""}{trend!.toFixed(0)}% vs mês anterior
        </p>
      )}
      {!hasTrend && (
        <p className="text-[11px] font-body mt-1.5 text-muted-foreground/70">Sem dado anterior</p>
      )}
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
        "h-9 w-auto rounded-md border px-3 text-xs gap-1",
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
