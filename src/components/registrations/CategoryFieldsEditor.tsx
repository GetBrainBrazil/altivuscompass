import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  SEED_TEMPLATES,
  ensureUniqueKey,
  getEffectiveSpan,
  isValidSchema,
} from "@/lib/category-schema";
import { Layers, Plus, Sparkles } from "lucide-react";
import { CategoryFieldsCanvas } from "./CategoryFieldsCanvas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string; field_schema?: unknown } | null;
}

const newField = (taken: string[]): CategoryField => ({
  key: ensureUniqueKey("novo_campo", taken),
  label: "Novo campo",
  type: "text",
  span: 6,
});

function normalize(fields: CategoryFieldSchema): CategoryFieldSchema {
  return fields.map((f) => ({ ...f, span: getEffectiveSpan(f), width: undefined }));
}

export default function CategoryFieldsEditor({ open, onOpenChange, category }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initial = useMemo<CategoryFieldSchema>(() => {
    if (!category) return [];
    const base = isValidSchema(category.field_schema) ? (category.field_schema as CategoryFieldSchema) : [];
    return normalize(base);
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
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const addField = () => setFields((prev) => [...prev, newField(prev.map((f) => f.key))]);

  const applyTemplate = (key: keyof typeof SEED_TEMPLATES) => {
    const tpl = SEED_TEMPLATES[key];
    if (!tpl) return;
    setFields(normalize(tpl.schema.map((f) => ({ ...f }))));
    toast({ title: `Modelo "${tpl.label}" aplicado`, description: "Revise e salve para aplicar." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" /> Campos do produto — {category?.name}
          </DialogTitle>
          <DialogDescription>
            Arraste para reordenar, redimensione pela alça à direita e clique no campo para editar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 py-2">
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar campos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
