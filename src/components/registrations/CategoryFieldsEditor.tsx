import { useEffect, useMemo, useRef, useState } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  FieldType,
  SEED_TEMPLATES,
  ensureUniqueKey,
  getEffectiveSpan,
  isValidSchema,
  slugify,
  spanClass,
} from "@/lib/category-schema";
import { GripVertical, Layers, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

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

/** Migra `width` → `span` (sem destruir) ao carregar. */
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    setFields(initial);
    setEditingIdx(null);
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

  const updateField = (idx: number, patch: Partial<CategoryField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const remove = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const addField = () => {
    setFields((prev) => {
      const next = [...prev, newField(prev.map((f) => f.key))];
      setEditingIdx(next.length - 1);
      return next;
    });
  };

  const applyTemplate = (key: keyof typeof SEED_TEMPLATES) => {
    const tpl = SEED_TEMPLATES[key];
    if (!tpl) return;
    setFields(normalize(tpl.schema.map((f) => ({ ...f }))));
    setEditingIdx(null);
    toast({ title: `Modelo "${tpl.label}" aplicado`, description: "Revise e salve para aplicar." });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.key === active.id);
    const to = fields.findIndex((f) => f.key === over.id);
    if (from < 0 || to < 0) return;
    setFields((prev) => arrayMove(prev, from, to));
    setEditingIdx(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" /> Campos do produto — {category?.name}
          </DialogTitle>
          <DialogDescription>
            Arraste para reordenar e use a alça <strong>azul à direita</strong> para redimensionar (grid de 12 colunas).
            Clique em um campo para editar seus detalhes.
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

        {fields.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
            Nenhum campo definido. Aplique um modelo ou adicione manualmente.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={fields.map((f) => f.key)} strategy={rectSortingStrategy}>
              <CanvasGrid
                fields={fields}
                editingIdx={editingIdx}
                onSelect={setEditingIdx}
                onResize={(idx, span) => updateField(idx, { span })}
              />
            </SortableContext>
          </DndContext>
        )}

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

      {editingIdx !== null && fields[editingIdx] && (
        <FieldPropertiesSheet
          open
          onClose={() => setEditingIdx(null)}
          field={fields[editingIdx]}
          takenKeys={fields.map((f, i) => (i === editingIdx ? "__self__" : f.key))}
          onChange={(patch) => updateField(editingIdx, patch)}
          onRemove={() => remove(editingIdx)}
        />
      )}
    </Dialog>
  );
}

/* =================== Canvas WYSIWYG =================== */

interface CanvasProps {
  fields: CategoryFieldSchema;
  editingIdx: number | null;
  onSelect: (idx: number) => void;
  onResize: (idx: number, span: number) => void;
}

function CanvasGrid({ fields, editingIdx, onSelect, onResize }: CanvasProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-12 gap-2 p-3 rounded-md border bg-muted/20 min-h-[120px]"
    >
      {fields.map((f, idx) => (
        <SortableCard
          key={f.key}
          id={f.key}
          field={f}
          selected={editingIdx === idx}
          onClick={() => onSelect(idx)}
          onResize={(span) => onResize(idx, span)}
          gridRef={gridRef}
        />
      ))}
    </div>
  );
}

interface SortableCardProps {
  id: string;
  field: CategoryField;
  selected: boolean;
  onClick: () => void;
  onResize: (span: number) => void;
  gridRef: React.RefObject<HTMLDivElement>;
}

function SortableCard({ id, field, selected, onClick, onResize, gridRef }: SortableCardProps) {
  const span = getEffectiveSpan(field);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [resizing, setResizing] = useState(false);
  const [previewSpan, setPreviewSpan] = useState<number | null>(null);

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const gapPx = 8; // gap-2 = 8px
    const colWidth = (gridRect.width - gapPx * 11) / 12;
    const startX = e.clientX;
    const startSpan = span;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaCols = Math.round(dx / (colWidth + gapPx));
      const next = Math.max(1, Math.min(12, startSpan + deltaCols));
      setPreviewSpan(next);
    };
    const onUp = () => {
      setResizing(false);
      setPreviewSpan((cur) => {
        if (cur !== null && cur !== span) onResize(cur);
        return null;
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const displaySpan = previewSpan ?? span;
  const colClass = spanClass(displaySpan);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group rounded-md border bg-card transition-shadow",
        colClass,
        selected ? "ring-2 ring-primary border-primary" : "hover:border-primary/40",
        resizing && "ring-2 ring-primary",
      )}
      onClick={onClick}
    >
      <div className="flex items-stretch min-h-[64px]">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex items-center px-1.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Content */}
        <div className="flex-1 py-1.5 pr-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium truncate">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </span>
            <span className="ml-auto shrink-0 text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
              {displaySpan}/12
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {FIELD_TYPE_LABELS[field.type]}
          </div>
        </div>

        {/* Resize handle (right edge) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar"
          onPointerDown={onResizePointerDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-1.5 cursor-col-resize rounded-r-md transition-colors",
            "bg-transparent hover:bg-primary/60 group-hover:bg-primary/30",
            (resizing || selected) && "bg-primary/70",
          )}
          title="Arraste para redimensionar (1–12)"
        />
      </div>
    </div>
  );
}

/* =================== Properties Sheet =================== */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  field: CategoryField;
  takenKeys: string[];
  onChange: (patch: Partial<CategoryField>) => void;
  onRemove: () => void;
}

function FieldPropertiesSheet({ open, onClose, field, takenKeys, onChange, onRemove }: SheetProps) {
  const supportsOptions = field.type === "select" || field.type === "checkbox";
  const isLockedKey = !!field.mapsTo;
  const span = getEffectiveSpan(field);

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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Propriedades do campo
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1">
            <Label className="text-[11px]">Rótulo</Label>
            <Input value={field.label} onChange={(e) => handleLabelChange(e.target.value)} className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Chave (key)</Label>
              <Input
                value={field.key}
                disabled={isLockedKey}
                onChange={(e) => onChange({ key: slugify(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
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
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">Largura no grid</Label>
              <span className="text-[10px] font-mono text-muted-foreground">{span}/12</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={span}
              onChange={(e) => onChange({ span: Number(e.target.value), width: undefined })}
              className="w-full accent-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Em mobile todos os campos ficam em 100%. Em tablet, ajustamos automaticamente.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Placeholder</Label>
            <Input
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Grupo (opcional)</Label>
            <Input
              value={field.group ?? ""}
              onChange={(e) => onChange({ group: e.target.value || undefined })}
              placeholder="Ex: Datas"
              className="h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={!!field.required} onCheckedChange={(v) => onChange({ required: v })} />
            <Label className="text-[11px]">Obrigatório</Label>
          </div>

          {supportsOptions && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-[11px]">
                Opções (uma por linha — <code>valor|rótulo</code> ou só o rótulo)
              </Label>
              <textarea
                className="w-full text-xs font-mono rounded-md border border-input bg-background px-2 py-1.5 min-h-[120px]"
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
            <div className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1">
              Este campo sincroniza com a coluna <code>{field.mapsTo}</code> do item. A chave não pode ser alterada.
            </div>
          )}

          <div className="border-t pt-3 flex justify-between">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover campo
            </Button>
            <Button size="sm" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
