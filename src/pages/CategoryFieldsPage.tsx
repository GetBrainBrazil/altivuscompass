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
  SEED_TEMPLATES,
  ensureUniqueKey,
  getEffectiveSpan,
  isValidSchema,
} from "@/lib/category-schema";
import { ArrowLeft, Layers, Plus, Sparkles, Trash2 } from "lucide-react";
import { CategoryFieldsCanvas } from "@/components/registrations/CategoryFieldsCanvas";

const newField = (taken: string[]): CategoryField => ({
  key: ensureUniqueKey("novo_campo", taken),
  label: "Novo campo",
  type: "text",
  span: 6,
});

function normalize(fields: CategoryFieldSchema): CategoryFieldSchema {
  return fields.map((f) => ({ ...f, span: getEffectiveSpan(f), width: undefined }));
}

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
    const base = isValidSchema(category.field_schema) ? (category.field_schema as CategoryFieldSchema) : [];
    return normalize(base);
  }, [category, isNew]);

  const [fields, setFields] = useState<CategoryFieldSchema>(initial);
  
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
        <span className="text-xs text-muted-foreground ml-auto">
          {fields.length} campo(s) · grid 12 col
        </span>
      </div>

      <CategoryFieldsCanvas fields={fields} onChange={setFields} />


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

