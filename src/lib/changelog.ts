/**
 * IMPORTANT — CHANGELOG POLICY:
 *
 * Every time a change is made to this codebase — whether it's a new feature,
 * UI improvement, bug fix, or removal — a new entry MUST be added to the
 * `platform_changelog` table.
 *
 * Use `addChangelogEntry({ ... })` (or insert directly via a migration) with:
 *  - title:       short summary (max 80 chars)
 *  - description: detailed explanation of what changed and WHY
 *  - category:    "nova_funcionalidade" | "melhoria" | "correcao" | "remocao"
 *  - module:      "CRM" | "Agentes IA" | "Central de Atendimento" | "Financeiro" | "Geral"
 *  - date:        optional ISO date (defaults to now)
 *
 * This changelog is visible to all platform users and helps the team
 * stay informed about platform evolution.
 *
 * DO NOT skip this step. Every change must include a changelog entry.
 */
import { supabase } from "@/integrations/supabase/client";

export type ChangelogCategory =
  | "nova_funcionalidade"
  | "melhoria"
  | "correcao"
  | "remocao";

export type ChangelogModule =
  | "CRM"
  | "Agentes IA"
  | "Central de Atendimento"
  | "Financeiro"
  | "Geral";

export async function addChangelogEntry(params: {
  title: string;
  description: string;
  category: ChangelogCategory;
  module: ChangelogModule;
  date?: string;
}) {
  const { error } = await supabase.from("platform_changelog").insert({
    title: params.title,
    description: params.description,
    category: params.category,
    module: params.module,
    date: params.date ? new Date(params.date).toISOString() : new Date().toISOString(),
  });
  if (error) throw error;
}
