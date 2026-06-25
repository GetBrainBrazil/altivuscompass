import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ClosedSale = {
  id: string;
  quote_id: string | null;
  client_id: string | null;
  client_name: string;
  destination: string | null;
  total_value: number;
  total_cost: number;
  margin: number;
  margin_pct: number;
  travel_date_start: string | null;
  ticket_issued_at: string | null;
  received: number;
  pending: number;
  next_due: string | null;
  installments: number;
  payment_status: "quitado" | "em_dia" | "atrasado" | "sem_lancamento";
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) =>
  s ? new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

export default function FinanceClosedSales() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightQuote = searchParams.get("quote");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["finance", "closed-sales"],
    queryFn: async (): Promise<ClosedSale[]> => {
      // 1. Vendas em estágio "fechado" (concluída ou pós-venda)
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, quote_id, client_id, destination, total_value, travel_date_start, ticket_issued_at, stage, clients(full_name)")
        .in("stage", ["completed", "post_sale"])
        .order("ticket_issued_at", { ascending: false, nullsFirst: false });
      if (error) throw error;

      const quoteIds = (sales ?? []).map((s: any) => s.quote_id).filter(Boolean);

      // 2. Custos dos itens
      const costMap = new Map<string, number>();
      if (quoteIds.length) {
        const { data: items } = await supabase
          .from("quote_items")
          .select("quote_id, unit_cost, quantity")
          .in("quote_id", quoteIds);
        for (const it of items ?? []) {
          const qid = (it as any).quote_id as string;
          const c = Number((it as any).unit_cost ?? 0) * Number((it as any).quantity ?? 1);
          costMap.set(qid, (costMap.get(qid) ?? 0) + c);
        }
      }

      // 3. Recebimentos (financial_transactions tipo receivable)
      type Tx = { quote_id: string | null; amount: number; status: string | null; due_date: string | null };
      const txByQuote = new Map<string, Tx[]>();
      if (quoteIds.length) {
        const { data: txs } = await supabase
          .from("financial_transactions")
          .select("quote_id, amount, status, due_date, type, category")
          .in("quote_id", quoteIds)
          .or("type.eq.receivable,category.eq.receivable");
        for (const t of (txs ?? []) as any[]) {
          if (!t.quote_id) continue;
          const arr = txByQuote.get(t.quote_id) ?? [];
          arr.push({ quote_id: t.quote_id, amount: Number(t.amount ?? 0), status: t.status, due_date: t.due_date });
          txByQuote.set(t.quote_id, arr);
        }
      }

      const today = new Date().toISOString().slice(0, 10);

      return (sales ?? []).map((s: any) => {
        const total_value = Number(s.total_value ?? 0);
        const total_cost = s.quote_id ? (costMap.get(s.quote_id) ?? 0) : 0;
        const margin = total_value - total_cost;
        const margin_pct = total_value > 0 ? (margin / total_value) * 100 : 0;

        const txs = s.quote_id ? (txByQuote.get(s.quote_id) ?? []) : [];
        const received = txs
          .filter((t) => t.status === "paid" || t.status === "reconciled")
          .reduce((sum, t) => sum + t.amount, 0);
        const pending_txs = txs.filter((t) => t.status !== "paid" && t.status !== "reconciled");
        const pending = pending_txs.reduce((sum, t) => sum + t.amount, 0);
        const next_due = pending_txs
          .map((t) => t.due_date)
          .filter(Boolean)
          .sort()[0] ?? null;
        const has_overdue = pending_txs.some((t) => t.due_date && t.due_date < today);

        let payment_status: ClosedSale["payment_status"] = "sem_lancamento";
        if (txs.length > 0) {
          if (pending <= 0.01) payment_status = "quitado";
          else if (has_overdue) payment_status = "atrasado";
          else payment_status = "em_dia";
        }

        return {
          id: s.id,
          quote_id: s.quote_id,
          client_id: s.client_id,
          client_name: s.clients?.full_name ?? "Sem cliente",
          destination: s.destination,
          total_value,
          total_cost,
          margin,
          margin_pct,
          travel_date_start: s.travel_date_start,
          ticket_issued_at: s.ticket_issued_at,
          received,
          pending,
          next_due,
          installments: txs.length,
          payment_status,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return rows.filter((r) => {
      if (q && !r.client_name.toLowerCase().includes(q) && !(r.destination ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && r.payment_status !== statusFilter) return false;
      if (periodFilter !== "all" && r.ticket_issued_at) {
        const d = new Date(r.ticket_issued_at);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        if (periodFilter === "30" && diffDays > 30) return false;
        if (periodFilter === "90" && diffDays > 90) return false;
        if (periodFilter === "365" && diffDays > 365) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, periodFilter]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.total_value, 0);
    const cost = filtered.reduce((s, r) => s + r.total_cost, 0);
    const margin = revenue - cost;
    const margin_pct = revenue > 0 ? (margin / revenue) * 100 : 0;
    const received = filtered.reduce((s, r) => s + r.received, 0);
    const pending = filtered.reduce((s, r) => s + r.pending, 0);
    return { revenue, cost, margin, margin_pct, received, pending };
  }, [filtered]);

  const statusBadge = (s: ClosedSale["payment_status"]) => {
    const map: Record<ClosedSale["payment_status"], { label: string; cls: string }> = {
      quitado: { label: "Quitado", cls: "bg-success/15 text-success border-success/30" },
      em_dia: { label: "Em dia", cls: "bg-soft-blue/15 text-soft-blue border-soft-blue/30" },
      atrasado: { label: "Atrasado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
      sem_lancamento: { label: "Sem lançamento", cls: "bg-muted text-muted-foreground border-border" },
    };
    const v = map[s];
    return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
  };

  // Highlight + scroll para linha quando vier via ?quote=<id>
  useEffect(() => {
    if (!highlightQuote || filtered.length === 0) return;
    const match = filtered.find((r) => r.quote_id === highlightQuote);
    if (!match) return;
    const el = rowRefs.current[match.id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(match.id);
      const t = setTimeout(() => {
        setFlashId(null);
        const sp = new URLSearchParams(searchParams);
        sp.delete("quote");
        setSearchParams(sp, { replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [highlightQuote, filtered, searchParams, setSearchParams]);

  const goToSale = (saleId: string) => navigate(`/sales?open=${saleId}`);


  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Vendas Fechadas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão financeira: receita, custos, margens e acompanhamento de recebimento.
        </p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Receita</div>
          <div className="text-lg font-semibold">{fmtBRL(totals.revenue)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Custo</div>
          <div className="text-lg font-semibold">{fmtBRL(totals.cost)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Margem (R$)</div>
          <div className="text-lg font-semibold">{fmtBRL(totals.margin)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Margem (%)</div>
          <div className="text-lg font-semibold">{totals.margin_pct.toFixed(1)}%</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Recebido</div>
          <div className="text-lg font-semibold text-success">{fmtBRL(totals.received)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Em aberto</div>
          <div className="text-lg font-semibold text-destructive">{fmtBRL(totals.pending)}</div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por cliente ou destino…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="quitado">Quitado</SelectItem>
            <SelectItem value="em_dia">Em dia</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="sem_lancamento">Sem lançamento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Venda</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead>Próx. venc.</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma venda fechada encontrada.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  ref={(el) => { rowRefs.current[r.id] = el; }}
                  onClick={() => goToSale(r.id)}
                  className={`cursor-pointer hover:bg-muted/40 transition-colors ${flashId === r.id ? "bg-soft-blue/15" : ""}`}
                >
                  <TableCell className="font-medium">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1.5 group">
                            {r.client_name}
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Abrir venda no CRM</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>{r.destination ?? "—"}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.total_value)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.total_cost)}</TableCell>
                  <TableCell className={`text-right ${r.margin < 0 ? "text-destructive" : ""}`}>{fmtBRL(r.margin)}</TableCell>
                  <TableCell className={`text-right ${r.margin_pct < 0 ? "text-destructive" : ""}`}>{r.margin_pct.toFixed(1)}%</TableCell>
                  <TableCell className="text-center">{r.installments || "—"}</TableCell>
                  <TableCell className="text-right text-success">{fmtBRL(r.received)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(r.pending)}</TableCell>
                  <TableCell>{fmtDate(r.next_due)}</TableCell>
                  <TableCell>{statusBadge(r.payment_status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
