// Shared formatter for structured experience items in quotes.

const TICKET_TYPE_LABELS: Record<string, string> = {
  "1_day": "Ingresso 1 dia",
  "2_days": "Ingresso 2 dias",
  "3_days": "Ingresso 3 dias",
  weekly: "Ingresso Semanal",
  monthly: "Ingresso Mensal",
  seasonal: "Ingresso Temporada",
};

function fmtDateBR(value?: string | null): string | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

export interface ExperienceFormatted {
  ticketLabel: string | null;
  dateLabel: string | null;
  countLabel: string | null;
  /** Single line without the title (caller usually has the title separately) */
  detailsLine: string;
}

export function formatExperienceDetails(details: any): ExperienceFormatted | null {
  const d = details || {};
  const ticketLabel = d.ticket_type ? TICKET_TYPE_LABELS[d.ticket_type] || d.ticket_type : null;
  const dateBR = fmtDateBR(d.usage_date);
  const dateLabel = dateBR ? `Data: ${dateBR}${d.usage_time ? ` ${d.usage_time}` : ""}` : null;
  const count = Number(d.tickets_count ?? 0);
  const countLabel = count > 0 ? `${count} ${count === 1 ? "ingresso" : "ingressos"}` : null;

  if (!ticketLabel && !dateLabel && !countLabel) return null;

  const detailsLine = [ticketLabel, dateLabel, countLabel].filter(Boolean).join(" — ");
  return { ticketLabel, dateLabel, countLabel, detailsLine };
}
