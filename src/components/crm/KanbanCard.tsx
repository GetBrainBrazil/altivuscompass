import { MapPin, Calendar } from "lucide-react";
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

export function KanbanCard({ card }: { card: KanbanCardData }) {
  const value = formatBRL(card.estimatedValue);

  return (
    <div
      className={cn(
        "group cursor-pointer rounded-lg bg-white p-3.5",
        "border border-transparent shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        "transition-all duration-150",
        "hover:border-border hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)]"
      )}
    >
      {/* Title */}
      <h4 className="text-sm font-semibold text-foreground leading-tight tracking-tight">
        {card.clientName}
      </h4>

      {/* Meta */}
      {(card.destination || card.travelDate) && (
        <div className="mt-2 space-y-1">
          {card.destination && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{card.destination}</span>
            </div>
          )}
          {card.travelDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{card.travelDate}</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((tag, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset",
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
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center">
            {card.agent ? (
              <Avatar className="h-6 w-6 ring-2 ring-white">
                {card.agent.avatarUrl && (
                  <AvatarImage src={card.agent.avatarUrl} alt={card.agent.name} />
                )}
                <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">
                  {getInitials(card.agent.name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span />
            )}
          </div>
          {value && (
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
