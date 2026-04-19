import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { getDeadlineTone, getAgeTone, getValidityBadge } from "@/lib/quote-status";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<string, string> = {
  yellow: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  orange: "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  red: "border-destructive/40 bg-destructive/15 text-destructive",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function diffDays(a: string, b: Date) {
  const target = startOfDay(new Date(`${a.slice(0,10)}T00:00:00`));
  return Math.round((target.getTime() - startOfDay(b).getTime()) / 86_400_000);
}

interface Props {
  internalDueDate?: string | null;
  createdAt?: string | null;
  quoteValidity?: string | null;
  stage?: string | null;
  closeProbability?: string | null;
}

export function QuoteCardBadges({ internalDueDate, createdAt, quoteValidity, stage, closeProbability }: Props) {
  const isClosed = stage === "confirmed" || stage === "completed";
  const deadlineTone = getDeadlineTone(internalDueDate, stage);
  const ageTone = getAgeTone(createdAt, stage);
  const validity = getValidityBadge(quoteValidity, stage);

  let deadlineLabel: string | null = null;
  if (internalDueDate && !isClosed && deadlineTone !== "none") {
    const days = diffDays(internalDueDate, new Date());
    if (days < 0) deadlineLabel = `Atrasada ${Math.abs(days)}d`;
    else if (days === 0) deadlineLabel = "Hoje";
    else if (days === 1) deadlineLabel = "Amanhã";
    else deadlineLabel = `${days} dias`;
  }

  let ageLabel: string | null = null;
  if (createdAt && !isClosed && ageTone !== "none") {
    const days = -diffDays(createdAt, new Date());
    ageLabel = `Há ${days} dias`;
  }

  const hasAny = deadlineLabel || ageLabel || validity || closeProbability;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {deadlineLabel && (
        <Badge variant="outline" className={cn("text-[9px] gap-1 font-body", TONE_CLASS[deadlineTone])}>
          <Clock className="w-2.5 h-2.5" />{deadlineLabel}
        </Badge>
      )}
      {validity && (
        <Badge variant="outline" className={cn("text-[9px] font-body", TONE_CLASS[validity.tone])}>
          {validity.label}
        </Badge>
      )}
      {ageLabel && (
        <Badge variant="outline" className={cn("text-[9px] font-body", TONE_CLASS[ageTone])}>
          {ageLabel}
        </Badge>
      )}
      {closeProbability && <ProbabilityBadge value={closeProbability} />}
    </div>
  );
}

const PROB_LABEL: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta" };
const PROB_DOT: Record<string, string> = {
  low: "bg-destructive",
  medium: "bg-amber-500",
  high: "bg-emerald-500",
};
const PROB_RING: Record<string, string> = {
  low: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  high: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function ProbabilityBadge({ value, className }: { value: string; className?: string }) {
  if (!value || !PROB_LABEL[value]) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium font-body",
      PROB_RING[value], className,
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", PROB_DOT[value])} />
      {PROB_LABEL[value]}
    </span>
  );
}

export const PROBABILITY_OPTIONS = [
  { value: "_none", label: "Não definida" },
  { value: "low", label: "Baixa", dot: "bg-destructive" },
  { value: "medium", label: "Média", dot: "bg-amber-500" },
  { value: "high", label: "Alta", dot: "bg-emerald-500" },
];
