import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus, X, Plane } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { CategoryField, CategoryFieldSchema } from "@/lib/category-schema";
import { getEffectiveSpan, spanClass } from "@/lib/category-schema";
import { cn } from "@/lib/utils";

interface Props {
  schema: CategoryFieldSchema | null | undefined;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  /** Filtra campos pelo scope (estende CategoryField com `scope`). Default: "all". */
  scopeFilter?: "template" | "instancia" | "all";
}

// Convenção: duration_auto é computada a partir de embarque/embarque_hora → chegada/chegada_hora
function computeDuration(values: Record<string, any>): string | null {
  const sd = values?.embarque;
  const st = values?.embarque_hora || "00:00";
  const ed = values?.chegada;
  const et = values?.chegada_hora || "00:00";
  if (!sd || !ed) return null;
  const start = new Date(`${sd}T${st}:00`);
  const end = new Date(`${ed}T${et}:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  let mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function DynamicCategoryFields({ schema, value, onChange, scopeFilter = "all" }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, CategoryField[]>();
    const filtered = (schema ?? []).filter((f) => {
      if (scopeFilter === "all") return true;
      const sc = (f as any).scope ?? "template";
      return sc === scopeFilter;
    });
    for (const f of filtered) {
      const g = f.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries());
  }, [schema, scopeFilter]);

  // Auto-compute durations on relevant changes
  useEffect(() => {
    if (!schema) return;
    const durField = schema.find((f) => f.type === "duration_auto");
    if (!durField) return;
    const next = computeDuration(value || {});
    if (next && next !== value?.[durField.key]) {
      onChange({ ...(value || {}), [durField.key]: next });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.embarque, value?.embarque_hora, value?.chegada, value?.chegada_hora]);

  const setField = (key: string, v: any) => {
    onChange({ ...value, [key]: v });
  };

  if (!schema || schema.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic border border-dashed rounded-md p-4 text-center">
        Esta categoria ainda não tem campos configurados. Configure em{" "}
        <strong>Cadastros &gt; Produtos &gt; Categorias</strong>.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5">
        {groups.map(([groupName, fields]) => (
          <div key={groupName || "default"} className="space-y-2">
            {groupName && (
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </h4>
            )}
            <div className="grid grid-cols-12 gap-3">
              {fields.map((f) => (
                <div key={f.key} className={cn(spanClass(getEffectiveSpan(f)))}>
                  <FieldRenderer field={f} value={value?.[f.key]} onChange={(v) => setField(f.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

function AirportCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const { data: airports = [] } = useQuery({
    queryKey: ["airports-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("airports")
        .select("id, iata_code, name, city, country")
        .order("iata_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal px-2.5">
          <span className="truncate">{value || (placeholder ?? "Selecione o aeroporto")}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar aeroporto..." className="text-xs h-8" />
          <CommandList>
            <CommandEmpty className="text-xs p-2">Nenhum aeroporto encontrado</CommandEmpty>
            {airports.map((ap: any) => {
              const label = `${ap.iata_code} - ${ap.name}`;
              return (
                <CommandItem
                  key={ap.id}
                  value={`${ap.iata_code} ${ap.name} ${ap.city}`}
                  onSelect={() => onChange(label)}
                  className="text-xs cursor-pointer"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === label ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium mr-1">{ap.iata_code}</span>
                  <span className="truncate text-muted-foreground">{ap.name} ({ap.city})</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AirlineCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const { data: airlines = [] } = useQuery({
    queryKey: ["airlines-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("airlines")
        .select("id, name, iata_code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full h-8 justify-between text-xs font-normal px-2.5">
          <span className="truncate">{value || (placeholder ?? "Selecione a companhia")}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar companhia..." className="text-xs h-8" />
          <CommandList>
            <CommandEmpty className="text-xs p-2">Nenhuma companhia encontrada</CommandEmpty>
            {airlines.map((al: any) => {
              const label = al.iata_code ? `${al.name} (${al.iata_code})` : al.name;
              return (
                <CommandItem
                  key={al.id}
                  value={`${al.name} ${al.iata_code ?? ""}`}
                  onSelect={() => onChange(label)}
                  className="text-xs cursor-pointer"
                >
                  <Check className={cn("mr-2 h-3 w-3", value === label ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium mr-1">{al.iata_code || "—"}</span>
                  <span className="truncate text-muted-foreground">{al.name}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: CategoryField;
  value: any;
  onChange: (v: any) => void;
}) {
  const label = (
    <Label className="text-[11px] font-body text-muted-foreground">
      {field.label}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1">
          {label}
          <Textarea
            value={value ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value || null)}
            className="text-xs min-h-[80px]"
          />
        </div>
      );
    case "number":
    case "currency":
      return (
        <div className="space-y-1">
          {label}
          <Input
            type="number"
            step={field.type === "currency" ? "0.01" : "1"}
            value={value ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className="h-8 text-xs"
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-1">
          {label}
          <Input
            type="date"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="h-8 text-xs"
          />
        </div>
      );
    case "time":
      return (
        <div className="space-y-1">
          {label}
          <Input
            type="time"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="h-8 text-xs"
          />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1">
          {label}
          <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={field.placeholder ?? "Selecione"} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "checkbox": {
      if (field.options && field.options.length > 0) {
        const arr: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1">
            {label}
            <div className="flex flex-wrap gap-3">
              {field.options.map((opt) => {
                const checked = arr.includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const next = c ? [...arr, opt.value] : arr.filter((x) => x !== opt.value);
                        onChange(next);
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 pt-5">
          <Checkbox checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
          <Label className="text-xs cursor-pointer">{field.label}</Label>
        </div>
      );
    }
    case "baggage": {
      const v =
        value && typeof value === "object"
          ? value
          : { mochila: 0, mao: 0, despachada: 0 };
      const normalizePart = (raw: unknown) => {
        const n = typeof raw === "number" ? raw : Number(raw ?? 0);
        return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
      };
      const setPart = (k: string, n: number) =>
        onChange({ ...v, [k]: Number.isFinite(n) ? n : 0 });
      const parts: Array<{ key: "mochila" | "mao" | "despachada"; lbl: string; full: string }> = [
        { key: "mochila", lbl: "Mochila", full: "Mochila" },
        { key: "mao", lbl: "Mão", full: "Mala de Mão" },
        { key: "despachada", lbl: "Desp.", full: "Mala Despachada" },
      ];
      return (
        <div className="space-y-1">
          {label}
          <div className="grid grid-cols-3 gap-1">
            {parts.map((p) => {
              const cur = normalizePart((v as any)[p.key]);
              return (
                <Tooltip key={p.key}>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        {p.lbl}
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={cur > 0 ? String(cur) : ""}
                        placeholder=""
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D+/g, "");
                          if (!digits) return setPart(p.key, 0);
                          const n = parseInt(digits, 10);
                          setPart(p.key, Number.isNaN(n) ? 0 : Math.max(0, n));
                        }}
                        className="h-8 text-xs pl-[52px] pr-2 text-right text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4} className="text-[11px]">
                    {p.full}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      );
    }
    case "duration_auto":
      return (
        <div className="space-y-1">
          {label}
          <Input
            value={value ?? ""}
            placeholder="Calculada automaticamente"
            className="h-8 text-xs bg-muted/40"
            readOnly
          />
        </div>
      );
    case "airport":
      return (
        <div className="space-y-1">
          {label}
          <AirportCombobox value={value ?? ""} onChange={onChange} placeholder={field.placeholder} />
        </div>
      );
    case "airline":
      return (
        <div className="space-y-1">
          {label}
          <AirlineCombobox value={value ?? ""} onChange={onChange} placeholder={field.placeholder} />
        </div>
      );
    case "airport_list": {
      const list: string[] = Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
      const update = (next: string[]) => onChange(next.length ? next : []);
      const setAt = (i: number, v: string | null) => {
        const next = [...list];
        next[i] = v ?? "";
        update(next);
      };
      const removeAt = (i: number) => update(list.filter((_, idx) => idx !== i));
      const add = () => update([...list, ""]);
      return (
        <div className="space-y-1.5">
          {label}
          {list.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 px-2 py-1.5 border border-dashed rounded-md">
              <Plane className="w-3 h-3" /> Voo direto (sem escalas)
            </div>
          ) : (
            <div className="space-y-1.5">
              {list.map((ap, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground w-5 text-center">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <AirportCombobox
                      value={ap}
                      onChange={(v) => setAt(i, v)}
                      placeholder={field.placeholder ?? "Aeroporto da escala"}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeAt(i)}
                    aria-label="Remover escala"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={add}
          >
            <Plus className="w-3 h-3" /> Adicionar escala
          </Button>
        </div>
      );
    }
    case "google_places":
    case "text":
    default:
      return (
        <div className="space-y-1">
          {label}
          <Input
            value={value ?? ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value || null)}
            className="h-8 text-xs"
          />
        </div>
      );
  }
}
