import { useMemo } from "react";
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
import type { CategoryField, CategoryFieldSchema } from "@/lib/category-schema";
import { cn } from "@/lib/utils";

interface Props {
  schema: CategoryFieldSchema | null | undefined;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}

const WIDTH_CLASS: Record<string, string> = {
  full: "col-span-12",
  half: "col-span-12 md:col-span-6",
  third: "col-span-12 md:col-span-4",
  quarter: "col-span-12 md:col-span-6 lg:col-span-3",
};

export function DynamicCategoryFields({ schema, value, onChange }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, CategoryField[]>();
    for (const f of schema ?? []) {
      const g = f.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return Array.from(map.entries());
  }, [schema]);

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
              <div key={f.key} className={cn(WIDTH_CLASS[f.width ?? "full"] ?? WIDTH_CLASS.full)}>
                <FieldRenderer field={f} value={value?.[f.key]} onChange={(v) => setField(f.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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
      // Multi-checkbox quando há options; single quando não
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
      const v = value ?? { mochila: 0, mao: 0, despachada: 0 };
      const setPart = (k: string, n: number) => onChange({ ...v, [k]: n });
      return (
        <div className="space-y-1">
          {label}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Mochila</Label>
              <Input
                type="number"
                min={0}
                value={v.mochila ?? 0}
                onChange={(e) => setPart("mochila", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Mala de mão</Label>
              <Input
                type="number"
                min={0}
                value={v.mao ?? 0}
                onChange={(e) => setPart("mao", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Despachada</Label>
              <Input
                type="number"
                min={0}
                value={v.despachada ?? 0}
                onChange={(e) => setPart("despachada", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
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
            onChange={(e) => onChange(e.target.value || null)}
            className="h-8 text-xs bg-muted/40"
            readOnly
          />
        </div>
      );
    // airport / airline / google_places — fallback de texto enquanto integramos componentes reais.
    case "airport":
    case "airline":
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
