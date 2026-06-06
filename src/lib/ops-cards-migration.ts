import { supabase } from "@/integrations/supabase/client";
import type { KanbanCardData } from "@/components/crm/KanbanCard";
import {
  cardToRow,
  extractCardUuid,
  parseBrDateToIso,
  type OpsColumnId,
} from "./ops-cards-repo";

const LS_KEY = "crm:columns:ops:v4";
const LS_BACKUP_KEY = "crm:columns:ops:v4.backup";
const MIGRATED_FLAG = "crm:ops_migrated_at";
const MIGRATED_COUNT = "crm:ops_migrated_count";

type StoredColumn = { id: string; title?: string; cards: KanbanCardData[] };

export type MigrationResult = {
  ran: boolean;
  migratedCount: number;
  skippedCount: number;
  skippedIds: string[];
  unparsedDates: string[];
  alreadyMigrated: boolean;
};

const VALID_COLS: OpsColumnId[] = ["pre-trip", "in-trip", "support", "post-trip"];

/**
 * Importa cards do localStorage (crm:columns:ops:v4) para a tabela ops_cards.
 *
 * Garantias:
 *  - Idempotente: bloqueia re-execução via flag crm:ops_migrated_at.
 *  - Não destrutivo: copia o localStorage original para *.backup antes; nunca apaga o original.
 *  - Upsert visível: conflitos em (id) são registrados em ops_migration_log (skipped_ids).
 *  - travel_date_iso sempre preenchido quando possível; falhas vão para unparsed_dates.
 */
export async function migrateOpsCardsFromLocalStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    ran: false,
    migratedCount: 0,
    skippedCount: 0,
    skippedIds: [],
    unparsedDates: [],
    alreadyMigrated: false,
  };

  if (typeof window === "undefined") return result;

  // Idempotência
  if (localStorage.getItem(MIGRATED_FLAG)) {
    result.alreadyMigrated = true;
    return result;
  }

  // Lê payload
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LS_KEY);
  } catch {
    raw = null;
  }

  if (!raw) {
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
    localStorage.setItem(MIGRATED_COUNT, "0");
    return result;
  }

  let parsed: StoredColumn[];
  try {
    parsed = JSON.parse(raw) as StoredColumn[];
    if (!Array.isArray(parsed)) throw new Error("invalid shape");
  } catch {
    return result; // não marca flag — payload corrompido, vai tentar na próxima
  }

  // Backup não-destrutivo
  try {
    if (!localStorage.getItem(LS_BACKUP_KEY)) {
      localStorage.setItem(LS_BACKUP_KEY, raw);
    }
  } catch {
    /* ignore */
  }

  // Monta rows
  const rows: Array<ReturnType<typeof cardToRow> & { __originalId: string }> = [];
  for (const col of parsed) {
    if (!VALID_COLS.includes(col.id as OpsColumnId)) continue;
    const colId = col.id as OpsColumnId;
    (col.cards || []).forEach((card, idx) => {
      if (!card?.id || !card.id.startsWith("manual-ops-")) return; // só cards manuais
      const row = cardToRow(card, colId, idx);
      // Detecta data não parseável (texto presente sem ISO resultante)
      if (card.travelDate && !row.travel_date_iso && !parseBrDateToIso(card.travelDate)) {
        result.unparsedDates.push(card.id);
      }
      rows.push({ ...row, __originalId: card.id });
    });
  }

  if (rows.length === 0) {
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
    localStorage.setItem(MIGRATED_COUNT, "0");
    return result;
  }

  // Antes do upsert: descobrir quais ids já existem (para logar como skipped)
  const ids = rows.map((r) => r.id);
  const { data: existing, error: existErr } = await supabase
    .from("ops_cards")
    .select("id")
    .in("id", ids);
  if (existErr) {
    console.error("[ops-migration] check existing failed:", existErr);
    return result;
  }
  const existingIds = new Set((existing || []).map((r: any) => r.id));
  result.skippedIds = rows
    .filter((r) => existingIds.has(r.id))
    .map((r) => r.__originalId);
  result.skippedCount = result.skippedIds.length;

  // Apenas inserir os que não existem (preserva edições servidor-side)
  const toInsert = rows
    .filter((r) => !existingIds.has(r.id))
    .map(({ __originalId, ...rest }) => rest);

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;

  if (toInsert.length > 0) {
    const payload = toInsert.map((r) => ({ ...r, created_by: userId }));
    const { error: insErr } = await supabase
      .from("ops_cards")
      .upsert(payload as any, { onConflict: "id", ignoreDuplicates: true });
    if (insErr) {
      console.error("[ops-migration] insert failed:", insErr);
      return result;
    }
    result.migratedCount = toInsert.length;
  }

  // Auditoria
  await supabase.from("ops_migration_log").insert({
    user_id: userId,
    migrated_count: result.migratedCount,
    skipped_count: result.skippedCount,
    skipped_ids: result.skippedIds as any,
    unparsed_dates: result.unparsedDates as any,
    source_payload: parsed as any,
    notes:
      result.skippedCount > 0
        ? `Reimportação: ${result.skippedCount} card(s) já existiam no servidor e foram preservados (não sobrescritos).`
        : null,
  });

  localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
  localStorage.setItem(MIGRATED_COUNT, String(result.migratedCount));
  result.ran = true;
  return result;
}
