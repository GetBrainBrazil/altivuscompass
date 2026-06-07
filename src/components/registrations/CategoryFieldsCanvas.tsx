import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CategoryField,
  CategoryFieldSchema,
  FIELD_TYPE_LABELS,
  FieldType,
  ensureUniqueKey,
  getEffectiveSpan,
  slugify,
  spanClass,
} from "@/lib/category-schema";
import { GripVertical, Settings2, Trash2 } from "lucide-react";
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
  fields: CategoryFieldSchema;
  onChange: (next: CategoryFieldSchema) => void;
}

/**
 * Editor visual WYSIWYG dos campos de uma categoria.
 * - Grid responsivo de 12 colunas (mobile empilha)
 * - Arraste = reordenar; alça direita = redimensionar (snap em colunas)
 * - Clique no card abre painel lateral com propriedades
 */
export function CategoryFieldsCanvas({ fields, onChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateField = (idx: number, patch: Partial<CategoryField>) =>
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const remove = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.key === active.id);
    const to = fields.findIndex((f) => f.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(fields, from, to));
    setEditingIdx(to);
  };

  if (fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
        Nenhum campo definido. Aplique um modelo ou adicione manualmente.
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.key)} strategy={rectSortingStrategy}>
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
                onClick={() => setEditingIdx(idx)}
                onResize={(span) => updateField(idx, { span, width: undefined })}
                gridRef={gridRef}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-[11px] text-muted-foreground mt-2">
        Dica: arraste a alça <strong>azul à direita</strong> do card para redimensionar (1–12 colunas).
        Em mobile, todos os campos ficam empilhados em largura total.
      </p>

      {editingIdx !== null && fields[editingIdx] && (
        <FieldPropertiesSheet
          field={fields[editingIdx]}
          takenKeys={fields.map((f, i) => (i === editingIdx ? "__self__" : f.key))}
          onChange={(patch) => updateField(editingIdx, patch)}
          onRemove={() => remove(editingIdx)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </>
  );
}

/* =================== Sortable card =================== */

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

  const [resizing, setResizing] = useState(false);
  const [previewSpan, setPreviewSpan] = useState<number | null>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const padding = 24; // p-3 = 12px each side
    const gapPx = 8;
    const inner = gridRect.width - padding;
    const colWidth = (inner - gapPx * 11) / 12;
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

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar"
          onPointerDown={onResizePointerDown}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-1.5 cursor-col-resize rounded-r-md transition-colors touch-none",
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
  field: CategoryField;
  takenKeys: string[];
  onChange: (patch: Partial<CategoryField>) => void;
  onRemove: () => void;
  onClose: () => void;
}

function FieldPropertiesSheet({ field, takenKeys, onChange, onRemove, onClose }: SheetProps) {
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
    <Sheet open onOpenChange={(v) => !v && onClose()}>
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
              No mobile, todos os campos ocupam 100% da largura.
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
