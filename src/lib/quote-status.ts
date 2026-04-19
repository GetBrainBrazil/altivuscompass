/**
 * Pure helpers to classify quote-related visual states (deadline, age, validity).
 *
 * These mirror the inline logic currently used inside Quotes.tsx. They live in a
 * separate module so they can be unit-tested without rendering the page. The
 * inline UI may continue to compute its own values until a future refactor
 * swaps it to import from here.
 */

export type Tone = "none" | "yellow" | "orange" | "red";

const CLOSED_STAGES = new Set(["confirmed", "completed", "lost", "canceled"]);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const onlyDate = iso.length >= 10 ? iso.slice(0, 10) : iso;
  const d = new Date(`${onlyDate}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(target: Date, ref: Date): number {
  const ms = startOfDay(target).getTime() - startOfDay(ref).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Internal due date tone:
 * - none: missing date or quote already closed or due > 3 days away
 * - yellow: 2-3 days away
 * - orange: due today (0-1 day)
 * - red: overdue (< 0)
 */
export function getDeadlineTone(
  dueDate: string | null | undefined,
  stage: string | null | undefined,
): Tone {
  if (!dueDate) return "none";
  if (stage && CLOSED_STAGES.has(stage)) return "none";
  const d = parseDateOnly(dueDate);
  if (!d) return "none";
  const days = diffDays(d, new Date());
  if (days < 0) return "red";
  if (days <= 1) return "orange";
  if (days <= 3) return "yellow";
  return "none";
}

/**
 * Age tone (how long since the quote was created and not yet closed):
 * - none: < 3 days or already closed
 * - yellow: 3-7 days
 * - red: > 7 days
 */
export function getAgeTone(
  createdAt: string | null | undefined,
  stage: string | null | undefined,
): "none" | "yellow" | "red" {
  if (!createdAt) return "none";
  if (stage && CLOSED_STAGES.has(stage)) return "none";
  const d = parseDateOnly(createdAt);
  if (!d) return "none";
  const ageDays = diffDays(new Date(), d);
  if (ageDays > 7) return "red";
  if (ageDays >= 3) return "yellow";
  return "none";
}

export interface ValidityBadge {
  label: string;
  tone: Tone;
}

/**
 * Validity badge for a quote:
 * - null: no validity, already closed, or expires in more than 1 day
 * - "Expira amanhã" (yellow) when validity is exactly tomorrow
 * - "Expira hoje" (orange) when validity is today
 * - "Expirada" (red) when validity is in the past
 */
export function getValidityBadge(
  quoteValidity: string | null | undefined,
  stage: string | null | undefined,
): ValidityBadge | null {
  if (!quoteValidity) return null;
  if (stage && CLOSED_STAGES.has(stage)) return null;
  const d = parseDateOnly(quoteValidity);
  if (!d) return null;
  const days = diffDays(d, new Date());
  if (days < 0) return { label: "Expirada", tone: "red" };
  if (days === 0) return { label: "Expira hoje", tone: "orange" };
  if (days === 1) return { label: "Expira amanhã", tone: "yellow" };
  return null;
}
