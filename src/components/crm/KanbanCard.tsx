import { ReactNode } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, UserPlus, Flame, Plane, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
 */
export type KanbanCardAlert = {
  label: string;
  tone: "destructive" | "warning" | "success";
};

/** Temperatura do lead — controla cor do ícone de chama. */
export type LeadTemperature = "hot" | "warm" | "cold";

export type KanbanCardData = {
  id: string;
  clientName: string;
  /** Telefone do lead (E.164 sem '+', como vem do WhatsApp). */
  phone?: string;
  destination?: string;
  travelDate?: string;
  /** ISO date (YYYY-MM-DD) da viagem — usado para calcular "Embarque próximo". */
  travelDateISO?: string;
  tags?: KanbanTag[];
  estimatedValue?: number;
  agent?: {
    name: string;
    avatarUrl?: string;
  };
  isAILead?: boolean;
  isManualLead?: boolean;
  aiSummary?: string;
  alert?: KanbanCardAlert;
  contactLevel?: ContactLevel;
  /** Timestamp ISO de quando o card entrou na coluna atual. Usado para badge "Xd na etapa". */
  stageEnteredAt?: string;
  /** Temperatura do lead (default: "cold"). */
  temperature?: LeadTemperature;
  /** Cliente já existente iniciando uma nova jornada de compra. */
  isRepurchase?: boolean;
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

const TEMP_NEXT: Record<LeadTemperature, LeadTemperature> = {
  cold: "warm",
  warm: "hot",
  hot: "cold",
};

const TEMP_LABEL: Record<LeadTemperature, string> = {
  hot: "Quente — quer fechar em breve",
  warm: "Morno — interesse sem urgência",
  cold: "Frio — contato inicial",
};

const TEMP_CLASSES: Record<LeadTemperature, string> = {
  hot: "text-red-500 fill-red-500/30",
  warm: "text-orange-400 fill-orange-400/25",
  cold: "text-slate-400",
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

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function stageDaysBadgeClasses(d: number): string {
  if (d >= 14) return "bg-destructive/15 text-destructive";
  if (d >= 7) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function stageDaysLabel(d: number): string {
  if (d >= 14) return "14d+";
  return `${d}d`;
}

export function KanbanCard({
  card,
  onClick,
  stageBorderClass = "border-l-muted-foreground/40",
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onTemperatureChange,
  onDelete,
}: {
  card: KanbanCardData;
  onClick?: (card: KanbanCardData) => void;
  stageBorderClass?: string;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (card: KanbanCardData, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (card: KanbanCardData, e: React.DragEvent<HTMLDivElement>) => void;
  /** Callback ao clicar no ícone de chama para alternar a temperatura. */
  onTemperatureChange?: (card: KanbanCardData, next: LeadTemperature) => void;
  /** Callback ao clicar em "Excluir" no menu de 3 pontos. */
  onDelete?: (card: KanbanCardData) => void;
}) {
  const value = formatBRL(card.estimatedValue);
  const alert = card.alert;
  const temperature: LeadTemperature = card.temperature ?? "cold";
  const stageDays = daysSince(card.stageEnteredAt);
  const daysToTravel = daysUntil(card.travelDateISO);
  const isBoardingSoon = daysToTravel !== null && daysToTravel >= 0 && daysToTravel <= 30;

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
  } else if (card.isManualLead) {
    cornerBadge = (
      <span
        title="Lead criado manualmente pelo consultor"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-soft-blue/15 text-soft-blue"
      >
        <UserPlus className="w-3 h-3" />
        Manual
      </span>
    );
  }

  const leftBorder = alert?.tone === "destructive" ? "border-l-destructive" : stageBorderClass;
  const noAgent = !card.agent;

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
          const node = e.currentTarget as HTMLDivElement;
          const rect = node.getBoundingClientRect();
          const ghost = node.cloneNode(true) as HTMLDivElement;
          ghost.style.position = "absolute";
          ghost.style.top = "-1000px";
          ghost.style.left = "-1000px";
          ghost.style.width = `${rect.width}px`;
          ghost.style.pointerEvents = "none";
          ghost.style.opacity = "1";
          ghost.style.transform = "rotate(2.5deg)";
          ghost.style.boxShadow =
            "0 20px 35px -10px hsl(var(--foreground) / 0.35), 0 8px 16px -6px hsl(var(--foreground) / 0.25)";
          ghost.style.borderRadius = "0.5rem";
          ghost.setAttribute("data-drag-ghost", "true");
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
          window.setTimeout(() => {
            ghost.remove();
          }, 0);
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
        isDragging && "opacity-30",
        leftBorder,
        alert?.tone === "destructive" && "bg-destructive/5",
      )}
    >
      <div className="px-3.5 py-3">
        {/* Topo: nome + badge + menu no canto superior direito */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium font-body text-foreground flex-1 min-w-0 truncate leading-snug">
            {card.clientName}
          </p>
          <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {cornerBadge}
            {onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Mais ações"
                    className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      onDelete(card);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Badge de nível do contato */}
        {card.contactLevel && (
          <div className="mb-1.5">
            <ContactLevelBadge level={card.contactLevel} size="xs" />
          </div>
        )}

        {/* Linha de contexto: destino · data */}
        <div className="min-h-[16px] mb-2 flex items-center gap-1.5 flex-wrap">
          {(card.destination || card.travelDate) && (
            <p className="text-xs text-muted-foreground font-body truncate">
              {[card.destination, card.travelDate].filter(Boolean).join(" · ")}
            </p>
          )}
          {isBoardingSoon && (
            <span
              title={`Embarque em ${daysToTravel} dia(s)`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive"
            >
              <Plane className="w-3 h-3" />
              Embarque próximo
            </span>
          )}
        </div>

        {/* AI summary */}
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
              card.agent ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive",
            )}
            aria-hidden
          >
            {card.agent ? getInitials(card.agent.name) : "?"}
          </div>
          <span
            className={cn(
              "text-xs font-body truncate flex-1 min-w-0",
              noAgent ? "text-destructive font-medium" : "text-muted-foreground",
            )}
          >
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

        {/* Linha inferior: dias na etapa (esquerda) + temperatura (direita) */}
        <div className="flex items-center justify-between mt-2">
          {stageDays !== null ? (
            <span
              title={`${stageDays} dia(s) nesta etapa`}
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums",
                stageDaysBadgeClasses(stageDays),
              )}
            >
              {stageDaysLabel(stageDays)}
            </span>
          ) : (
            <span />
          )}

          <button
            type="button"
            title={`${TEMP_LABEL[temperature]} (clique para alterar)`}
            aria-label={`Temperatura: ${TEMP_LABEL[temperature]}`}
            onClick={(e) => {
              e.stopPropagation();
              onTemperatureChange?.(card, TEMP_NEXT[temperature]);
            }}
            className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted/60 transition-colors"
          >
            <Flame className={cn("w-3.5 h-3.5 transition-colors", TEMP_CLASSES[temperature])} />
          </button>
        </div>
      </div>
    </div>
  );
}
