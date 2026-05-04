// Daily job: marca leads estagnados, avisa, e arquiva por inatividade.
// Idempotente — pode rodar várias vezes ao dia.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Settings (única linha em agency_settings — ou defaults)
    const { data: settingsRow } = await supabase
      .from("agency_settings")
      .select("stagnation_days, auto_archive_days, auto_archive_enabled")
      .limit(1)
      .maybeSingle();
    const stagnationDays = settingsRow?.stagnation_days ?? 7;
    const archiveDays = settingsRow?.auto_archive_days ?? 21;
    const autoArchiveEnabled = settingsRow?.auto_archive_enabled ?? true;

    const now = Date.now();
    const stagnantThreshold = new Date(now - stagnationDays * 86400_000).toISOString();
    const archiveThreshold = new Date(now - archiveDays * 86400_000).toISOString();
    const warnThreshold = new Date(now - (archiveDays - 1) * 86400_000).toISOString();

    // Pega TODOS os leads ativos (não arquivados, não perdidos, não convertidos)
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, full_name, status, assigned_user_id, last_interaction_at, is_stagnant, stagnant_since, archive_pending_at")
      .eq("archived", false)
      .eq("is_lost", false)
      .neq("status", "converted");
    if (error) throw error;

    let flaggedStagnant = 0;
    let warned = 0;
    let archived = 0;

    for (const lead of leads ?? []) {
      const last = lead.last_interaction_at ? new Date(lead.last_interaction_at).getTime() : 0;
      const ageDays = Math.floor((now - last) / 86400_000);

      // 1) Estagnação
      if (!lead.is_stagnant && ageDays >= stagnationDays) {
        await supabase
          .from("leads")
          .update({ is_stagnant: true, stagnant_since: new Date().toISOString() })
          .eq("id", lead.id);
        // Timeline (event_type filtrado pelo trigger — não reseta interação)
        await supabase.from("contact_events").insert({
          lead_id: lead.id,
          event_type: "lead_stagnant",
          title: "Card marcado como estagnado",
          description: `Sem atividade há ${ageDays} dias`,
          metadata: { days: ageDays, stage: lead.status },
        });
        if (lead.assigned_user_id) {
          await supabase.from("notifications").insert({
            user_id: lead.assigned_user_id,
            type: "lead_stagnant",
            title: "Lead sem atividade",
            message: `O lead ${lead.full_name} está sem atividade há ${ageDays} dias na etapa ${lead.status}. Deseja tomar alguma ação?`,
            link: `/leads/${lead.id}`,
            metadata: { lead_id: lead.id, days: ageDays },
          });
        }
        flaggedStagnant++;
      }

      // 2) Pré-aviso de arquivamento (24h antes do prazo)
      if (
        autoArchiveEnabled &&
        !lead.archive_pending_at &&
        ageDays >= archiveDays - 1 &&
        ageDays < archiveDays
      ) {
        await supabase
          .from("leads")
          .update({ archive_pending_at: new Date().toISOString() })
          .eq("id", lead.id);
        if (lead.assigned_user_id) {
          await supabase.from("notifications").insert({
            user_id: lead.assigned_user_id,
            type: "lead_auto_archive_warning",
            title: "Lead será arquivado em 24h",
            message: `O lead ${lead.full_name} será arquivado automaticamente em 24 horas por inatividade. Clique para manter ativo.`,
            link: `/leads/${lead.id}`,
            metadata: { lead_id: lead.id, days: ageDays },
          });
        }
        warned++;
      }

      // 3) Arquivamento automático
      if (autoArchiveEnabled && ageDays >= archiveDays) {
        await supabase
          .from("leads")
          .update({ archived: true, archived_at: new Date().toISOString() })
          .eq("id", lead.id);
        await supabase.from("contact_events").insert({
          lead_id: lead.id,
          event_type: "lead_auto_archived",
          title: "Card arquivado automaticamente",
          description: `Sem atividade há ${ageDays} dias`,
          metadata: { days: ageDays, stage: lead.status },
        });
        archived++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, flaggedStagnant, warned, archived, settings: { stagnationDays, archiveDays, autoArchiveEnabled } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
