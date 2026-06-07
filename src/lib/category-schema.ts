/**
 * Fase 1 — Schema dinâmico de campos por categoria de produto.
 * Persistido em product_categories.field_schema (JSONB).
 */

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
  width?: FieldWidth;
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
      { key: "tipo", label: "Tipo", type: "select", width: "quarter", required: true, options: [
        { value: "ida", label: "Ida" },
        { value: "volta", label: "Volta" },
        { value: "ida_volta", label: "Ida e Volta" },
        { value: "trecho", label: "Trecho" },
      ]},
      { key: "origem", label: "Origem", type: "airport", width: "half", required: true },
      { key: "embarque", label: "Embarque", type: "date", width: "quarter", required: true, mapsTo: "utilization_start" },
      { key: "embarque_hora", label: "Horário", type: "time", width: "quarter" },
      { key: "destino", label: "Destino", type: "airport", width: "half", required: true },
      { key: "chegada", label: "Chegada", type: "date", width: "quarter", required: true, mapsTo: "utilization_end" },
      { key: "chegada_hora", label: "Horário", type: "time", width: "quarter" },
      { key: "duracao", label: "Duração", type: "duration_auto", width: "quarter" },
      { key: "companhia", label: "Companhia Aérea", type: "airline", width: "quarter", required: true },
      { key: "numero_voo", label: "Nº do Voo", type: "text", width: "quarter" },
      { key: "localizador", label: "Localizador", type: "text", width: "quarter" },
      { key: "numero_compra", label: "Nº da Compra", type: "text", width: "quarter" },
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
      { key: "observacao", label: "Observação", type: "text", width: "quarter" },
      { key: "bagagens", label: "Bagagens", type: "baggage", width: "full" },
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
