import { supabase } from "@/integrations/supabase/client";
import type { KanbanCardData } from "@/components/crm/KanbanCard";

export type OpsColumnId = "pre-trip" | "in-trip" | "support" | "post-trip";

export type OpsCardRow = {
  id: string;
  contact_id: string | null;
  client_id: string | null;
  quote_id: string | null;
  deal_id: string | null;
  column_id: OpsColumnId;
  sort_order: number;
  client_name: string;
  destination: string | null;
  travel_date: string | null;
  travel_date_iso: string | null;
  agent_user_id: string | null;
  agent_name: string | null;
  agent_avatar: string | null;
  tags: KanbanCardData["tags"] | null;
  is_manual_lead: boolean;
  stage_entered_at: string;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANUAL_OPS_PREFIX = /^manual-ops-/;

/** Extract a uuid from a manual-ops-<uuid> id, or null. */
export function extractCardUuid(cardId: string): string | null {
  const stripped = cardId.replace(MANUAL_OPS_PREFIX, "");
  return UUID_RE.test(stripped) ? stripped : null;
}

/** Parse DD/MM/YYYY -> YYYY-MM-DD. Returns null if unparseable. */
export function parseBrDateToIso(value?: string | null): string | null {
  if (!value) return null;
  // already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

/** Format YYYY-MM-DD -> DD/MM/YYYY for UI parity. */
export function formatIsoToBr(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function rowToCard(row: OpsCardRow): KanbanCardData {
  const card: KanbanCardData = {
    id: `manual-ops-${row.id}`,
    clientName: row.client_name,
    destination: row.destination ?? undefined,
    travelDate: row.travel_date ?? formatIsoToBr(row.travel_date_iso),
    travelDateISO: row.travel_date_iso ?? undefined,
    contactLevel: "cliente",
    isManualLead: row.is_manual_lead,
    stageEnteredAt: row.stage_entered_at,
    tags: Array.isArray(row.tags) ? row.tags : undefined,
  };
  if (row.agent_user_id || row.agent_name) {
    card.agent = {
      id: row.agent_user_id ?? undefined,
      name: row.agent_name ?? "—",
      avatarUrl: row.agent_avatar ?? undefined,
    };
  }
  return card;
}

export type OpsCardWritable = Omit<Partial<OpsCardRow>, "id" | "created_at" | "updated_at">;

export function cardToRow(
  card: KanbanCardData,
  columnId: OpsColumnId,
  sortOrder: number,
): OpsCardWritable & { id: string } {
  const id = extractCardUuid(card.id) ?? crypto.randomUUID();
  const iso =
    card.travelDateISO ??
    parseBrDateToIso(card.travelDate) ??
    null;
  return {
    id,
    column_id: columnId,
    sort_order: sortOrder,
    client_name: card.clientName,
    destination: card.destination ?? null,
    travel_date: card.travelDate ?? null,
    travel_date_iso: iso,
    agent_user_id: card.agent?.id ?? null,
    agent_name: card.agent?.name ?? null,
    agent_avatar: card.agent?.avatarUrl ?? null,
    tags: (card.tags ?? []) as any,
    is_manual_lead: !!card.isManualLead,
    stage_entered_at: card.stageEnteredAt ?? new Date().toISOString(),
  };
}

export async function fetchActiveOpsCards(): Promise<OpsCardRow[]> {
  const { data, error } = await supabase
    .from("ops_cards")
    .select("*")
    .is("archived_at", null)
    .order("column_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as OpsCardRow[];
}

export async function upsertOpsCard(row: OpsCardWritable & { id: string }) {
  const { error } = await supabase.from("ops_cards").upsert(row as any, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteOpsCard(id: string) {
  const { error } = await supabase.from("ops_cards").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkPersistColumns(
  columns: { id: OpsColumnId; cards: KanbanCardData[] }[],
): Promise<void> {
  const rows: (OpsCardWritable & { id: string })[] = [];
  const keepIds = new Set<string>();
  for (const col of columns) {
    col.cards.forEach((card, idx) => {
      if (!card.id.startsWith("manual-ops-")) return;
      const row = cardToRow(card, col.id, idx);
      rows.push(row);
      keepIds.add(row.id);
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("ops_cards").upsert(rows as any, { onConflict: "id" });
    if (error) throw error;
  }

  // Sync deletes: linhas ativas no banco que não estão mais no estado React → archive (não delete físico).
  const { data: live } = await supabase
    .from("ops_cards")
    .select("id")
    .is("archived_at", null);
  const liveIds = (live || []).map((r: any) => r.id as string);
  const toArchive = liveIds.filter((id) => !keepIds.has(id));
  if (toArchive.length > 0) {
    await supabase
      .from("ops_cards")
      .update({ archived_at: new Date().toISOString() })
      .in("id", toArchive);
  }
}

