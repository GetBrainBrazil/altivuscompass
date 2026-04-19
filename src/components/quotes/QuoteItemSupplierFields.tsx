import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  supplierId: string | null;
  paymentSource: string | null;
  commissionAmount: number;
  commissionStatus: string;
  onChange: (patch: {
    supplierId?: string | null;
    paymentSource?: string | null;
    commissionAmount?: number;
    commissionStatus?: string;
  }) => void;
}

const PAYMENT_SOURCES: Array<{ value: string; label: string }> = [
  { value: "miles", label: "Milhas" },
  { value: "cash", label: "Dinheiro" },
  { value: "consolidator", label: "Consolidadora" },
  { value: "operator", label: "Operadora" },
  { value: "other", label: "Outro" },
];

const COMMISSION_STATUSES: Array<{ value: string; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "received", label: "Recebida" },
  { value: "not_applicable", label: "Não aplicável" },
];

const NULL_VALUE = "__none__";

export default function QuoteItemSupplierFields({
  supplierId,
  paymentSource,
  commissionAmount,
  commissionStatus,
  onChange,
}: Props) {
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const showCommission = paymentSource === "operator" || paymentSource === "consolidator";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Fornecedor</Label>
          <Select
            value={supplierId ?? NULL_VALUE}
            onValueChange={(v) => onChange({ supplierId: v === NULL_VALUE ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NULL_VALUE}>Nenhum</SelectItem>
              {suppliers.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Forma de aquisição</Label>
          <Select
            value={paymentSource ?? NULL_VALUE}
            onValueChange={(v) => onChange({ paymentSource: v === NULL_VALUE ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Não definido" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NULL_VALUE}>Não definido</SelectItem>
              {PAYMENT_SOURCES.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showCommission && (
          <>
            <div className="space-y-0.5">
              <Label className="text-[11px] font-body">Comissão (R$)</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  R$
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={commissionAmount ?? 0}
                  onChange={(e) => onChange({ commissionAmount: Number(e.target.value) || 0 })}
                  className="h-8 text-xs pl-7"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px] font-body">Status da comissão</Label>
              <Select
                value={commissionStatus || "pending"}
                onValueChange={(v) => onChange({ commissionStatus: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMISSION_STATUSES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
