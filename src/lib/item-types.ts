/**
 * ETAPA 6 — Configuração por tipo de item.
 *
 * Fonte ÚNICA de verdade dos campos de reserva e tarefas de pós-venda.
 * NOTA: o trigger SQL `generate_fulfillment_tasks` em supabase/migrations/
 * espelha o bloco `postSaleTasks` abaixo. Ao alterar templates de tarefa,
 * atualize a função SQL também.
 */

export type ItemTypeKey =
  | "flight"
  | "hotel"
  | "transport"
  | "experience"
  | "other_service";

export interface ReservationField {
  /** chave dentro de quote_items.details (JSONB) */
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date" | "time";
}

export interface PostSaleTaskTemplate {
  /** identificador estável; persistido em tasks.description como `postsale:<key>` */
  key: string;
  title: string;
  /** dias relativos a utilization_start (negativo = antes) */
  offsetDays: number;
}

export interface ItemTypeConfig {
  label: string;
  /** rótulo das colunas utilization_start/end no formulário */
  utilizationLabel: { start: string; end?: string };
  /** campos de reserva (dados de confirmação pós-fechamento) em details JSONB */
  reservationFields: ReservationField[];
  /** templates de tarefa de pós-venda gerados quando deal entra em fulfilling */
  postSaleTasks: PostSaleTaskTemplate[];
}

export const ITEM_TYPES: Record<ItemTypeKey, ItemTypeConfig> = {
  flight: {
    label: "Voo",
    utilizationLabel: { start: "Data do voo", end: "Data de chegada" },
    // Campos de localizador/bilhete já estão no schema dinâmico da categoria Voo — evita duplicidade.
    reservationFields: [],
    postSaleTasks: [
      { key: "checkin_online", title: "Realizar check-in online", offsetDays: -2 },
      { key: "confirmar_emissao", title: "Confirmar emissão do bilhete", offsetDays: -7 },
    ],
  },
  hotel: {
    label: "Hotel",
    utilizationLabel: { start: "Check-in", end: "Check-out" },
    reservationFields: [
      { key: "voucher_number", label: "Número do voucher" },
      { key: "codigo_reserva", label: "Código da reserva no hotel" },
    ],
    postSaleTasks: [
      { key: "confirmar_voucher", title: "Confirmar voucher do hotel", offsetDays: -7 },
      { key: "instrucoes_checkin", title: "Enviar instruções de check-in ao cliente", offsetDays: -3 },
    ],
  },
  transport: {
    label: "Transporte",
    utilizationLabel: { start: "Data do serviço" },
    reservationFields: [
      { key: "voucher_number", label: "Número do voucher" },
      { key: "codigo_reserva", label: "Código da reserva" },
    ],
    postSaleTasks: [
      { key: "confirmar_voucher", title: "Confirmar voucher do transporte", offsetDays: -3 },
      { key: "instrucoes_cliente", title: "Enviar instruções de embarque ao cliente", offsetDays: -1 },
    ],
  },
  experience: {
    label: "Experiência",
    utilizationLabel: { start: "Data do agendamento" },
    reservationFields: [
      { key: "voucher_number", label: "Número do voucher" },
      { key: "codigo_reserva", label: "Código da reserva" },
    ],
    postSaleTasks: [
      { key: "confirmar_voucher", title: "Confirmar voucher da experiência", offsetDays: -3 },
      { key: "lembrar_cliente", title: "Lembrar cliente do horário", offsetDays: -1 },
    ],
  },
  other_service: {
    label: "Outro serviço",
    utilizationLabel: { start: "Data de utilização" },
    reservationFields: [
      { key: "codigo_reserva", label: "Código da reserva" },
    ],
    postSaleTasks: [
      { key: "confirmar_servico", title: "Confirmar prestação do serviço", offsetDays: -3 },
    ],
  },
};

export function getItemTypeConfig(type: string | null | undefined): ItemTypeConfig | null {
  if (!type) return null;
  return (ITEM_TYPES as Record<string, ItemTypeConfig>)[type] ?? null;
}

/** Marcador de identificação de tarefas de pós-venda (prefixo no title). */
export const POST_SALE_TITLE_PREFIX = "[Pós-venda]";

export function isPostSaleTask(task: { title?: string | null; description?: string | null }): boolean {
  return (
    (task.title ?? "").startsWith(POST_SALE_TITLE_PREFIX) ||
    (task.description ?? "").startsWith("postsale:")
  );
}
