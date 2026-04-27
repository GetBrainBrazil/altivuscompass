// Shared formatter helpers for structured hotel items in quotes.

export const ACCOMMODATION_TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel",
  resort: "Resort",
  pousada: "Pousada",
  hostel: "Hostel",
  apart_hotel: "Apart-Hotel / Flat",
  apartment: "Apartamento (temporada)",
  house: "Casa / Vila",
  chalet: "Chalé / Cabana",
  boat: "Barco / Cruzeiro fluvial",
  other: "Outro",
};

export const MEAL_PLAN_LABELS: Record<string, string> = {
  none: "Sem refeições",
  breakfast: "Café da manhã",
  half_board: "Meia pensão",
  full_board: "Pensão completa",
  all_inclusive: "All Inclusive",
  all_inclusive_premium: "All Inclusive Premium",
};

export function getAccommodationTypeLabel(value?: string | null): string | null {
  if (!value) return null;
  return ACCOMMODATION_TYPE_LABELS[value] ?? value;
}

export function getMealPlanLabel(value?: string | null): string | null {
  if (!value) return null;
  return MEAL_PLAN_LABELS[value] ?? value;
}

/**
 * Parses a YYYY-MM-DD string and returns DD/MM/YYYY without timezone shifts.
 * Returns empty string for falsy/invalid input.
 */
export function formatHotelDateBR(value?: string | null): string {
  if (!value) return "";
  const s = String(value).slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}
