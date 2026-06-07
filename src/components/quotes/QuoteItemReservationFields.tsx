import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getItemTypeConfig, type ItemTypeKey } from "@/lib/item-types";

interface Props {
  itemType: string | null | undefined;
  details: Record<string, any> | null | undefined;
  onChange: (patch: Record<string, any>) => void;
}

/**
 * Etapa 6 — campos de reserva (dados de confirmação pós-fechamento) por tipo.
 * Persiste em quote_items.details (JSONB). Não cria coluna nova.
 * Renderiza apenas se o tipo tiver campos configurados em src/lib/item-types.ts.
 */
export function QuoteItemReservationFields({ itemType, details, onChange }: Props) {
  const cfg = getItemTypeConfig(itemType as ItemTypeKey);
  if (!cfg || cfg.reservationFields.length === 0) return null;
  const d = details ?? {};

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Dados de reserva — {cfg.label}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cfg.reservationFields.map((f) => (
          <div key={f.key} className="space-y-0.5">
            <Label className="text-[11px] font-body">{f.label}</Label>
            <Input
              type={f.type ?? "text"}
              value={d[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) =>
                onChange({ ...d, [f.key]: e.target.value || null })
              }
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
