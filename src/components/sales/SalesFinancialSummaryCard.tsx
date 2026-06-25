import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = {
  quoteId: string | null;
  totalValue: number;
};

export function SalesFinancialSummaryCard({ quoteId, totalValue }: Props) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["sales-financial-summary", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      // Custos
      const { data: items } = await supabase
        .from("quote_items")
        .select("unit_cost, quantity")
        .eq("quote_id", quoteId!);
      const total_cost = (items ?? []).reduce(
        (s, it: any) => s + Number(it.unit_cost ?? 0) * Number(it.quantity ?? 1),
        0,
      );

      // Recebimentos
      const { data: txs } = await supabase
        .from("financial_transactions")
        .select("amount, status, due_date, type, category")
        .eq("quote_id", quoteId!)
        .or("type.eq.receivable,category.eq.receivable");

      const today = new Date().toISOString().slice(0, 10);
      let received = 0;
      let pending = 0;
      let overdue = 0;
      for (const t of (txs ?? []) as any[]) {
        const amt = Number(t.amount ?? 0);
        if (t.status === "paid" || t.status === "reconciled") {
          received += amt;
        } else {
          pending += amt;
          if (t.due_date && t.due_date < today) overdue += amt;
        }
      }
      return {
        total_cost,
        received,
        pending,
        overdue,
        installments: (txs ?? []).length,
      };
    },
  });

  if (!quoteId) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-xs text-muted-foreground">
          Esta venda não está vinculada a uma cotação — sem dados financeiros para exibir.
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const margin = totalValue - data.total_cost;
  const margin_pct = totalValue > 0 ? (margin / totalValue) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium font-body">Resumo financeiro</h4>
          {data.overdue > 0 ? (
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
              {fmtBRL(data.overdue)} atrasado
            </Badge>
          ) : data.pending <= 0.01 && data.installments > 0 ? (
            <Badge variant="outline" className="bg-success/15 text-success border-success/30">
              Quitado
            </Badge>
          ) : data.installments > 0 ? (
            <Badge variant="outline" className="bg-soft-blue/15 text-soft-blue border-soft-blue/30">
              Em dia
            </Badge>
          ) : (
            <Badge variant="outline">Sem lançamento</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Receita</div>
            <div className="font-semibold text-sm">{fmtBRL(totalValue)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Custo</div>
            <div className="font-semibold text-sm">{fmtBRL(data.total_cost)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Margem</div>
            <div className={`font-semibold text-sm ${margin < 0 ? "text-destructive" : ""}`}>
              {fmtBRL(margin)} <span className="text-xs font-normal text-muted-foreground">({margin_pct.toFixed(1)}%)</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Parcelas</div>
            <div className="font-semibold text-sm">{data.installments || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Recebido</div>
            <div className="font-semibold text-sm text-success">{fmtBRL(data.received)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Em aberto</div>
            <div className={`font-semibold text-sm ${data.pending > 0 ? "text-destructive" : ""}`}>{fmtBRL(data.pending)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="font-body"
            onClick={() => navigate(`/finance/closed-sales?quote=${quoteId}`)}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Ver em Vendas Fechadas
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="font-body"
            onClick={() => navigate(`/finance/receivables?quote=${quoteId}`)}
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5" />
            Ver lançamentos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
