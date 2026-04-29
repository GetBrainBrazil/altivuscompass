import { cn } from "@/lib/utils";
import { User, Sparkles, Crown } from "lucide-react";

export type ContactLevel = "prospect" | "lead" | "cliente";

const LEVEL_CONFIG: Record<
  ContactLevel,
  { label: string; classes: string; Icon: typeof User }
> = {
  prospect: {
    label: "Prospect",
    classes: "bg-slate-100 text-slate-600",
    Icon: User,
  },
  lead: {
    label: "Lead",
    classes: "bg-sky-50 text-sky-700",
    Icon: Sparkles,
  },
  cliente: {
    label: "Cliente",
    classes: "bg-amber-50 text-amber-700",
    Icon: Crown,
  },
};

export function ContactLevelBadge({
  level,
  size = "sm",
  showIcon = true,
  className,
}: {
  level: ContactLevel;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  className?: string;
}) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.prospect;
  const Icon = cfg.Icon;

  const sizeClasses =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : size === "md"
        ? "text-xs px-2.5 py-1 gap-1.5"
        : "text-[11px] px-2 py-0.5 gap-1";

  const iconSize = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium font-body uppercase tracking-wide",
        sizeClasses,
        cfg.classes,
        className,
      )}
    >
      {showIcon && <Icon className={iconSize} />}
      {cfg.label}
    </span>
  );
}

export function getContactLevelLabel(level: ContactLevel) {
  return LEVEL_CONFIG[level]?.label ?? "Prospect";
}
