import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Props {
  quantity: number;
  unitCost: number;
  unitPrice: number;
  onChange: (patch: { quantity?: number; unitCost?: number; unitPrice?: number }) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function QuoteItemCommercialFields({ quantity, unitCost, unitPrice, onChange }: Props) {
  const subtotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wide">
          Valores
        </Label>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Quantidade</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={quantity ?? 1}
            onChange={(e) => onChange({ quantity: Number(e.target.value) || 1 })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Custo unitário</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitCost ?? 0}
              onChange={(e) => onChange({ unitCost: Number(e.target.value) || 0 })}
              className="h-8 text-xs pl-7"
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Preço de venda unitário</Label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitPrice ?? 0}
              onChange={(e) => onChange({ unitPrice: Number(e.target.value) || 0 })}
              className="h-8 text-xs pl-7"
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Subtotal</Label>
          <div className="h-8 text-xs px-2.5 rounded-md border border-input bg-muted/40 flex items-center font-medium text-foreground">
            {formatCurrency(subtotal)}
          </div>
        </div>
      </div>
    </div>
  );
}
