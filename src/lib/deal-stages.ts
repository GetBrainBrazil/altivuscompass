/**
 * FASE 1 — Definição canônica de etapas e situações do negócio.
 *
 * Um negócio (deal) tem:
 *  - `phase`  = zona macro do Kanban (Cotação | Emissão | Pós-venda)
 *  - `stage`  = etapa dentro da fase
 *  - `situation[]` = badges paralelas (perdido, pausado, etc.) que podem
 *                     conviver com qualquer etapa.
 *
 * Perdido NÃO é etapa, é situação.
 */

export type DealPhase = "quoting" | "selling" | "fulfilling";

export type DealSituation =
  | "lost"
  | "paused"
  | "on_hold_client"
  | "contested"
  | "returned_flag";

export interface StageDef {
  key: string;
  label: string;
  phase: DealPhase;
  /** Cor da bolinha do Kanban (usa design tokens semânticos). */
  color: string;
  /** Ordem dentro da fase. */
  order: number;
  /** Se true, o sistema abre o wizard de Emissão ao mover pra cá. */
  triggersIssuanceWizard?: boolean;
}

export interface PhaseDef {
  key: DealPhase;
  label: string;
  /** Cor da divisória visual do Kanban. */
  accent: string;
  stages: StageDef[];
}

// ---------- ETAPAS CANÔNICAS ----------

export const DEAL_STAGES: StageDef[] = [
  // Cotação
  { key: "new",              label: "Novo",             phase: "quoting",    order: 1, color: "bg-soft-blue" },
  { key: "sent",             label: "Enviado",          phase: "quoting",    order: 2, color: "bg-soft-blue" },
  { key: "negotiation",      label: "Em negociação",    phase: "quoting",    order: 3, color: "bg-gold" },
  { key: "accepted",         label: "Aceito",           phase: "quoting",    order: 4, color: "bg-success", triggersIssuanceWizard: true },

  // Emissão
  { key: "awaiting_payment", label: "Aguardando pagamento",  phase: "selling",   order: 1, color: "bg-gold" },
  { key: "payment_received", label: "Pagamento recebido",     phase: "selling",   order: 2, color: "bg-soft-blue" },
  { key: "issuing",          label: "Emitindo (fornecedor)",  phase: "selling",   order: 3, color: "bg-gold" },
  { key: "issued",           label: "Emitido",                phase: "selling",   order: 4, color: "bg-success" },
  { key: "proof_sent",       label: "Comprovantes enviados",  phase: "selling",   order: 5, color: "bg-success" },

  // Pós-venda
  { key: "awaiting_travel",  label: "Aguardando viagem",     phase: "fulfilling", order: 1, color: "bg-soft-blue" },
  { key: "traveling",        label: "Em viagem",              phase: "fulfilling", order: 2, color: "bg-primary" },
  { key: "returned",         label: "Retornou",               phase: "fulfilling", order: 3, color: "bg-primary" },
  { key: "closed",           label: "Encerrado",              phase: "fulfilling", order: 4, color: "bg-muted" },

  // Compatibilidade com dados legados (mantidos até backfill total)
  { key: "confirmed",        label: "Confirmado (legado)",    phase: "selling",   order: 99, color: "bg-success" },
];

export const DEAL_PHASES: PhaseDef[] = [
  { key: "quoting",    label: "Cotação",   accent: "border-l-soft-blue",
    stages: DEAL_STAGES.filter((s) => s.phase === "quoting").sort((a, b) => a.order - b.order) },
  { key: "selling",    label: "Emissão",   accent: "border-l-gold",
    stages: DEAL_STAGES.filter((s) => s.phase === "selling").sort((a, b) => a.order - b.order) },
  { key: "fulfilling", label: "Pós-venda", accent: "border-l-primary",
    stages: DEAL_STAGES.filter((s) => s.phase === "fulfilling").sort((a, b) => a.order - b.order) },
];

// ---------- SITUAÇÕES (badges paralelas) ----------

export interface SituationDef {
  key: DealSituation;
  label: string;
  /** Classe Tailwind aplicada ao badge. */
  badgeClass: string;
  description: string;
}

export const DEAL_SITUATIONS: SituationDef[] = [
  { key: "lost",           label: "Perdido",             badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    description: "Negócio marcado como perdido em qualquer etapa." },
  { key: "paused",         label: "Pausado",             badgeClass: "bg-muted text-muted-foreground border-border",
    description: "Trabalho pausado internamente." },
  { key: "on_hold_client", label: "Aguardando cliente",  badgeClass: "bg-gold/10 text-gold-foreground border-gold/30",
    description: "Aguardando retorno do cliente." },
  { key: "contested",      label: "Contestado",          badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    description: "Cliente contestou algum item." },
  { key: "returned_flag",  label: "Devolvido",           badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    description: "Houve devolução de itens." },
];

// ---------- HELPERS ----------

export function getStageDef(stage: string | null | undefined): StageDef | null {
  if (!stage) return null;
  return DEAL_STAGES.find((s) => s.key === stage) ?? null;
}

export function getPhaseDef(phase: DealPhase | string | null | undefined): PhaseDef | null {
  if (!phase) return null;
  return DEAL_PHASES.find((p) => p.key === phase) ?? null;
}

export function getSituationDef(situation: string): SituationDef | null {
  return DEAL_SITUATIONS.find((s) => s.key === situation) ?? null;
}

/**
 * Retorna a etapa imediatamente anterior na mesma fase (para "Reabrir etapa").
 * Se for a primeira da fase, retorna a última da fase anterior.
 * Se for a primeira absoluta, retorna null.
 */
export function getPreviousStage(stage: string): StageDef | null {
  const current = getStageDef(stage);
  if (!current) return null;
  const sameFaseSiblings = DEAL_PHASES.find((p) => p.key === current.phase)!.stages;
  const idx = sameFaseSiblings.findIndex((s) => s.key === stage);
  if (idx > 0) return sameFaseSiblings[idx - 1];

  const phaseIdx = DEAL_PHASES.findIndex((p) => p.key === current.phase);
  if (phaseIdx === 0) return null;
  const prevPhase = DEAL_PHASES[phaseIdx - 1];
  return prevPhase.stages[prevPhase.stages.length - 1] ?? null;
}

/**
 * Retorna a próxima etapa (para botão "Avançar").
 */
export function getNextStage(stage: string): StageDef | null {
  const current = getStageDef(stage);
  if (!current) return null;
  const siblings = DEAL_PHASES.find((p) => p.key === current.phase)!.stages;
  const idx = siblings.findIndex((s) => s.key === stage);
  if (idx >= 0 && idx < siblings.length - 1) return siblings[idx + 1];

  const phaseIdx = DEAL_PHASES.findIndex((p) => p.key === current.phase);
  if (phaseIdx === DEAL_PHASES.length - 1) return null;
  const nextPhase = DEAL_PHASES[phaseIdx + 1];
  return nextPhase.stages[0] ?? null;
}

/**
 * Formata segundos em texto legível (dias, horas, minutos).
 */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "—";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}min`;
  return `${totalSeconds}s`;
}
