import { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card redesenhado do kanban de cotações.
 * - Estado normal: fundo claro, borda esquerda colorida do stage, menu "⋮" no canto.
 * - Estado crítico: fundo rosado, borda esquerda vermelha, badge de alerta no canto;
 *   menu acessível via hover (aparece no canto inferior direito).
 *
 * Mantém drag-and-drop e click para abrir o editor (delegado via callbacks).
 */

const CLOSED_STAGES = new Set(["confirmed", "completed", "lost", "canceled"]);

const STAGE_BORDER: Record<string, string> = {
  new: "border-l-soft-blue",
  sent: "border-l-warning",
  negotiation: "border-l-warning",
  confirmed: "border-l-success",
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const onlyDate = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const d = new Date(`${onlyDate}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(target: Date, ref: Date): number {
  const ms = startOfDay(target).getTime() - startOfDay(ref).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function formatBR(iso: string | null | undefined): string {
  const d = parseDateOnly(iso);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function formatTravelRange(start?: string | null, end?: string | null): string {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (!a && !b) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  if (a && b) return `${fmt(a)} – ${fmt(b)}`;
  return fmt((a ?? b)!);
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatCurrencyShort(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

type Critical = {
  badge: "URGENTE" | "ATRASADA";
  context: string;
};

/**
 * Determina se o card está em estado crítico e o motivo.
 * Prioridade: validade > idade. Stages fechados nunca ficam críticos.
 */
function getCritical(
  quoteValidity: string | null | undefined,
  createdAt: string | null | undefined,
  stage: string | null | undefined,
): Critical | null {
  if (stage && CLOSED_STAGES.has(stage)) return null;
  const today = new Date();

  const validity = parseDateOnly(quoteValidity);
  if (validity) {
    const days = diffDays(validity, today);
    if (days < 0) return { badge: "URGENTE", context: `Expirada · ${formatBR(quoteValidity)}` };
    if (days === 0) return { badge: "URGENTE", context: `Expira hoje · ${formatBR(quoteValidity)}` };
  }

  const created = parseDateOnly(createdAt);
  if (created) {
    const age = diffDays(today, created);
    if (age > 30) return { badge: "ATRASADA", context: `Criada há ${age} dias` };
  }

  return null;
}

/**
 * Linha de contexto quando o card NÃO é crítico.
 * Mostra datas de viagem quando disponíveis.
 */
function getNormalContext(
  travelStart: string | null | undefined,
  travelEnd: string | null | undefined,
): { text: string; tone: "warning" | "muted" } | null {
  const travel = formatTravelRange(travelStart, travelEnd);
  if (travel) return { text: travel, tone: "muted" };
  return null;
}

export interface QuoteKanbanCardProps {
  quote: {
    id: string;
    title?: string | null;
    destination?: string | null;
    stage: string;
    total_value?: number | null;
    travel_date_start?: string | null;
    travel_date_end?: string | null;
    quote_validity?: string | null;
    created_at?: string | null;
    assigned_to?: string | null;
    conclusion_type?: string | null;
    archived_at?: string | null;
  };
  assigneeName?: string | null;
  isDragging?: boolean;
  isArchivedView?: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Trigger do menu "⋮" (DropdownMenu completo: trigger + content). */
  menu: ReactNode;
}

export function QuoteKanbanCard({
  quote,
  assigneeName,
  isDragging,
  isArchivedView,
  onClick,
  onDragStart,
  onDragEnd,
  menu,
}: QuoteKanbanCardProps) {
  const critical = getCritical(
    quote.quote_validity,
    quote.created_at,
    quote.stage,
  );
  const normalContext = !critical
    ? getNormalContext(quote.travel_date_start, quote.travel_date_end)
    : null;

  const showWonBadge = quote.stage === "confirmed" && quote.conclusion_type === "won";
  const stageBorder = STAGE_BORDER[quote.stage] ?? "border-l-muted-foreground";
  const cornerHasBadge = !!critical || showWonBadge;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group relative rounded-lg border border-border bg-card cursor-grab active:cursor-grabbing",
        "border-l-[3px] shadow-sm hover:shadow-md transition-all animate-fade-in",
        critical ? "bg-destructive/5 border-l-destructive" : stageBorder,
        isDragging && "opacity-40",
        isArchivedView && "opacity-60",
      )}
    >
      <div className="px-3.5 py-3">
        {/* Topo: título + canto direito (badge crítico/convertida OU menu ⋮) */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium font-body text-foreground flex-1 min-w-0 truncate leading-snug">
            {quote.title || quote.destination || "Sem título"}
          </p>
          <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {critical && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-destructive/15 text-destructive">
                <AlertTriangle className="w-3 h-3" />
                {critical.badge}
              </span>
            )}
            {!critical && showWonBadge && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success">
                <CheckCircle2 className="w-3 h-3" />
                Convertida
              </span>
            )}
            {/* Menu: visível sempre quando não há badge no canto; quando há, aparece no hover */}
            <div className={cn(cornerHasBadge && "opacity-0 group-hover:opacity-100 transition-opacity")}>
              {menu}
            </div>
          </div>
        </div>

        {/* Linha de contexto (reservada altura mínima pra evitar shift) */}
        <div className="min-h-[16px] mb-2.5">
          {critical ? (
            <p className="text-xs font-medium text-destructive font-body truncate">
              {critical.context}
            </p>
          ) : normalContext ? (
            <p
              className={cn(
                "text-xs font-body truncate",
                normalContext.tone === "warning" ? "text-warning font-medium" : "text-muted-foreground",
              )}
            >
              {normalContext.text}
            </p>
          ) : null}
        </div>

        {/* Divisor sutil */}
        <div className="h-px bg-border/60 -mx-3.5" />

        {/* Rodapé: avatar + vendedor + valor */}
        <div className="flex items-center gap-2 pt-2.5">
          <div
            className={cn(
              "shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-semibold",
              assigneeName
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {assigneeName ? getInitials(assigneeName) : "?"}
          </div>
          <span className="text-xs text-muted-foreground font-body truncate flex-1 min-w-0">
            {assigneeName || "Sem cliente"}
          </span>
          {quote.total_value && Number(quote.total_value) > 0 ? (
            <span className="text-[13px] font-medium text-foreground font-body shrink-0">
              {formatCurrencyShort(quote.total_value)}
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
