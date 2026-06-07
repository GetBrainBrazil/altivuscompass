/**
 * Fase 1 — Schema dinâmico de campos por categoria de produto.
 * Persistido em product_categories.field_schema (JSONB).
 */

/**
 * Mapeia o nome de uma categoria para o `item_type` legado usado por
 * quote_items / pós-venda / PDF público. Fallback: "other_service".
 */
export function deriveItemTypeFromCategoryName(name?: string | null): string {
  if (!name) return "other_service";
  const n = name
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (n.includes("voo") || n.includes("aere") || n.includes("flight")) return "flight";
  if (n.includes("hosped") || n.includes("hotel") || n.includes("acomod") || n.includes("pousad")) return "hotel";
  if (n.includes("locac") || n.includes("transp") || n.includes("transfer") || n.includes("carro") || n.includes("van")) return "transport";
  if (n.includes("cruz") || n.includes("cruise")) return "cruise";
  if (n.includes("experi") || n.includes("passeio") || n.includes("tour")) return "experience";
  if (n.includes("seguro") || n.includes("insurance")) return "insurance";
  return "other_service";
}



export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "time"
  | "select"
  | "checkbox"
  // tipos especiais com componente próprio (Fase 2):
  | "airport"
  | "airline"
  | "google_places"
  | "baggage"
  | "duration_auto";

export type FieldWidth = "full" | "half" | "third" | "quarter";

export interface CategoryField {
  /** slug estável usado como key dentro de quote_items.details */
  key: string;
  label: string;
  type: FieldType;
  /** Legado — enum (full|half|third|quarter). Mantido para compat. Quando `span` existe, ele tem precedência. */
  width?: FieldWidth;
  /** Novo: 1..12 colunas no grid desktop. */
  span?: number;
  required?: boolean;
  placeholder?: string;
  /** Para selects e checkbox-group */
  options?: { value: string; label: string }[];
  /** Agrupamento visual opcional (ex.: "Datas", "Inclusos") */
  group?: string;
  /** Coluna de fallback para sincronizar com colunas estruturadas do item (ex.: utilization_start) */
  mapsTo?: "utilization_start" | "utilization_end" | "title" | "supplier_id";
}

export type CategoryFieldSchema = CategoryField[];

const WIDTH_TO_SPAN: Record<FieldWidth, number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
};

/** Retorna o span efetivo do campo (1..12), derivando do legacy `width` se necessário. */
export function getEffectiveSpan(field: Pick<CategoryField, "span" | "width">): number {
  if (typeof field.span === "number" && field.span >= 1 && field.span <= 12) {
    return Math.round(field.span);
  }
  if (field.width && WIDTH_TO_SPAN[field.width]) return WIDTH_TO_SPAN[field.width];
  return 12;
}

/** Mapa estático de classes Tailwind por span (necessário para Tailwind detectar no bundle). */
export const SPAN_DESKTOP_CLASS: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

/**
 * Classe responsiva para o grid de 12 col:
 * - mobile (<640): empilhado (col-span-12)
 * - tablet (>=640): span ≤ 4 vira 6, > 4 vira 12
 * - desktop (>=1024): respeita o span configurado
 */
export function spanClass(span: number): string {
  const s = Math.max(1, Math.min(12, Math.round(span)));
  const tablet = s <= 4 ? "sm:col-span-6" : "sm:col-span-12";
  return `col-span-12 ${tablet} ${SPAN_DESKTOP_CLASS[s] ?? "lg:col-span-12"}`;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  currency: "Valor (R$)",
  date: "Data",
  time: "Horário",
  select: "Seleção",
  checkbox: "Caixa de seleção",
  airport: "Aeroporto (autocomplete)",
  airline: "Companhia aérea",
  google_places: "Endereço (Google Places)",
  baggage: "Bagagens (mochila/mão/despachada)",
  duration_auto: "Duração (calculada)",
};

export const FIELD_WIDTH_LABELS: Record<FieldWidth, string> = {
  full: "100%",
  half: "50%",
  third: "33%",
  quarter: "25%",
};

export function slugify(input: string): string {
  return input
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "campo";
}

