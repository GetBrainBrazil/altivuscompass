import { ReactNode } from "react";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type KanbanTagTone =
  | "blue"
  | "purple"
  | "amber"
  | "green"
  | "rose"
  | "slate";

export type KanbanTag = {
  label: string;
  tone?: KanbanTagTone;
};

/**
 * Alerta visual exibido como badge no canto superior direito do card.
 * - tone "destructive": badge vermelho + força borda esquerda destrutiva.
 * - tone "warning":     badge âmbar.
 * - tone "success":     badge verde (ex.: lead convertido).
 */
export type KanbanCardAlert = {
  label: string;
  tone: "destructive" | "warning" | "success";
};

export type KanbanCardData = {
  id: string;
  clientName: string;
  destination?: string;
  travelDate?: string;
  tags?: KanbanTag[];
  estimatedValue?: number;
  agent?: {
    name: string;
    avatarUrl?: string;
  };
  /** Marca o card como lead recém-triado pela IA (WhatsApp). */
  isAILead?: boolean;
  /** Resumo curto da necessidade extraída pela IA. Exibido em itálico, máx. 2 linhas. */
  aiSummary?: string;
  /** Alerta visual exibido como badge no topo direito (e cor da borda esquerda quando destrutivo). */
  alert?: KanbanCardAlert;
};

const TAG_TONE_CLASSES: Record<KanbanTagTone, string> = {
  blue: "bg-blue-50/70 text-blue-700",
  purple: "bg-purple-50/70 text-purple-700",
  amber: "bg-amber-50/70 text-amber-700",
  green: "bg-emerald-50/70 text-emerald-700",
  rose: "bg-rose-50/70 text-rose-700",
  slate: "bg-slate-100/70 text-slate-700",
};

const ALERT_BADGE_CLASSES: Record<KanbanCardAlert["tone"], string> = {
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
};

function formatBRL(value?: number) {
  if (value == null) return null;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function KanbanCard({
  card,
  onClick,
  /** Classe Tailwind de cor da borda esquerda (ex: "border-l-soft-blue"). Sobreposta por alerta destrutivo. */
  stageBorderClass = "border-l-muted-foreground/40",
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: {
  card: KanbanCardData;
  onClick?: (card: KanbanCardData) => void;
  stageBorderClass?: string;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (card: KanbanCardData, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (card: KanbanCardData, e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const value = formatBRL(card.estimatedValue);
  const alert = card.alert;

  // Badge mostrado no canto superior direito (alerta tem prioridade sobre IA)
  let cornerBadge: ReactNode = null;
  if (alert) {
    const Icon = alert.tone === "success" ? CheckCircle2 : AlertTriangle;
    cornerBadge = (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
          ALERT_BADGE_CLASSES[alert.tone],
        )}
      >
        <Icon className="w-3 h-3" />
        {alert.label}
      </span>
    );
  } else if (card.isAILead) {
    cornerBadge = (
      <span
        title="Lead triado pela IA via WhatsApp"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success"
      >
        <Sparkles className="w-3 h-3" />
        IA
      </span>
    );
  }

  const leftBorder = alert?.tone === "destructive" ? "border-l-destructive" : stageBorderClass;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", card.id);
        } catch {
          /* ignore */
        }
        onDragStart?.(card, e);
      }}
      onDragEnd={(e) => onDragEnd?.(card, e)}
      onClick={() => onClick?.(card)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(card);
        }
      }}
      className={cn(
        "group relative rounded-lg border border-border bg-card text-left",
        "border-l-[3px] shadow-sm hover:shadow-md transition-all animate-fade-in",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
        leftBorder,
        alert?.tone === "destructive" && "bg-destructive/5",
      )}
    >
      <div className="px-3.5 py-3">
        {/* Topo: nome + badge no canto superior direito */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium font-body text-foreground flex-1 min-w-0 truncate leading-snug">
            {card.clientName}
          </p>
          {cornerBadge && (
            <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
              {cornerBadge}
            </div>
          )}
        </div>

        {/* Linha de contexto: destino · data */}
        <div className="min-h-[16px] mb-2">
          {(card.destination || card.travelDate) && (
            <p className="text-xs text-muted-foreground font-body truncate">
              {[card.destination, card.travelDate].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* AI summary (compacto) */}
        {card.isAILead && card.aiSummary && (
          <p className="text-[11px] italic text-muted-foreground/80 font-body leading-snug line-clamp-2 mb-2">
            "{card.aiSummary}"
          </p>
        )}

        {/* Tags compactas */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {card.tags.map((tag, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium font-body",
                  TAG_TONE_CLASSES[tag.tone ?? "slate"],
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {/* Divisor sutil */}
        <div className="h-px bg-border/60 -mx-3.5" />

        {/* Rodapé: avatar + responsável + valor */}
        <div className="flex items-center gap-2 pt-2.5">
          <div
            className={cn(
              "shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-semibold",
              card.agent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {card.agent ? getInitials(card.agent.name) : "?"}
          </div>
          <span className="text-xs text-muted-foreground font-body truncate flex-1 min-w-0">
            {card.agent?.name || "Sem responsável"}
          </span>
          {value ? (
            <span className="text-[13px] font-medium text-foreground font-body shrink-0 tabular-nums">
              {value}
            </span>
          ) : (
            <span className="text-xs italic text-muted-foreground/70 font-body shrink-0">
              Sem valor
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
