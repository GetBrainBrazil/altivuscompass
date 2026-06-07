import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Trash2, Loader2, Package, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DynamicCategoryFields } from "@/components/quotes/DynamicCategoryFields";
import QuoteItemCommercialFields from "@/components/quotes/QuoteItemCommercialFields";
import QuoteItemAttachmentsV2 from "@/components/quotes/QuoteItemAttachmentsV2";
import { QuoteItemReservationFields } from "@/components/quotes/QuoteItemReservationFields";
import type { CategoryFieldSchema, CategoryField } from "@/lib/category-schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ItemRow = {
  id: string;
  quote_id: string;
  product_id: string | null;
  item_type: string;
  title: string | null;
  details: Record<string, any> | null;
  quantity: number | null;
  unit_cost: number | null;
  unit_price: number | null;
  utilization_start: string | null;
  utilization_end: string | null;
};

export default function QuoteItemEdit() {
  const { quoteId, itemId } = useParams<{ quoteId: string; itemId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["quote-item", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select(
          "id, quote_id, product_id, item_type, title, details, quantity, unit_cost, unit_price, utilization_start, utilization_end, products(id, name, category_id, product_categories:category_id(id, name, field_schema))"
        )
        .eq("id", itemId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [item, setItem] = useState<ItemRow | null>(null);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const lastSavedRef = useRef<string>("");

  const buildSnapshot = (it: ItemRow | null, d: Record<string, any>) =>
    JSON.stringify({
      title: it?.title ?? "",
      quantity: it?.quantity ?? null,
      unit_cost: it?.unit_cost ?? null,
      unit_price: it?.unit_price ?? null,
      utilization_start: it?.utilization_start ?? null,
      utilization_end: it?.utilization_end ?? null,
      details: d ?? {},
    });

  useEffect(() => {
    if (!data) return;
    const it = data as any as ItemRow;
    setItem(it);
    setDetails(it.details ?? {});
    lastSavedRef.current = buildSnapshot(it, it.details ?? {});
  }, [data]);

  const isDirty = item ? buildSnapshot(item, details) !== lastSavedRef.current : false;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const goBack = () => navigate(`/quotes?quoteId=${quoteId}&tab=modular`);
  const handleBackClick = () => {
    if (isDirty) setConfirmLeave(true);
    else goBack();
  };

  const category = (data as any)?.products?.product_categories ?? null;
  const productName = (data as any)?.products?.name ?? null;
  const schema: CategoryFieldSchema = useMemo(() => {
    const raw = category?.field_schema;
    return Array.isArray(raw) ? raw : [];
  }, [category]);

  const setField = (patch: Partial<ItemRow>) => {
    setItem((cur) => (cur ? { ...cur, ...patch } : cur));
  };

  const applyMappedColumns = (
    fullDetails: Record<string, any>
  ): Partial<ItemRow> => {
    const patch: Partial<ItemRow> = {};
    for (const f of schema) {
      if (!f.mapsTo) continue;
      const v = fullDetails[f.key];
      if (v === undefined) continue;
      if (f.mapsTo === "title" && typeof v === "string") patch.title = v;
      if (f.mapsTo === "utilization_start" && typeof v === "string") patch.utilization_start = v || null;
      if (f.mapsTo === "utilization_end" && typeof v === "string") patch.utilization_end = v || null;
    }
    return patch;
  };

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    const mapped = applyMappedColumns(details);
    const payload: any = {
      title: mapped.title ?? item.title,
      details,
      quantity: item.quantity ?? 1,
      unit_cost: item.unit_cost ?? 0,
      unit_price: item.unit_price ?? 0,
      utilization_start: mapped.utilization_start ?? item.utilization_start,
      utilization_end: mapped.utilization_end ?? item.utilization_end,
    };
    const { error } = await supabase.from("quote_items").update(payload).eq("id", item.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item salvo" });
    refetch();
  };

  const handleDelete = async () => {
    if (!item) return;
    const { error } = await supabase.from("quote_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item excluído" });
    navigate(`/quotes?quoteId=${quoteId}&tab=modular`);
  };

  if (isLoading || !item) {
    return (
      <div className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando item...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/quotes?quoteId=${quoteId}&tab=modular`)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para cotação
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir item
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Identidade */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {category?.name ?? item.item_type} {productName ? `· ${productName}` : "· Sem produto vinculado"}
          </span>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Título do item</Label>
          <Input
            value={item.title ?? ""}
            onChange={(e) => setField({ title: e.target.value })}
            placeholder="Ex.: GRU → CDG, Hotel Copacabana..."
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Campos dinâmicos */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="font-display text-sm font-semibold">
          Detalhes da categoria{category?.name ? ` · ${category.name}` : ""}
        </h3>
        <DynamicCategoryFields schema={schema} value={details} onChange={setDetails} />
      </div>

      {/* Comercial */}
      <div className="rounded-lg border bg-card p-4">
        <QuoteItemCommercialFields
          quantity={Number(item.quantity ?? 1)}
          unitCost={Number(item.unit_cost ?? 0)}
          unitPrice={Number(item.unit_price ?? 0)}
          onChange={(patch) =>
            setField({
              quantity: patch.quantity ?? item.quantity ?? 1,
              unit_cost: patch.unitCost ?? item.unit_cost ?? 0,
              unit_price: patch.unitPrice ?? item.unit_price ?? 0,
            } as any)
          }
        />
      </div>

      {/* Anexos */}
      <div className="rounded-lg border bg-card p-4">
        <QuoteItemAttachmentsV2
          quoteId={item.quote_id}
          itemId={item.id}
          itemType={item.item_type}
          locator={details?.localizador ?? null}
          isNew={false}
        />
      </div>

      {/* Reserva */}
      <div className="rounded-lg border bg-card p-4">
        <QuoteItemReservationFields
          itemType={item.item_type}
          details={details}
          onChange={(d) => setDetails(d)}
        />
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item da cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
