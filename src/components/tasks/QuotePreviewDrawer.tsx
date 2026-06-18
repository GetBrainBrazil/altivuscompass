import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { Plane, User as UserIcon, CalendarIcon, ExternalLink } from "lucide-react";

const ITEM_TYPE_LABEL: Record<string, string> = {
  flight: "Voo",
  hotel: "Hospedagem",
  transport: "Transporte",
  cruise: "Cruzeiro",
  experience: "Experiência",
  insurance: "Seguro",
  other_service: "Outro",
};

const STAGE_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  negotiating: "Em negociação",
  confirmed: "Confirmada",
  completed: "Concluída",
  lost: "Perdida",
  canceled: "Cancelada",
};

function fmtBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (isNaN(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function derivePhase(stage: string | null | undefined): string {
  if (stage === "confirmed") return "Venda";
  if (stage === "completed") return "Pós-venda";
  return "Cotação";
}

export function QuotePreviewDrawer({
  quoteId,
  open,
  onOpenChange,
}: {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["quote-preview", quoteId],
    enabled: !!quoteId && open,
    queryFn: async () => {
      const { data: q } = await supabase
        .from("quotes")
        .select(
          "id, title, destination, stage, total_value, discount_amount, discount_percent, travel_date_start, travel_date_end, clients(full_name)",
        )
        .eq("id", quoteId!)
        .maybeSingle();
      const { data: items } = await supabase
        .from("quote_items")
        .select(
          "id, title, description, item_type, unit_price, quantity, sort_order, products(name, product_categories:category_id(name))",
        )
        .eq("quote_id", quoteId!)
        .order("sort_order", { ascending: true });
      return { quote: q as any, items: (items ?? []) as any[] };
    },
  });

  const q = data?.quote;
  const items = data?.items ?? [];
  const period = (() => {
    const s = fmtDate(q?.travel_date_start);
    const e = fmtDate(q?.travel_date_end);
    if (s && e) return `${s} → ${e}`;
    return s || e || null;
  })();
  const total = fmtBRL(q?.total_value);
  const discount =
    q?.discount_amount && Number(q.discount_amount) > 0
      ? fmtBRL(q.discount_amount)
      : q?.discount_percent && Number(q.discount_percent) > 0
        ? `${Number(q.discount_percent)}%`
        : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(90vw,448px)] sm:max-w-none flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <SheetTitle className="font-display text-lg flex items-center gap-2">
            <Plane size={16} className="text-muted-foreground shrink-0" />
            Resumo da cotação
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="px-6 py-4 space-y-4 font-body text-sm min-w-0 max-w-full w-full overflow-x-hidden">
            {isLoading || !q ? (
              <PreviewSkeleton />
            ) : (
              <>
                <section className="space-y-1.5 min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Destino
                  </div>
                  <div className="font-medium text-foreground break-words">
                    {q.destination || q.title || "Sem destino"}
                  </div>
                </section>

                {q.clients?.full_name && (
                  <section className="space-y-1.5 min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Cliente
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground min-w-0">
                      <UserIcon size={12} className="text-muted-foreground shrink-0" />
                      <span className="truncate" title={q.clients.full_name}>
                        {q.clients.full_name}
                      </span>
                    </div>
                  </section>
                )}

                {period && (
                  <section className="space-y-1.5 min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Período
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground min-w-0">
                      <CalendarIcon size={12} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{period}</span>
                    </div>
                  </section>
                )}

                <section className="flex items-center gap-2 flex-wrap min-w-0">
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {derivePhase(q.stage)}
                  </Badge>
                  {q.stage && (
                    <Badge variant="outline" className="text-[10px]">
                      {STAGE_LABEL[q.stage] ?? String(q.stage).replace(/_/g, " ")}
                    </Badge>
                  )}
                </section>

                <section className="rounded-md border bg-muted/30 p-3 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground">Valor total</span>
                    <span className="font-medium text-foreground shrink-0">{total}</span>
                  </div>
                  {discount && (
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="text-xs text-muted-foreground">Desconto</span>
                      <span className="text-foreground shrink-0">−{discount}</span>
                    </div>
                  )}
                </section>

                <section className="space-y-2 min-w-0 overflow-x-hidden">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Itens ({items.length})
                  </div>
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">Nenhum item.</div>
                  ) : (
                    <ul className="space-y-1.5 min-w-0 w-full max-w-full overflow-x-hidden">
                      {items.map((it) => {
                        const typeLabel = ITEM_TYPE_LABEL[it.item_type] ?? it.item_type;
                        const productName = it.products?.name ?? null;
                        const itemLabel = it.title || it.description || "(sem título)";
                        return (
                          <li
                            key={it.id}
                            className="w-full max-w-full box-border rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs min-w-0 overflow-hidden"
                          >
                            <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 max-w-full">
                              <span className="font-medium text-foreground shrink-0">
                                {typeLabel}
                              </span>
                              {productName && (
                                <>
                                  <span className="shrink-0">›</span>
                                  <span
                                    className="truncate min-w-0"
                                    title={productName}
                                  >
                                    {productName}
                                  </span>
                                </>
                              )}
                            </div>
                            <div
                              className="text-foreground truncate max-w-full"
                              title={itemLabel}
                            >
                              {itemLabel}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        <SheetFooter className="px-6 py-3 border-t shrink-0">
          <Button
            className="w-full"
            onClick={() => {
              if (quoteId) navigate(`/quotes?quoteId=${quoteId}`);
            }}
            disabled={!quoteId}
          >
            <ExternalLink size={14} className="mr-2 shrink-0" />
            Abrir cotação completa
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-16 w-full rounded-md" />
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}
