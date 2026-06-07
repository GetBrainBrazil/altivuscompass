import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  CategoryField,
  CategoryFieldSchema,
  FIELD_TYPE_LABELS,
  FIELD_WIDTH_LABELS,
  FieldType,
  FieldWidth,
  SEED_TEMPLATES,
  ensureUniqueKey,
  isValidSchema,
  slugify,
} from "@/lib/category-schema";
import { ArrowDown, ArrowLeft, ArrowUp, Layers, Plus, Sparkles, Trash2 } from "lucide-react";

const newField = (taken: string[]): CategoryField => ({
  key: ensureUniqueKey("novo_campo", taken),
  label: "Novo campo",
  type: "text",
  width: "half",
});

export default function CategoryFieldsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: category, isLoading } = useQuery({
    queryKey: ["product_categories", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const initial = useMemo<CategoryFieldSchema>(() => {
    if (!category) return [];
    return isValidSchema(category.field_schema) ? (category.field_schema as CategoryFieldSchema) : [];
  }, [category]);

  const [fields, setFields] = useState<CategoryFieldSchema>(initial);

  useEffect(() => {
    setFields(initial);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!category) return;
      const { error } = await supabase
        .from("product_categories")
        .update({ field_schema: fields as any })
        .eq("id", category.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      toast({ title: "Campos da categoria salvos" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const updateField = (idx: number, patch: Partial<CategoryField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const remove = (idx: number) => setFields((prev) => prev.filter((_, i) => i !== idx));
  const addField = () => setFields((prev) => [...prev, newField(prev.map((f) => f.key))]);
  const applyTemplate = (key: keyof typeof SEED_TEMPLATES) => {
    const tpl = SEED_TEMPLATES[key];
    if (!tpl) return;
    setFields(tpl.schema.map((f) => ({ ...f })));
    toast({ title: `Modelo "${tpl.label}" aplicado`, description: "Revise e salve para aplicar." });
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!category) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Categoria não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/registrations")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/registrations")} className="w-fit">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" /> Campos do produto — {category.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Defina os campos que serão pedidos ao adicionar um produto desta categoria em uma cotação.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando..." : "Salvar campos"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Sparkles className="w-4 h-4" /> Aplicar modelo Altivus
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.entries(SEED_TEMPLATES).map(([k, v]) => (
              <DropdownMenuItem key={k} onClick={() => applyTemplate(k as keyof typeof SEED_TEMPLATES)}>
                {v.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={addField}>
          <Plus className="w-4 h-4" /> Adicionar campo
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5">
            <Switch checked={showTechnical} onCheckedChange={setShowTechnical} id="tech-toggle" />
            <Label htmlFor="tech-toggle" className="text-xs cursor-pointer">Dados técnicos</Label>
          </div>
          <span className="text-xs text-muted-foreground">{fields.length} campo(s)</span>
        </div>
      </div>


      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            Nenhum campo definido. Aplique um modelo ou adicione manualmente.
          </div>
        ) : (
          fields.map((f, idx) => (
            <FieldRow
              key={`${f.key}-${idx}`}
              field={f}
              takenKeys={fields.map((x, i) => (i === idx ? "__self__" : x.key))}
              onChange={(patch) => updateField(idx, patch)}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
              onRemove={() => remove(idx)}
              isFirst={idx === 0}
              isLast={idx === fields.length - 1}
            />
          ))
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando..." : "Salvar campos"}
        </Button>
      </div>
    </div>
  );
}

interface RowProps {
  field: CategoryField;
  takenKeys: string[];
  onChange: (patch: Partial<CategoryField>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function FieldRow({ field, takenKeys, onChange, onMoveUp, onMoveDown, onRemove, isFirst, isLast }: RowProps) {
  const supportsOptions = field.type === "select" || field.type === "checkbox";
  const isLockedKey = !!field.mapsTo;

  const handleLabelChange = (label: string) => {
    const taken = takenKeys.filter((k) => k !== "__self__");
    const auto = ensureUniqueKey(slugify(label), taken);
    if (field.key.startsWith("novo_campo") || field.key === slugify(field.label)) {
      onChange({ label, key: auto });
    } else {
      onChange({ label });
    }
  };

  return (
    <div className="border rounded-md p-3 bg-card space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-1">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-2">
          <div className="col-span-12 sm:col-span-4 space-y-0.5">
            <Label className="text-[11px]">Rótulo</Label>
            <Input value={field.label} onChange={(e) => handleLabelChange(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-0.5">
            <Label className="text-[11px]">Chave (key)</Label>
            <Input
              value={field.key}
              onChange={(e) => onChange({ key: slugify(e.target.value) })}
              disabled={isLockedKey}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-0.5">
            <Label className="text-[11px]">Tipo</Label>
            <Select value={field.type} onValueChange={(v) => onChange({ type: v as FieldType })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                  <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-6 sm:col-span-2 space-y-0.5">
            <Label className="text-[11px]">Largura</Label>
            <Select value={field.width ?? "full"} onValueChange={(v) => onChange({ width: v as FieldWidth })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FIELD_WIDTH_LABELS) as FieldWidth[]).map((w) => (
                  <SelectItem key={w} value={w}>{FIELD_WIDTH_LABELS[w]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-12 sm:col-span-4 space-y-0.5">
            <Label className="text-[11px]">Placeholder</Label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-0.5">
            <Label className="text-[11px]">Grupo</Label>
            <Input
              value={field.group ?? ""}
              onChange={(e) => onChange({ group: e.target.value || undefined })}
              placeholder="Ex: Datas"
              className="h-8 text-xs"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 flex items-end gap-2">
            <div className="flex items-center gap-1.5">
              <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: v })} />
              <Label className="text-[11px]">Obrigatório</Label>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-2 flex items-end justify-end">
            <Button type="button" variant="ghost" size="sm" className="text-destructive h-8" onClick={onRemove}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
            </Button>
          </div>

          {supportsOptions && (
            <div className="col-span-12 space-y-1.5 border-t pt-2 mt-1">
              <Label className="text-[11px]">Opções (uma por linha — formato <code>valor|rótulo</code> ou só o rótulo)</Label>
              <textarea
                className="w-full text-xs font-mono rounded-md border border-input bg-background px-2 py-1.5 min-h-[80px]"
                value={(field.options ?? [])
                  .map((o) => (o.value === o.label ? o.label : `${o.value}|${o.label}`))
                  .join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  const opts = lines.map((line) => {
                    const [v, l] = line.includes("|") ? line.split("|") : [slugify(line), line];
                    return { value: slugify(v || ""), label: (l || v || "").trim() };
                  });
                  onChange({ options: opts });
                }}
              />
            </div>
          )}

          {isLockedKey && (
            <div className="col-span-12 text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Este campo sincroniza com a coluna <code>{field.mapsTo}</code> do item. A chave não pode ser alterada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
