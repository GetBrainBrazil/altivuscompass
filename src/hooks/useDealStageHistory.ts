import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StageHistoryEntry {
  id: string;
  deal_id: string;
  phase: "quoting" | "selling" | "fulfilling";
  stage: string;
  from_phase: string | null;
  from_stage: string | null;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number | null;
  moved_by: string | null;
  moved_by_name: string | null;
  reason: string | null;
  source: string;
  metadata: Record<string, unknown>;
}

export interface StageMetrics {
  deal_id: string;
  phase: string;
  stage: string;
  passages: number;
  total_seconds: number;
  first_entered_at: string;
  last_entered_at: string;
  last_exited_at: string | null;
  is_current: boolean;
}

/**
 * Histórico completo de movimentações de um deal entre etapas.
 * Ordenado do mais recente para o mais antigo.
 */
export function useDealStageHistory(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ["deal_stage_history", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stage_history")
        .select("*")
        .eq("deal_id", dealId!)
        .order("entered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StageHistoryEntry[];
    },
  });
}

/**
 * Métricas agregadas (tempo total, número de passagens) por etapa de um deal.
 */
export function useDealStageMetrics(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ["deal_stage_metrics", dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_stage_metrics")
        .select("*")
        .eq("deal_id", dealId!);
      if (error) throw error;
      return (data ?? []) as StageMetrics[];
    },
  });
}