export function ensureUniqueKey(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function isValidSchema(value: unknown): value is CategoryFieldSchema {
  return Array.isArray(value) && value.every((f) => f && typeof (f as any).key === "string" && typeof (f as any).label === "string");
}

/** Templates seed baseados nas imagens enviadas pelo usuário. */
export const SEED_TEMPLATES: Record<string, { label: string; schema: CategoryFieldSchema }> = {
  voo: {
    label: "Voo",
    schema: [
      // Linha 1
      { key: "tipo", label: "Tipo", type: "select", width: "quarter", required: true, options: [
        { value: "ida", label: "Ida" },
        { value: "volta", label: "Volta" },
        { value: "ida_volta", label: "Ida e Volta" },
        { value: "trecho", label: "Trecho" },
      ]},
      { key: "origem", label: "Origem", type: "airport", width: "quarter", required: true },
      { key: "embarque", label: "Embarque", type: "date", width: "quarter", required: true, mapsTo: "utilization_start" },
      { key: "embarque_hora", label: "Horário Embarque", type: "time", width: "quarter" },
      // Linha 2
      { key: "duracao", label: "Duração", type: "duration_auto", width: "quarter" },
      { key: "destino", label: "Destino", type: "airport", width: "quarter", required: true },
      { key: "chegada", label: "Chegada", type: "date", width: "quarter", required: true, mapsTo: "utilization_end" },
      { key: "chegada_hora", label: "Horário Chegada", type: "time", width: "quarter" },
      // Linha 3
      { key: "companhia", label: "Companhia Aérea", type: "airline", width: "quarter", required: true },
      { key: "numero_voo", label: "Nº do Voo (Bilhete)", type: "text", width: "quarter" },
      { key: "localizador", label: "Localizador", type: "text", width: "quarter" },
      { key: "numero_compra", label: "Nº da Compra", type: "text", width: "quarter" },
      // Linha 4
      { key: "classe", label: "Classe", type: "select", width: "quarter", options: [
        { value: "economica", label: "Econômica" },
        { value: "premium_economica", label: "Premium Econômica" },
        { value: "executiva", label: "Executiva" },
        { value: "primeira", label: "Primeira Classe" },
      ]},
      { key: "conexoes", label: "Conexões", type: "select", width: "quarter", options: [
        { value: "direto", label: "Direto" },
        { value: "1_conexao", label: "1 conexão" },
        { value: "2_conexoes", label: "2 conexões" },
        { value: "3_ou_mais", label: "3 ou mais" },
      ]},
      { key: "notificacao_checkin", label: "Notificação Check-in", type: "select", width: "quarter", options: [
        { value: "nenhuma", label: "Nenhuma" },
        { value: "24h_antes", label: "24h antes" },
        { value: "48h_antes", label: "48h antes" },
      ]},
      { key: "bagagens", label: "Bagagens", type: "baggage", width: "quarter" },
      // Linha 5
      { key: "observacao", label: "Observação", type: "textarea", width: "full" },
    ],
  },
  hospedagem: {
    label: "Hospedagem",
    schema: [
      { key: "nome_hospedagem", label: "Nome da Hospedagem", type: "text", width: "half", required: true, mapsTo: "title" },
      { key: "endereco", label: "Endereço", type: "google_places", width: "half" },
      { key: "checkin_data", label: "Data Check-in", type: "date", width: "quarter", required: true, mapsTo: "utilization_start" },
      { key: "checkin_hora", label: "Hora Check-in", type: "time", width: "quarter" },
      { key: "detalhes", label: "Detalhes", type: "text", width: "half", placeholder: "Tipo de quarto, regime, etc." },
      { key: "checkout_data", label: "Data Check-out", type: "date", width: "quarter", required: true, mapsTo: "utilization_end" },
      { key: "checkout_hora", label: "Hora Check-out", type: "time", width: "quarter" },
      { key: "descricao", label: "Descrição", type: "textarea", width: "half", placeholder: "Informações adicionais" },
      { key: "tipo_acomodacao", label: "Tipo de Acomodação", type: "select", width: "half", options: [
        { value: "hotel", label: "Hotel" },
        { value: "resort", label: "Resort" },
        { value: "pousada", label: "Pousada" },
        { value: "hostel", label: "Hostel" },
        { value: "apart_hotel", label: "Apart-Hotel / Flat" },
        { value: "apartment", label: "Apartamento (temporada)" },
        { value: "house", label: "Casa / Vila" },
        { value: "chalet", label: "Chalé / Cabana" },
        { value: "boat", label: "Barco / Cruzeiro fluvial" },
        { value: "other", label: "Outro" },
      ]},
      { key: "plano_alimentacao", label: "Plano de Alimentação", type: "select", width: "half", options: [
        { value: "none", label: "Sem refeições" },
        { value: "breakfast", label: "Café da manhã" },
        { value: "half_board", label: "Meia pensão" },
        { value: "full_board", label: "Pensão completa" },
        { value: "all_inclusive", label: "All Inclusive" },
        { value: "all_inclusive_premium", label: "All Inclusive Premium" },
      ]},
    ],
  },
  locacao: {
    label: "Locação / Transporte",
    schema: [
      { key: "tipo", label: "Tipo", type: "select", width: "third", options: [
        { value: "carro", label: "Carro" },
        { value: "van", label: "Van" },
        { value: "transfer", label: "Transfer" },
        { value: "onibus", label: "Ônibus" },
        { value: "outro", label: "Outro" },
      ]},
      { key: "titulo_fornecedor", label: "Título / Fornecedor", type: "text", width: "third", placeholder: "Ex: Localiza, Hertz...", mapsTo: "title" },
      { key: "data_retirada", label: "Data de retirada", type: "date", width: "third", required: true, mapsTo: "utilization_start" },
      { key: "data_devolucao", label: "Data de devolução", type: "date", width: "third", required: true, mapsTo: "utilization_end" },
      { key: "inclusos", label: "Inclusos", type: "checkbox", width: "full", options: [
        { value: "km_livre", label: "Km livre" },
        { value: "motorista_adicional", label: "Motorista adicional" },
        { value: "seguro_basico", label: "Seguro básico" },
        { value: "gps", label: "GPS" },
        { value: "cadeirinha_infantil", label: "Cadeirinha infantil" },
      ]},
      { key: "observacoes", label: "Observações", type: "textarea", width: "full", placeholder: "Informações adicionais sobre o transporte" },
    ],
  },
};
