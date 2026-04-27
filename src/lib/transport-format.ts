// Shared formatter for structured transport items in quotes.
// Generates a clean human-readable line for both internal and public views.

const TRANSPORT_TYPE_LABELS: Record<string, string> = {
  car: "Carro",
  van: "Van",
  private_driver: "Motorista Particular",
  hotel_airport_transfer: "Transfer Hotel-Aeroporto",
  train: "Trem",
  bus: "Ônibus",
};

const VEHICLE_CATEGORY_LABELS: Record<string, string> = {
  compact: "Compacto",
  sedan: "Sedan",
  suv: "SUV",
  minivan: "Minivan",
};

const TRANSMISSION_LABELS: Record<string, string> = {
  automatic: "Automático",
  manual: "Manual",
};

const INCLUSION_LABELS: Record<string, string> = {
  unlimited_km: "Km livre",
  additional_driver: "Motorista adicional",
  basic_insurance: "Seguro básico",
  gps: "GPS",
  child_seat: "Cadeirinha infantil",
};

function fmtDateShort(value?: string | null): string | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return null;
  return `${d}/${m}`;
}

export interface TransportFormatted {
  /** Main label, e.g. "Carro Sedan (Manual)" or "Transfer Hotel-Aeroporto" */
  vehicleLabel: string;
  /** Inclusions joined: "Km livre / Motorista adicional / Seguro básico" */
  inclusionsLabel: string | null;
  /** Dates formatted: "Retirada: 09/05 · Devolução: 15/05" */
  datesLabel: string | null;
  /** Single line combining everything separated by " — " */
  fullLine: string;
}

export function formatTransportDetails(details: any): TransportFormatted | null {
  const d = details || {};
  const type = d.transport_type ? TRANSPORT_TYPE_LABELS[d.transport_type] || d.transport_type : "";
  if (!type && !d.vehicle_category && !d.pickup_date && !d.dropoff_date && !(Array.isArray(d.inclusions) && d.inclusions.length)) {
    return null;
  }

  const parts: string[] = [];
  if (type) parts.push(type);
  if (d.vehicle_category && VEHICLE_CATEGORY_LABELS[d.vehicle_category]) {
    parts.push(VEHICLE_CATEGORY_LABELS[d.vehicle_category]);
  }
  let vehicleLabel = parts.join(" ").trim();
  if (d.transmission && TRANSMISSION_LABELS[d.transmission]) {
    vehicleLabel = `${vehicleLabel} (${TRANSMISSION_LABELS[d.transmission]})`.trim();
  }

  const incs = Array.isArray(d.inclusions) ? d.inclusions : [];
  const incLabels = incs.map((k: string) => INCLUSION_LABELS[k] || k).filter(Boolean);
  const inclusionsLabel = incLabels.length > 0 ? `${incLabels.join(" / ")} incluído` : null;

  const pickup = fmtDateShort(d.pickup_date);
  const dropoff = fmtDateShort(d.dropoff_date);
  let datesLabel: string | null = null;
  if (pickup && dropoff) datesLabel = `Retirada: ${pickup} · Devolução: ${dropoff}`;
  else if (pickup) datesLabel = `Retirada: ${pickup}`;
  else if (dropoff) datesLabel = `Devolução: ${dropoff}`;

  const fullLine = [vehicleLabel, inclusionsLabel, datesLabel].filter(Boolean).join(" — ");

  return { vehicleLabel, inclusionsLabel, datesLabel, fullLine };
}
