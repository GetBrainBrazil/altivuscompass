import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Package, Pencil } from "lucide-react";
import { ProductSearchDialog } from "./ProductSearchDialog";
import { cn } from "@/lib/utils";

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

type DiscMode = "amount" | "percent";

function itemDiscountValue(it: any): number {
  const subtotal = Number(it.unit_price ?? 0) * Number(it.quantity ?? 1);
  const pct = Number(it.discount_percent ?? 0);
  const amt = Number(it.discount_amount ?? 0);
  if (pct > 0) return (subtotal * pct) / 100;
  return amt;
}

function itemTotal(it: any): number {
  const subtotal = Number(it.unit_price ?? 0) * Number(it.quantity ?? 1);
  return Math.max(0, subtotal - itemDiscountValue(it));
}

export function QuoteModularItemsList({ quoteId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: quote } = useQuery({
    queryKey: ["quote-discount-cfg", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, discounts_enabled, discount_amount, discount_percent")
        .eq("id", quoteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["quote-modular-items", quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_items")
        .select(
          "id, title, description, item_type, unit_price, quantity, discount_amount, discount_percent, sort_order, product_id, products(category_id, product_categories:category_id(name))"
        )
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

  const discountsEnabled = !!quote?.discounts_enabled;

  async function toggleDiscounts(on: boolean) {
    await supabase.from("quotes").update({ discounts_enabled: on }).eq("id", quoteId!);
    qc.invalidateQueries({ queryKey: ["quote-discount-cfg", quoteId] });
  }

  // Subtotals
  const itemsSubtotal = items.reduce(
    (acc: number, it: any) => acc + Number(it.unit_price ?? 0) * Number(it.quantity ?? 1),
    0
  );
  const itemsDiscountSum = discountsEnabled
    ? items.reduce((acc: number, it: any) => acc + itemDiscountValue(it), 0)
    : 0;
  const afterItemDiscount = itemsSubtotal - itemsDiscountSum;
  const quoteDiscountValue = (() => {
    if (!discountsEnabled) return 0;
    const pct = Number(quote?.discount_percent ?? 0);
    const amt = Number(quote?.discount_amount ?? 0);
    if (pct > 0) return (afterItemDiscount * pct) / 100;
    return amt;
  })();
  const grandTotal = Math.max(0, afterItemDiscount - quoteDiscountValue);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-sm font-semibold">Itens da cotação</h3>
          <p className="text-xs text-muted-foreground">
            Edite valores e detalhes diretamente na lista. Use o botão para adicionar produtos do
            catálogo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Switch
              id="quote-discounts-toggle"
              checked={discountsEnabled}
              onCheckedChange={toggleDiscounts}
              className="scale-75 origin-right"
            />
            <Label htmlFor="quote-discounts-toggle" className="text-[11px] cursor-pointer">
              Descontos
            </Label>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setPickerOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar item
          </Button>
        </div>
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
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Item</TableHead>
                <TableHead className="min-w-[200px]">Detalhes</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="text-right w-[140px]">Preço un.</TableHead>
                <TableHead className="text-right w-[80px]">Qtd</TableHead>
                {discountsEnabled && (
                  <TableHead className="text-right w-[180px]">Desconto</TableHead>
                )}
                <TableHead className="text-right w-[120px]">Total</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  discountsEnabled={discountsEnabled}
                  onEdit={() => navigate(`/quotes/${quoteId}/items/${it.id}`)}
                  onChanged={() => refetch()}
                />
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-xs text-muted-foreground">
                  Total da cotação
                </TableCell>
                <TableCell colSpan={discountsEnabled ? 2 : 2} className="text-right text-xs text-muted-foreground">
                  Subtotal {fmtBRL(itemsSubtotal)}
                </TableCell>
                {discountsEnabled && (
                  <TableCell className="text-right">
                    <QuoteDiscountInput
                      quoteId={quoteId}
                      amount={Number(quote?.discount_amount ?? 0)}
                      percent={Number(quote?.discount_percent ?? 0)}
                      onChanged={() =>
                        qc.invalidateQueries({ queryKey: ["quote-discount-cfg", quoteId] })
                      }
                    />
                  </TableCell>
                )}
                <TableCell className="text-right font-semibold">{fmtBRL(grandTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
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

/* ----------------- ItemRow ----------------- */
function useDebouncedSave<T>(value: T, save: (v: T) => Promise<void>, delay = 600) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      save(value).catch(() => {});
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

interface ItemRowProps {
  item: any;
  discountsEnabled: boolean;
  onEdit: () => void;
  onChanged: () => void;
}

function ItemRow({ item, discountsEnabled, onEdit, onChanged }: ItemRowProps) {
  const [description, setDescription] = useState<string>(item.description ?? "");
  const [unitPrice, setUnitPrice] = useState<number>(Number(item.unit_price ?? 0));
  const [quantity, setQuantity] = useState<number>(Number(item.quantity ?? 1));
  const [discMode, setDiscMode] = useState<DiscMode>(
    Number(item.discount_percent ?? 0) > 0 ? "percent" : "amount"
  );
  const [discAmount, setDiscAmount] = useState<number>(Number(item.discount_amount ?? 0));
  const [discPercent, setDiscPercent] = useState<number>(Number(item.discount_percent ?? 0));

  // Sync from server when item changes externally
  useEffect(() => {
    setDescription(item.description ?? "");
    setUnitPrice(Number(item.unit_price ?? 0));
    setQuantity(Number(item.quantity ?? 1));
    setDiscAmount(Number(item.discount_amount ?? 0));
    setDiscPercent(Number(item.discount_percent ?? 0));
    setDiscMode(Number(item.discount_percent ?? 0) > 0 ? "percent" : "amount");
  }, [item.id]);

  async function save(patch: Record<string, any>) {
    await supabase.from("quote_items").update(patch).eq("id", item.id);
    onChanged();
  }

  useDebouncedSave(description, (v) => save({ description: v }));
  useDebouncedSave(unitPrice, (v) => save({ unit_price: v }));
  useDebouncedSave(quantity, (v) => save({ quantity: v }));
  useDebouncedSave(discAmount, (v) =>
    save({ discount_amount: discMode === "amount" ? v : 0 })
  );
  useDebouncedSave(discPercent, (v) =>
    save({ discount_percent: discMode === "percent" ? v : 0 })
  );

  const subtotal = unitPrice * (quantity || 0);
  const itemDisc = discountsEnabled
    ? (discMode === "percent" ? (subtotal * (discPercent || 0)) / 100 : discAmount || 0)
    : 0;
  const total = Math.max(0, subtotal - itemDisc);

  const categoryName =
    item.products?.product_categories?.name ?? ITEM_TYPE_LABEL[item.item_type] ?? item.item_type;

  return (
    <TableRow>
      <TableCell className="font-medium align-top">
        <button
          type="button"
          onClick={onEdit}
          className="text-left hover:underline underline-offset-2"
        >
          {item.title || "(sem título)"}
        </button>
        <div className="md:hidden text-[10px] text-muted-foreground mt-0.5">{categoryName}</div>
      </TableCell>
      <TableCell className="align-top">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Adicione detalhes..."
          className="h-8 text-xs"
        />
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground align-top">
        {categoryName}
      </TableCell>
      <TableCell className="text-right align-top">
        <CurrencyInput
          value={unitPrice}
          onChange={(v) => setUnitPrice(v ?? 0)}
          className="h-8 text-xs"
          prefix=""
        />
      </TableCell>
      <TableCell className="text-right align-top">
        <Input
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value) || 1)}
          className="h-8 text-xs text-right tabular-nums"
        />
      </TableCell>
      {discountsEnabled && (
        <TableCell className="text-right align-top">
          <DiscountField
            mode={discMode}
            amount={discAmount}
            percent={discPercent}
            onModeChange={(m) => {
              setDiscMode(m);
              if (m === "amount") setDiscPercent(0);
              else setDiscAmount(0);
            }}
            onAmountChange={setDiscAmount}
            onPercentChange={setDiscPercent}
          />
        </TableCell>
      )}
      <TableCell className="text-right text-xs font-medium align-top tabular-nums">
        {fmtBRL(total)}
      </TableCell>
      <TableCell className="align-top">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Editar item">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

/* ----------------- DiscountField ----------------- */
interface DiscountFieldProps {
  mode: DiscMode;
  amount: number;
  percent: number;
  onModeChange: (m: DiscMode) => void;
  onAmountChange: (v: number) => void;
  onPercentChange: (v: number) => void;
}

function DiscountField({
  mode,
  amount,
  percent,
  onModeChange,
  onAmountChange,
  onPercentChange,
}: DiscountFieldProps) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className="inline-flex rounded-md border border-input overflow-hidden text-[11px] font-medium shrink-0">
        <button
          type="button"
          onClick={() => onModeChange("amount")}
          className={cn(
            "px-2.5 h-7 min-w-[34px] flex items-center justify-center transition-colors",
            mode === "amount"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/40 hover:bg-muted"
          )}
        >
          R$
        </button>
        <button
          type="button"
          onClick={() => onModeChange("percent")}
          className={cn(
            "px-2.5 h-7 min-w-[34px] flex items-center justify-center transition-colors border-l border-input",
            mode === "percent"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/40 hover:bg-muted"
          )}
        >
          %
        </button>
      </div>
      {mode === "amount" ? (
        <CurrencyInput
          value={amount}
          onChange={(v) => onAmountChange(v ?? 0)}
          className="h-7 text-xs w-[110px]"
          prefix=""
        />
      ) : (
        <Input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={percent || ""}
          onChange={(e) => onPercentChange(Number(e.target.value) || 0)}
          placeholder="0"
          className="h-7 text-xs w-[80px] text-right tabular-nums"
        />
      )}
    </div>
  );
}

/* ----------------- QuoteDiscountInput ----------------- */
interface QuoteDiscountInputProps {
  quoteId: string;
  amount: number;
  percent: number;
  onChanged: () => void;
}

function QuoteDiscountInput({ quoteId, amount, percent, onChanged }: QuoteDiscountInputProps) {
  const [mode, setMode] = useState<DiscMode>(percent > 0 ? "percent" : "amount");
  const [amt, setAmt] = useState(amount);
  const [pct, setPct] = useState(percent);

  useEffect(() => {
    setAmt(amount);
    setPct(percent);
    setMode(percent > 0 ? "percent" : "amount");
  }, [amount, percent]);

  async function persist(next: { discount_amount?: number; discount_percent?: number }) {
    await supabase.from("quotes").update(next).eq("id", quoteId);
    onChanged();
  }

  useDebouncedSave(amt, (v) =>
    persist({ discount_amount: mode === "amount" ? v : 0 })
  );
  useDebouncedSave(pct, (v) =>
    persist({ discount_percent: mode === "percent" ? v : 0 })
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[10px] text-muted-foreground">Desconto geral</span>
      <DiscountField
        mode={mode}
        amount={amt}
        percent={pct}
        onModeChange={(m) => {
          setMode(m);
          if (m === "amount") {
            setPct(0);
            persist({ discount_percent: 0 });
          } else {
            setAmt(0);
            persist({ discount_amount: 0 });
          }
        }}
        onAmountChange={setAmt}
        onPercentChange={setPct}
      />
    </div>
  );
}
