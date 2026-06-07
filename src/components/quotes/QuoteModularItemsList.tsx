import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package } from "lucide-react";
import { ProductSearchDialog } from "./ProductSearchDialog";

interface Props {
  quoteId: string | null | undefined;
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  flight: "Voo",
  hotel: "Hospedagem",
  transport: "Transporte",
  cruise: "Cruzeiro",
  experience: "Experiência",
  insurance: "Seguro",
  other_service: "Outro",
};

function fmtBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function QuoteModularItemsList({ quoteId }: Props) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["quote-modular-items", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select("id, title, item_type, unit_price, quantity, sort_order, product_id, products(category_id, product_categories:category_id(name))")
        .eq("quote_id", quoteId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!quoteId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Package className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
        <p className="text-sm text-muted-foreground">
          Salve a cotação primeiro para adicionar itens modulares.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold">Itens da cotação</h3>
          <p className="text-xs text-muted-foreground">
            Construa a cotação adicionando produtos do catálogo. Os campos de cada item seguem o
            modelo definido na categoria.
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setPickerOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Adicionar item
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          Carregando itens...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-2">
          <Package className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Nenhum item adicionado ainda.</p>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setPickerOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar primeiro item
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço un.</TableHead>
                <TableHead className="text-right w-16">Qtd</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any) => {
                const total = Number(it.unit_price ?? 0) * Number(it.quantity ?? 1);
                const categoryName =
                  it.products?.product_categories?.name ?? ITEM_TYPE_LABEL[it.item_type] ?? it.item_type;
                return (
                  <TableRow
                    key={it.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/quotes/${quoteId}/items/${it.id}`)}
                  >
                    <TableCell className="font-medium">{it.title || "(sem título)"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{categoryName}</TableCell>
                    <TableCell className="text-right text-xs">{fmtBRL(it.unit_price)}</TableCell>
                    <TableCell className="text-right text-xs">{it.quantity ?? 1}</TableCell>
                    <TableCell className="text-right text-xs font-medium">{fmtBRL(total)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductSearchDialog
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) refetch();
        }}
        quoteId={quoteId}
      />
    </div>
  );
}
