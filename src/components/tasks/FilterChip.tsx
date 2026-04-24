import { useState } from "react";
import { ChevronDown, X, Search, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  label: string;
  value: string;
  active: boolean;
  onClear: () => void;
  width?: number;
  children: React.ReactNode;
}

export function FilterChip({ label, value, active, onClear, width = 240, children }: FilterChipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full border text-xs font-body transition-colors max-w-[220px]",
            active
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <span className="truncate">{active ? value : label}</span>
          {active ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClear(); } }}
              className="shrink-0 rounded-full p-0.5 hover:bg-primary/20"
              aria-label={`Limpar ${label}`}
            >
              <X size={11} />
            </span>
          ) : (
            <ChevronDown size={12} className="shrink-0 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" style={{ width }}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

interface SearchableListProps {
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}

export function SearchableList({ items, selected, onSelect, placeholder = "Buscar..." }: SearchableListProps) {
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()))
    : items;
  return (
    <div className="flex flex-col">
      <div className="relative p-2 border-b border-border">
        <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum resultado</div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/60 transition-colors",
                selected === item.id && "text-primary font-medium",
              )}
            >
              <span className={cn(
                "shrink-0 h-3.5 w-3.5 rounded-sm border flex items-center justify-center",
                selected === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}>
                {selected === item.id && <Check size={10} />}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
