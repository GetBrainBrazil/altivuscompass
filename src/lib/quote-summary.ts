/**
 * Pure helpers to build a WhatsApp-friendly summary of a quote.
 * No side effects. Never includes sensitive/internal fields
 * (unit_cost, supplier_id, commission_amount, payment_source,
 * internal_notes, close_probability, internal_due_date).
 */

type AnyQuote = Record<string, any>;
type AnyItem = Record<string, any>;
type AnyClient = Record<string, any>;

const TYPE_ORDER = [
  "flight",
  "hotel",
  "transport",
  "cruise",
  "experience",
  "insurance",
  "other_service",
];

const TYPE_HEADERS: Record<string, string> = {
  flight: "✈️ Voos",
  hotel: "🏨 Hospedagem",
  transport: "🚗 Transporte",
  cruise: "🚢 Cruzeiro",
  experience: "🎭 Experiências",
  insurance: "🛡️ Seguro",
  other_service: "🧳 Outros serviços",
};

const MAX_LEN = 1500;
const MAX_ITEM_TEXT = 60;

function fmtBRL(value: number | null | undefined): string | null {
  if (value === null || value === undefined || isNaN(Number(value))) return null;
  const n = Number(value);
  if (n <= 0) return null;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function fmtDateBR(iso?: string | null): string | null {
  if (!iso) return null;
  // Expect "YYYY-MM-DD" or ISO string
  const onlyDate = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const parts = onlyDate.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

function diffDays(startISO?: string | null, endISO?: string | null): number | null {
  if (!startISO || !endISO) return null;
  const s = new Date(startISO.slice(0, 10));
  const e = new Date(endISO.slice(0, 10));
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function truncate(text: string, max = MAX_ITEM_TEXT): string {
  const clean = (text || "").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

function isExpired(quote_validity?: string | null): boolean {
  if (!quote_validity) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const v = new Date(quote_validity.slice(0, 10));
  if (isNaN(v.getTime())) return false;
  return v.getTime() < today.getTime();
}

function buildItemLine(item: AnyItem): string | null {
  const titleOrDesc = (item.title || item.description || "").trim();
  if (!titleOrDesc) return null;
  const safeText = truncate(titleOrDesc);
  const price = fmtBRL(item.unit_price);
  const qty = Number(item.quantity ?? 0);
  const optionPrefix = item.option_label ? `${item.option_label}: ` : "";

  let line = `• ${optionPrefix}${safeText}`;
  if (price) line += ` | ${price}`;
  if (qty > 1) {
    const unitWord = item.item_type === "hotel" ? "noites" : "un";
    line += ` x ${qty} ${unitWord}`;
  }
  return line;
}

export interface QuoteSummaryOptions {
  /** Public URL base (defaults to window.location.origin if available) */
  origin?: string;
}

export function buildQuoteSummary(
  quote: AnyQuote,
  items: AnyItem[],
  passengers: any[] = [],
  clients: AnyClient[] = [],
  options: QuoteSummaryOptions = {},
): string {
  const lines: string[] = [];

  const title = (quote.title || quote.destination || "Cotação de viagem").trim();
  lines.push(`✈️ *${title}*`);

  if (quote.destination && quote.destination !== quote.title) {
    lines.push(`📍 Destino: ${quote.destination}`);
  }

  const startBR = fmtDateBR(quote.travel_date_start);
  const endBR = fmtDateBR(quote.travel_date_end);
  const days = diffDays(quote.travel_date_start, quote.travel_date_end);
  if (startBR && endBR) {
    lines.push(`📅 ${startBR} a ${endBR}${days ? ` (${days} dias)` : ""}`);
  } else if (startBR) {
    lines.push(`📅 ${startBR}`);
  }

  const paxCount = Array.isArray(passengers) ? passengers.length : 0;
  if (paxCount > 0) {
    lines.push(`👥 ${paxCount} ${paxCount === 1 ? "passageiro" : "passageiros"}`);
  }

  // Group items by type
  const byType = new Map<string, AnyItem[]>();
  for (const it of items || []) {
    if (!it) continue;
    const t = (it.item_type as string) || "other_service";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(it);
  }

  for (const t of TYPE_ORDER) {
    const list = byType.get(t);
    if (!list || list.length === 0) continue;
    // Sort: option_order then sort_order
    const sorted = [...list].sort((a, b) => {
      const ao = a.option_order ?? 999;
      const bo = b.option_order ?? 999;
      if (ao !== bo) return ao - bo;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    const itemLines = sorted.map(buildItemLine).filter(Boolean) as string[];
    if (itemLines.length === 0) continue;
    lines.push(""); // blank separator
    lines.push(TYPE_HEADERS[t] || t);
    lines.push(...itemLines);
  }

  const totalBR = fmtBRL(quote.total_value);
  if (totalBR) {
    lines.push("");
    lines.push(`💰 *Valor total: ${totalBR}*`);
  }

  // Public link
  const origin =
    options.origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  if (origin && quote.id) {
    lines.push("");
    lines.push(`📋 Ver proposta completa: ${origin}/quote/${quote.id}`);
  }

  // Validity / expiration
  if (quote.quote_validity) {
    if (isExpired(quote.quote_validity)) {
      lines.push("");
      lines.push("⚠️ Esta cotação expirou");
    } else {
      const validBR = fmtDateBR(quote.quote_validity);
      if (validBR) {
        lines.push("");
        lines.push(`⏰ Válida até ${validBR}`);
      }
    }
  }

  let result = lines.join("\n").trim();

  // Hard cap to keep WhatsApp messages compact
  if (result.length > MAX_LEN) {
    result = result.slice(0, MAX_LEN - 1).trimEnd() + "…";
  }

  return result;
}

/**
 * Returns the client phone digits ready for wa.me (with country code 55).
 * Returns null if no usable phone is found.
 */
export function pickClientWhatsappNumber(
  quote: AnyQuote,
  clients: AnyClient[] = [],
): string | null {
  const candidates: (string | null | undefined)[] = [];
  // From joined client object on the quote, if present
  candidates.push(quote?.clients?.phone);
  candidates.push(quote?.clients?.full_phone);
  // From clients list lookup
  if (quote?.client_id && Array.isArray(clients)) {
    const c = clients.find((x: any) => x?.id === quote.client_id);
    candidates.push(c?.phone);
    candidates.push(c?.full_phone);
  }
  for (const raw of candidates) {
    if (!raw) continue;
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length < 10) continue;
    // Ensure it starts with country code 55
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    return `55${digits}`;
  }
  return null;
}
