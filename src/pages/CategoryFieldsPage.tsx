import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit";
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
  const isNew = id === "new";
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
    enabled: !!id && !isNew,
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ["product_categories", id, "product_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!id && !isNew,
  });

  const initial = useMemo<CategoryFieldSchema>(() => {
    if (isNew) return [];
    if (!category) return [];
    return isValidSchema(category.field_schema) ? (category.field_schema as CategoryFieldSchema) : [];
  }, [category, isNew]);

  const [fields, setFields] = useState<CategoryFieldSchema>(initial);
  const [showTechnical, setShowTechnical] = useState(false);
  const [meta, setMeta] = useState({ name: "", description: "", is_active: true });

  useEffect(() => {
    setFields(initial);
  }, [initial]);

  useEffect(() => {
    if (category) {
      setMeta({
        name: category.name ?? "",
        description: category.description ?? "",
        is_active: !!category.is_active,
      });
    }
  }, [category]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: meta.name.trim(),
        description: meta.description || null,
        is_active: meta.is_active,
        field_schema: fields as any,
      };
      if (isNew) {
        const { data, error } = await supabase
          .from("product_categories")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        await logAuditEvent({ action: "create", tableName: "product_categories", recordId: data.id, recordLabel: payload.name, newData: payload });
        return data.id as string;
      } else {
        const { error } = await supabase
          .from("product_categories")
          .update(payload)
          .eq("id", category!.id);
        if (error) throw error;
        await logAuditEvent({ action: "update", tableName: "product_categories", recordId: category!.id, recordLabel: payload.name, oldData: category, newData: payload });
        return category!.id as string;
      }
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      toast({ title: isNew ? "Categoria criada" : "Categoria salva" });
      if (isNew && newId) navigate(`/registrations/categories/${newId}/fields`, { replace: true });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!category) return;
      if (productCount > 0) throw new Error(`Existem ${productCount} produto(s) vinculados a esta categoria.`);
      const { error } = await supabase.from("product_categories").delete().eq("id", category.id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", tableName: "product_categories", recordId: category.id, recordLabel: category.name, oldData: category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      toast({ title: "Categoria removida" });
      navigate("/registrations");
    },
    onError: (e: any) => toast({ title: "Não foi possível excluir", description: e.message, variant: "destructive" }),
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

  if (isLoading && !isNew) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!isNew && !category) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Categoria não encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/registrations")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const canDelete = !isNew && productCount === 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/registrations")} className="w-fit">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" /> {isNew ? "Nova categoria" : `Editar categoria — ${meta.name || category?.name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Dados básicos e campos que serão pedidos ao adicionar um produto desta categoria em uma cotação.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !meta.name.trim()}>
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Dados básicos da categoria */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label>Nome <span className="text-destructive">*</span></Label>
            <Input
              value={meta.name}
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
              placeholder="Passeio, Transfer, Seguro..."
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={meta.is_active} onCheckedChange={(v) => setMeta((m) => ({ ...m, is_active: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Descrição</Label>
          <Textarea
            value={meta.description}
            onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
            rows={2}
          />
        </div>
      </div>

      {/* Toolbar dos campos */}
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
              showTechnical={showTechnical}
            />
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t">
        <div className="flex flex-col gap-1">
          {!isNew && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive border-destructive/30 w-fit"
                  disabled={!canDelete}
                  title={!canDelete ? `Existem ${productCount} produto(s) vinculados` : "Excluir categoria"}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Excluir categoria
                  {productCount > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({productCount} produto{productCount > 1 ? "s" : ""})
                    </span>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir "{meta.name}"? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isNew && !canDelete && (
            <p className="text-xs text-muted-foreground">
              Para excluir, remova ou troque a categoria dos {productCount} produto(s) vinculados.
            </p>
          )}
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !meta.name.trim()}>
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
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
  showTechnical: boolean;
}

function FieldRow({ field, takenKeys, onChange, onMoveUp, onMoveDown, onRemove, isFirst, isLast, showTechnical }: RowProps) {
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
          <div className={`col-span-12 ${showTechnical ? "sm:col-span-4" : "sm:col-span-5"} space-y-0.5`}>
            <Label className="text-[11px]">Rótulo</Label>
            <Input value={field.label} onChange={(e) => handleLabelChange(e.target.value)} className="h-8 text-xs" />
          </div>
          {showTechnical && (
            <div className="col-span-6 sm:col-span-3 space-y-0.5">
              <Label className="text-[11px]">Chave (key)</Label>
              <Input
                value={field.key}
                onChange={(e) => onChange({ key: slugify(e.target.value) })}
                disabled={isLockedKey}
                className="h-8 text-xs font-mono"
              />
            </div>
          )}
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

          {showTechnical && (
            <>
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
            </>
          )}
          <div className={`col-span-6 ${showTechnical ? "sm:col-span-3" : "sm:col-span-2"} flex items-end gap-2`}>
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
              <Label className="text-[11px]">Opções (uma por linha — apenas o rótulo)</Label>
              <textarea
                className="w-full text-xs rounded-md border border-input bg-background px-2 py-1.5 min-h-[80px]"
                placeholder={"direto\n1 conexão\n2 conexões"}
                value={(field.options ?? []).map((o) => o.label).join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                  const seen: string[] = [];
                  const opts = lines.map((label) => {
                    const value = ensureUniqueKey(slugify(label), seen);
                    seen.push(value);
                    return { value, label };
                  });
                  onChange({ options: opts });
                }}
              />
            </div>
          )}

          {showTechnical && isLockedKey && (
            <div className="col-span-12 text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Este campo sincroniza com a coluna <code>{field.mapsTo}</code> do item. A chave não pode ser alterada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
