import { MapPin, Calendar, Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
};

const TAG_TONE_CLASSES: Record<KanbanTagTone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
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
}: {
  card: KanbanCardData;
  onClick?: (card: KanbanCardData) => void;
}) {
  const value = formatBRL(card.estimatedValue);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(card)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(card);
        }
      }}
      className={cn(
        "group relative cursor-pointer rounded-xl bg-white p-5 text-left",
        "shadow-sm",
        "transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        card.isAILead && "overflow-hidden pl-5"
      )}
    >
      {/* AI lead: bright green left accent */}
      {card.isAILead && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"
        />
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-[15px] font-semibold text-foreground leading-tight tracking-tight font-sans">
          {card.clientName}
        </h4>
        {card.isAILead && (
          <span
            title="Lead triado pela IA via WhatsApp"
            className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100"
          >
            <Bot className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        )}
      </div>

      {/* AI summary */}
      {card.isAILead && card.aiSummary && (
        <p className="mt-3 text-[13px] italic text-muted-foreground/80 leading-relaxed line-clamp-2 font-sans">
          "{card.aiSummary}"
        </p>
      )}

      {/* Meta */}
      {(card.destination || card.travelDate) && (
        <div className="mt-3 space-y-1.5">
          {card.destination && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-sans">
              <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{card.destination}</span>
            </div>
          )}
          {card.travelDate && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-sans">
              <Calendar className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{card.travelDate}</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.tags.map((tag, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset font-sans",
                TAG_TONE_CLASSES[tag.tone ?? "slate"]
              )}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      {(card.agent || value) && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center">
            {card.agent ? (
              <Avatar className="h-7 w-7 ring-2 ring-white shadow-sm">
                {card.agent.avatarUrl && (
                  <AvatarImage src={card.agent.avatarUrl} alt={card.agent.name} />
                )}
                <AvatarFallback className="text-[10px] font-medium bg-slate-100 text-slate-600">
                  {getInitials(card.agent.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span />
            )}
          </div>
          {value && (
            <span className="text-[15px] font-semibold text-foreground tabular-nums font-sans">
              {value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}