import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  DEAL_PHASES,
  DEAL_SITUATIONS,
  getStageDef,
  getSituationDef,
  type DealPhase,
} from "@/lib/deal-stages";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyBadge } from "@/components/company/CompanyBadge";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * FASE 1 — Pipeline Unificado (opção B).
 *
 * Tela ÚNICA que substitui visualmente Cotações + Vendas + Pós-venda.
 * Lê da tabela `deals` (que já é a fonte canônica). Kanban com 3 zonas
 * separadas por divisórias verticais + drag entre etapas (inclusive
 * entre fases). Card mostra badges de situação e é clicável para abrir
 * detalhe (por enquanto reaproveita LeadDetail via source_quote_id).
 *
 * Comportamento não destrutivo: telas antigas (/quotes, /sales, /crm/ops)
 * seguem funcionando. Esta é a nova visão que será validada antes da
 * migração final.
 */

type Deal = {
  id: string;
  title: string | null;
  destination: string | null;
  stage: string;
  phase: DealPhase;
  situation: string[] | null;
  total_value: number | null;
  travel_date_start: string | null;
  travel_date_end: string | null;
  company: string | null;
  client_id: string | null;
  assigned_to: string | null;
  archived_at: string | null;
  source_quote_id: string | null;
  updated_at: string | null;
};

function formatBRL(v: number | null): string {
  if (!v || Number(v) <= 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function formatTravel(a: string | null, b: string | null): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    }).replace(".", "");
  if (a && b) return `${fmt(a)} – ${fmt(b)}`;
  if (a) return fmt(a);
  if (b) return fmt(b);
  return "";
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("deals")
      .select(
        "id,title,destination,stage,phase,situation,total_value,travel_date_start,travel_date_end,company,client_id,assigned_to,archived_at,source_quote_id,updated_at",
      )
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar pipeline", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setDeals((data ?? []) as Deal[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("deals-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const d of deals) {
      (map[d.stage] ??= []).push(d);
    }
    return map;
  }, [deals]);

  async function moveDeal(dealId: string, toStage: string) {
    const stageDef = getStageDef(toStage);
    if (!stageDef) return;
    const original = deals.find((d) => d.id === dealId);
    if (!original || original.stage === toStage) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stage: toStage, phase: stageDef.phase } : d,
      ),
    );

    const { error } = await supabase
      .from("deals")
      .update({ stage: toStage, phase: stageDef.phase })
      .eq("id", dealId);

    if (error) {
      toast({ title: "Não foi possível mover", description: error.message, variant: "destructive" });
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stage: original.stage, phase: original.phase } : d,
        ),
      );
      return;
    }
    toast({ title: "Card movido", description: `Etapa: ${stageDef.label}` });
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">
              Pipeline Comercial
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Cotação → Emissão → Pós-venda em um único fluxo. Arraste os cards entre etapas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {deals.length} {deals.length === 1 ? "negócio ativo" : "negócios ativos"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate("/crm/lead/new")}>
              + Novo negócio
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="inline-flex h-full min-w-full">
            {DEAL_PHASES.map((phase, phaseIdx) => (
              <div
                key={phase.key}
                className={cn(
                  "flex flex-col h-full",
                  phaseIdx > 0 && "border-l-2 border-dashed border-border/70",
                )}
              >
                {/* Phase header */}
                <div className={cn("px-4 pt-4 pb-2 sticky top-0 z-10 bg-background")}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full",
                        phase.key === "quoting" && "bg-soft-blue",
                        phase.key === "selling" && "bg-gold",
                        phase.key === "fulfilling" && "bg-primary",
                      )}
                    />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-body">
                      {phase.label}
                    </h2>
                  </div>
                </div>

                {/* Stage columns */}
                <div className="flex gap-3 px-4 pb-4 h-full overflow-y-hidden">
                  {phase.stages.map((stage) => {
                    const items = dealsByStage[stage.key] ?? [];
                    const isDropTarget = dropTarget === stage.key;
                    return (
                      <div
                        key={stage.key}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropTarget(stage.key);
                        }}
                        onDragLeave={() => {
                          if (dropTarget === stage.key) setDropTarget(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDropTarget(null);
                          if (dragId) moveDeal(dragId, stage.key);
                          setDragId(null);
                        }}
                        className={cn(
                          "flex flex-col w-72 shrink-0 rounded-lg bg-muted/30 border border-transparent transition-colors",
                          isDropTarget && "border-primary bg-primary/5",
                        )}
                      >
                        <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", stage.color)} />
                            <span className="text-sm font-medium text-foreground font-body truncate">
                              {stage.label}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">
                            {items.length}
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                          {items.length === 0 ? (
                            <div className="text-xs text-muted-foreground/60 text-center py-6 font-body italic">
                              Vazio
                            </div>
                          ) : (
                            items.map((deal) => (
                              <DealCard
                                key={deal.id}
                                deal={deal}
                                isDragging={dragId === deal.id}
                                onDragStart={() => setDragId(deal.id)}
                                onDragEnd={() => setDragId(null)}
                                onClick={() => {
                                  // Enquanto Fase 6 (detalhe unificado) não sai, usamos o detalhe legado
                                  if (deal.source_quote_id) {
                                    navigate(`/quotes?open=${deal.source_quote_id}`);
                                  } else {
                                    navigate(`/crm/ops?open=${deal.id}`);
                                  }
                                }}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DealCard({
  deal,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const situations = (deal.situation ?? []).map(getSituationDef).filter(Boolean) as ReturnType<
    typeof getSituationDef
  >[];
  const isLost = deal.situation?.includes("lost");
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group rounded-md border border-border bg-card px-3 py-2.5 cursor-grab active:cursor-grabbing",
        "shadow-sm hover:shadow-md transition-all",
        isDragging && "opacity-40",
        isLost && "opacity-60 line-through",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-foreground font-body truncate flex-1 min-w-0 leading-snug">
          {deal.title || deal.destination || "Sem título"}
        </p>
        <CompanyBadge company={deal.company} />
      </div>

      {(deal.travel_date_start || deal.travel_date_end) && (
        <p className="text-xs text-muted-foreground font-body truncate mb-1.5">
          {formatTravel(deal.travel_date_start, deal.travel_date_end)}
        </p>
      )}

      {situations.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {situations.map((s) =>
            s ? (
              <span
                key={s.key}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                  s.badgeClass,
                )}
                title={s.description}
              >
                {s.key === "lost" && <AlertTriangle className="w-2.5 h-2.5" />}
                {s.label}
              </span>
            ) : null,
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
        <span className="text-[11px] text-muted-foreground font-body truncate">
          {deal.destination || "—"}
        </span>
        <span className="text-xs font-medium text-foreground font-body shrink-0">
          {formatBRL(deal.total_value)}
        </span>
      </div>
    </div>
  );
}

/**
 * Wrapper que expõe as situações disponíveis no filtro (será usado
 * quando adicionarmos a barra de filtros na próxima entrega).
 */
export const AVAILABLE_SITUATIONS = DEAL_SITUATIONS;
