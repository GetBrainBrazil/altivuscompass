import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Banknote, CalendarDays, CheckCircle2, Filter, RefreshCw,
  Search, ArrowUp, ArrowDown, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
};

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—";

export default function Reconciliation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [bankId, setBankId] = useState<string>("all");
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(todayStr());
  const [statusView, setStatusView] = useState<"unreconciled" | "reconciled" | "all">("unreconciled");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: banks = [] } = useQuery({
    queryKey: ["finance-banks-reconciliation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts").select("id, bank_name, account_number").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["finance-reconciliation", bankId, from, to, statusView],
    queryFn: async () => {
      let q: any = (supabase.from("financial_transactions") as any)
        .select("id, type, description, party_name, payment_date, amount, base_amount, bank_account_id, status, is_reconciled, reconciled_at")
        .in("status", ["paid", "received"])
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date", { ascending: true });
      if (bankId !== "all") q = q.eq("bank_account_id", bankId);
      if (statusView === "unreconciled") q = q.or("is_reconciled.is.null,is_reconciled.eq.false");
      if (statusView === "reconciled") q = q.eq("is_reconciled", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r: any) =>
      (r.description ?? "").toLowerCase().includes(term)
      || (r.party_name ?? "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let credit = 0, debit = 0, selCredit = 0, selDebit = 0;
    for (const r of filtered) {
      const v = Number(r.base_amount ?? r.amount ?? 0);
      if (r.type === "receivable") credit += v; else debit += v;
      if (selected.has(r.id)) {
        if (r.type === "receivable") selCredit += v; else selDebit += v;
      }
    }
    return { credit, debit, net: credit - debit, selCredit, selDebit, selNet: selCredit - selDebit };
  }, [filtered, selected]);

  const allSelected = filtered.length > 0 && filtered.every((r: any) => selected.has(r.id));
  const toggleAll = (v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) filtered.forEach((r: any) => next.add(r.id));
      else filtered.forEach((r: any) => next.delete(r.id));
      return next;
    });
  };

  const reconcileMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await (supabase.from("financial_transactions") as any)
        .update({ is_reconciled: true, reconciled_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conciliação concluída", description: "Lançamentos marcados como conciliados." });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["finance-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const unreconcileMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("financial_transactions") as any)
        .update({ is_reconciled: false, reconciled_at: null, reconciled_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conciliação desfeita" });
      qc.invalidateQueries({ queryKey: ["finance-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4 px-4 sm:px-6 py-4 w-full max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-semibold flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" /> Conciliação Bancária
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Confronte os lançamentos pagos/recebidos com o extrato da conta bancária correspondente.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Conta bancária</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {banks.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bank_name}{b.account_number ? ` — ${b.account_number}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Situação</Label>
          <Select value={statusView} onValueChange={(v: any) => setStatusView(v)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unreconciled">A conciliar</SelectItem>
              <SelectItem value="reconciled">Já conciliados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou contraparte…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Entradas no período" value={brl(totals.credit)} color="text-success" icon={<ArrowUp className="h-4 w-4" />} />
        <SummaryCard label="Saídas no período" value={brl(totals.debit)} color="text-destructive" icon={<ArrowDown className="h-4 w-4" />} />
        <SummaryCard label="Saldo líquido" value={brl(totals.net)} color={totals.net >= 0 ? "text-emerald-700" : "text-destructive"} icon={<Banknote className="h-4 w-4" />} />
        <SummaryCard label="Selecionado (líquido)" value={brl(totals.selNet)} color="text-primary" icon={<Filter className="h-4 w-4" />} />
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span><strong>{selected.size}</strong> lançamento(s) selecionado(s) — total líquido <strong>{brl(totals.selNet)}</strong></span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Limpar</Button>
            <Button size="sm" className="gap-1" onClick={() => reconcileMutation.mutate(Array.from(selected))} disabled={reconcileMutation.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como conciliado
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Selecionar todos" />
                </th>
                <th className="px-3 py-3 font-medium">Data</th>
                <th className="px-3 py-3 font-medium">Descrição</th>
                <th className="px-3 py-3 font-medium">Contraparte</th>
                <th className="px-3 py-3 font-medium">Conta</th>
                <th className="px-3 py-3 font-medium text-right">Valor</th>
                <th className="px-3 py-3 font-medium">Situação</th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Info className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum lançamento encontrado para esses filtros.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r: any) => {
                  const v = Number(r.base_amount ?? r.amount ?? 0);
                  const credit = r.type === "receivable";
                  const bank = banks.find((b: any) => b.id === r.bank_account_id);
                  return (
                    <tr key={r.id} className={cn("border-t border-border", r.is_reconciled && "bg-success/5")}>
                      <td className="px-3 py-3">
                        {!r.is_reconciled ? (
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={(v) => setSelected((prev) => {
                              const n = new Set(prev);
                              if (v) n.add(r.id); else n.delete(r.id);
                              return n;
                            })}
                          />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDate(r.payment_date)}</td>
                      <td className="px-3 py-3"><span className="truncate">{r.description || "—"}</span></td>
                      <td className="px-3 py-3 text-muted-foreground truncate max-w-[180px]">{r.party_name || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground truncate max-w-[180px]">
                        {bank ? `${bank.bank_name}${bank.account_number ? " — " + bank.account_number : ""}` : "—"}
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums font-medium", credit ? "text-success" : "text-destructive")}>
                        {credit ? "+ " : "− "}{brl(v)}
                      </td>
                      <td className="px-3 py-3">
                        {r.is_reconciled ? (
                          <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                            Conciliado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
                            A conciliar
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.is_reconciled && (
                          <Button size="sm" variant="ghost" onClick={() => unreconcileMutation.mutate(r.id)}>
                            Desfazer
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <CalendarDays className="h-3 w-3" />
        Em breve: importação de extrato bancário (OFX/CSV) com sugestão automática de match.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="p-1.5 rounded-md bg-muted text-muted-foreground">{icon}</div>
      </div>
      <p className={cn("text-xl font-semibold tabular-nums font-display", color)}>{value}</p>
    </div>
  );
}
