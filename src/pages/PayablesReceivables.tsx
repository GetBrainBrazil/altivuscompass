import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, TrendingUp, AlertTriangle, CalendarDays, CheckCircle2, ArrowDown, ArrowUp,
  Search, MoreHorizontal, Pencil, Trash2, Copy, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp as ArrUp, ArrowDown as ArrDown, User, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ----- types & constants -----
type TxType = "payable" | "receivable";
type TxStatus = "pending" | "paid" | "overdue" | "cancelled";
type SortKey = "due_date" | "payment_date" | "description" | "party" | "category" | "total" | "status";
type SortDir = "asc" | "desc";

const tourismCategories = [
  "Passagens Aéreas", "Hospedagem", "Transporte/Transfer", "Seguro Viagem",
  "Experiências/Passeios", "Cruzeiro", "Comissão", "Custo Operacional", "Outros",
];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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

type Mode = "all" | "payable" | "receivable";

export default function PayablesReceivables({ mode = "all" }: { mode?: Mode } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // ----- UI state -----
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [showPartialBalances, setShowPartialBalances] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [gotoPage, setGotoPage] = useState("");

  // ----- date range from month/year -----
  const range = useMemo(() => {
    const from = new Date(year, month, 1).toISOString().slice(0, 10);
    const to = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  }, [year, month]);

  // ----- data -----
  const { data: transactions = [], isLoading } = useQuery({
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

  const clientsMap = useMemo(
    () => Object.fromEntries(clients.map((c: any) => [c.id, c.full_name])), [clients]);
  const suppliersMap = useMemo(
    () => Object.fromEntries(suppliers.map((s: any) => [s.id, s.trade_name || s.name])), [suppliers]);

  // ----- compute effective status per tx -----
  const enriched = useMemo(() => {
    return transactions
      .filter((t: any) => mode === "all" ? true : t.type === mode)
      .map((t: any) => {
        let status: TxStatus = (t.status as TxStatus) || "pending";
        if (status === "pending" && t.due_date && t.due_date < todayStr) status = "overdue";
        const partyName =
          clientsMap[t.client_id] || suppliersMap[t.supplier_id] || t.party_name || "—";
        const total = computeTotal(t);
        return { ...t, _status: status, _party: partyName, _total: total };
      });
  }, [transactions, clientsMap, suppliersMap, todayStr, mode]);

  // ----- summary cards (period) -----
  const summary = useMemo(() => {
    let vencidos = 0, vencemHoje = 0, aVencer = 0, pagos = 0, totalPeriodo = 0;
    for (const t of enriched) {
      const d = t.due_date as string | null;
      if (!d) continue;
      if (d < range.from || d > range.to) continue;
      if (t._status === "cancelled") continue;
      totalPeriodo += t._total;
      if (t._status === "paid") {
        pagos += t._total;
      } else if (d < todayStr) {
        vencidos += t._total;
      } else if (d === todayStr) {
        vencemHoje += t._total;
      } else {
        aVencer += t._total;
      }
    }
    return { vencidos, vencemHoje, aVencer, pagos, totalPeriodo };
  }, [enriched, range, todayStr]);

  // ----- filter + sort -----
  const filtered = useMemo(() => {
    const rows = enriched.filter((t: any) => {
      if (!t.due_date) return false;
      if (t.due_date < range.from || t.due_date > range.to) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${t.description ?? ""} ${t._party} ${t.category ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "due_date": av = a.due_date || ""; bv = b.due_date || ""; break;
        case "payment_date": av = a.payment_date || ""; bv = b.payment_date || ""; break;
        case "description": av = (a.description || "").toLowerCase(); bv = (b.description || "").toLowerCase(); break;
        case "party": av = a._party.toLowerCase(); bv = b._party.toLowerCase(); break;
        case "category": av = (a.category || "").toLowerCase(); bv = (b.category || "").toLowerCase(); break;
        case "total": av = a._total; bv = b._total; break;
        case "status": av = a._status; bv = b._status; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [enriched, range, categoryFilter, search, sortKey, sortDir]);

  // ----- pagination -----
  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRecords);
  const pageRows = filtered.slice(startIdx, endIdx);

  // ----- mutations -----
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const navMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setPage(1);
  };

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r: any) => {
        if (checked) next.add(r.id); else next.delete(r.id);
      });
      return next;
    });
  };

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r: any) => selected.has(r.id));

  const isPayableMode = mode === "payable";
  const isReceivableMode = mode === "receivable";
  const pageTitle =
    isPayableMode ? "Contas a Pagar" :
    isReceivableMode ? "Contas a Receber" :
    "Contas a Pagar / Receber";
  const pageSubtitle =
    isPayableMode ? "Gerencie suas despesas e pagamentos a fornecedores" :
    isReceivableMode ? "Gerencie seus recebíveis e cobranças de clientes" :
    "Gerencie todas as movimentações financeiras da agência";
  const partyColLabel =
    isPayableMode ? "Fornecedor" :
    isReceivableMode ? "Cliente" :
    "Fornecedor/Cliente";
  const paidCardLabel = isReceivableMode ? "Recebidos" : "Pagos";
  const paymentColLabel = isReceivableMode ? "Recebimento" : "Pagamento";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(mode === "all" || isPayableMode) && (
            <Button
              onClick={() => openNew("payable")}
              className="gap-2"
              variant={mode === "all" ? "outline" : "default"}
            >
              <ArrowDown className="h-4 w-4" /> {mode === "all" ? "Conta a Pagar" : "Nova Conta a Pagar"}
            </Button>
          )}
          {(mode === "all" || isReceivableMode) && (
            <Button onClick={() => openNew("receivable")} className="gap-2">
              <ArrowUp className="h-4 w-4" /> {mode === "all" ? "Conta a Receber" : "Nova Conta a Receber"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards (5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          label="Vencidos"
          value={brl(summary.vencidos)}
          icon={<AlertTriangle className="h-4 w-4" />}
          valueClass="text-destructive"
          iconBg="bg-destructive/10 text-destructive"
        />
        <StatCard
          label="Vencem hoje"
          value={brl(summary.vencemHoje)}
          icon={<Clock className="h-4 w-4" />}
          valueClass="text-orange-500"
          iconBg="bg-orange-500/10 text-orange-500"
        />
        <StatCard
          label="A vencer"
          value={brl(summary.aVencer)}
          icon={<CalendarDays className="h-4 w-4" />}
          valueClass="text-foreground"
          iconBg="bg-muted text-foreground"
        />
        <StatCard
          label={paidCardLabel}
          value={brl(summary.pagos)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          valueClass="text-success"
          iconBg="bg-success/10 text-success"
        />
        <StatCard
          label="Total do período"
          value={brl(summary.totalPeriodo)}
          icon={<TrendingUp className="h-4 w-4" />}
          valueClass="text-emerald-700"
          iconBg="bg-emerald-700/10 text-emerald-700"
        />
      </div>

      {/* Filters bar */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, vinculação ou categoria…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        {/* Month/year navigator */}
        <div className="flex items-center gap-1 border border-border rounded-md bg-background">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-2 min-w-[140px] text-center text-sm font-medium capitalize">
            {monthNames[month]} {year}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navMonth(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background">
          <Switch
            id="partial-balances"
            checked={showPartialBalances}
            onCheckedChange={setShowPartialBalances}
          />
          <Label htmlFor="partial-balances" className="text-sm cursor-pointer whitespace-nowrap">
            Exibir Saldos Parciais
          </Label>
        </div>

        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {tourismCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-3 w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(v) => toggleAllOnPage(!!v)}
                    aria-label="Selecionar todos"
                  />
                </th>
                <SortableTh label="Vencimento" k="due_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Pagamento" k="payment_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Descrição" k="description" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Fornecedor/Cliente" k="party" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} icon={<User className="h-3.5 w-3.5" />} />
                <SortableTh label="Categoria" k="category" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Total" k="total" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-t border-border/40">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <Skeleton className="h-4 w-full max-w-[140px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="p-5 rounded-full bg-muted/50">
                        <Inbox className="h-12 w-12 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Nenhuma movimentação encontrada para este período
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center mt-1">
                        <Button size="sm" variant="outline" onClick={() => openNew("payable")} className="gap-2">
                          <ArrowDown className="h-4 w-4" /> Registrar conta a pagar
                        </Button>
                        <Button size="sm" onClick={() => openNew("receivable")} className="gap-2">
                          <ArrowUp className="h-4 w-4" /> Registrar conta a receber
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((t: any) => {
                  const isPayable = t.type === "payable";
                  const status: TxStatus = t._status;
                  const sb = statusPill(status);
                  return (
                    <tr
                      key={t.id}
                      onClick={() => openEdit(t.id)}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={(v) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(t.id); else next.delete(t.id);
                              return next;
                            });
                          }}
                          aria-label="Selecionar linha"
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDate(t.due_date)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(t.payment_date)}</td>
                      <td className="px-3 py-3">
                        <div className="truncate max-w-[260px]">{t.description || "—"}</div>
                        {t.installment_total > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            Parcela {t.installment_number}/{t.installment_total}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[180px]">{t._party}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{t.category || "—"}</td>
                      <td className={cn(
                        "px-3 py-3 text-right font-medium tabular-nums whitespace-nowrap",
                        isPayable ? "text-destructive" : "text-success",
                      )}>
                        {isPayable ? "− " : "+ "}{brl(t._total)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn("border", sb.cls)}>{sb.label}</Badge>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(t.id)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            {status !== "paid" && (
                              <DropdownMenuItem onClick={() => markPaidMutation.mutate(t.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como pago
                              </DropdownMenuItem>
                            )}
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isLoading && totalRecords > 0 && (
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Registros por página:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground ml-2">
                Mostrando {totalRecords === 0 ? 0 : startIdx + 1}–{endIdx} de {totalRecords} registros
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              <span className="text-sm px-2 min-w-[80px] text-center">
                Página <strong>{currentPage}</strong> de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="gap-1"
              >
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              <div className="flex items-center gap-1 ml-2">
                <span className="text-sm text-muted-foreground">Ir para:</span>
                <Input
                  value={gotoPage}
                  onChange={(e) => setGotoPage(e.target.value.replace(/\D/g, ""))}
                  className="h-8 w-16"
                  placeholder="Pág."
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const n = parseInt(gotoPage, 10);
                    if (!isNaN(n) && n >= 1 && n <= totalPages) setPage(n);
                    setGotoPage("");
                  }}
                >
                  Ok
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----- subcomponents -----

function StatCard({
  label, value, icon, valueClass, iconBg,
}: {
  label: string; value: string; icon: React.ReactNode;
  valueClass?: string; iconBg?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={cn("p-1.5 rounded-md", iconBg)}>
          {icon}
        </div>
      </div>
      <p className={cn("text-xl sm:text-2xl font-semibold font-display tabular-nums", valueClass)}>
        {value}
      </p>
    </div>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onClick, align, icon,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir;
  onClick: (k: SortKey) => void; align?: "left" | "right"; icon?: React.ReactNode;
}) {
  const active = sortKey === k;
  return (
    <th
      className={cn(
        "px-3 py-3 font-medium select-none cursor-pointer hover:bg-muted/60",
        align === "right" && "text-right",
      )}
      onClick={() => onClick(k)}
    >
      <div className={cn(
        "inline-flex items-center gap-1",
        align === "right" && "justify-end w-full",
      )}>
        {icon}
        <span>{label}</span>
        {active ? (
          sortDir === "asc"
            ? <ArrUp className="h-3 w-3 text-primary" />
            : <ArrDown className="h-3 w-3 text-primary" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>
    </th>
  );
}

function statusPill(status: TxStatus): { label: string; cls: string } {
  switch (status) {
    case "paid":
      return { label: "Pago", cls: "bg-success/15 text-success border-success/30" };
    case "overdue":
      return { label: "Vencido", cls: "bg-destructive/15 text-destructive border-destructive/30" };
    case "cancelled":
      return { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" };
    case "pending":
    default:
      return { label: "Em dia", cls: "bg-muted text-muted-foreground border-border" };
  }
}
