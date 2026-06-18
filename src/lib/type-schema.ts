/**
 * TIPO_SCHEMA — fonte única de verdade dos campos por TIPO de produto.
 *
 * Cada tipo descreve TODOS os campos (template + instância) que aparecem
 * no catálogo e na cotação. Categoria é um campo `select` do próprio
 * schema (não mais uma lista global), garantindo que cada tipo tenha
 * apenas combinações válidas.
 *
 * Reaproveita o renderer existente `DynamicCategoryFields` e as types
 * de `category-schema.ts` (CategoryField/CategoryFieldSchema). A única
 * extensão é o campo opcional `scope`.
 */

import type { CategoryField, CategoryFieldSchema } from "@/lib/category-schema";
import {
  Bed,
  Plane,
  Car,
  Ticket,
  ShieldCheck,
  Ship,
  Package,
  type LucideIcon,
} from "lucide-react";

export type FieldScope = "template" | "instancia";

export interface TypedField extends CategoryField {
  /** template = vai pro catálogo e é copiado pro item. instancia = só na cotação. */
  scope?: FieldScope;
}

export type TypedSchema = TypedField[];

export interface TypeSchemaDef {
  /** Label do tipo */
  label: string;
  /** Nome do ícone lucide-react associado ao tipo */
  icone: string;
  /** Schema completo (template + instância) */
  schema: TypedSchema;
}

/**
 * Registro central de ícones por TIPO. Inclui TODOS os tipos do catálogo,
 * mesmo os que ainda não têm schema completo. Qualquer componente que
 * exibir o tipo deve ler o ícone daqui (via `getTypeIcon`).
 */
export const TYPE_ICONS: Record<string, LucideIcon> = {
  hospedagem: Bed,
  hotel: Bed,
  voo: Plane,
  flight: Plane,
  transporte: Car,
  experiencia: Ticket,
  seguro: ShieldCheck,
  cruzeiro: Ship,
  outro: Package,
};

/** Ícone fallback neutro para tipos legados/inválidos. */
export const FALLBACK_TYPE_ICON: LucideIcon = Package;

export function getTypeIcon(itemType: string | null | undefined): LucideIcon {
  if (!itemType) return FALLBACK_TYPE_ICON;
  return TYPE_ICONS[itemType.toLowerCase()] ?? FALLBACK_TYPE_ICON;
}

/** Chaves canônicas do TIPO no CATÁLOGO (PT). */
export type TypeKey = "voo" | "hospedagem";

/**
 * Bridge entre o item_type do quote_item (em inglês: flight/hotel/...)
 * e a chave do TIPO_SCHEMA (em português: voo/hospedagem/...).
 */
const ITEM_TYPE_ALIASES: Record<string, TypeKey> = {
  voo: "voo",
  flight: "voo",
  hospedagem: "hospedagem",
  hotel: "hospedagem",
};

export function resolveTypeKey(itemType: string | null | undefined): TypeKey | null {
  if (!itemType) return null;
  return ITEM_TYPE_ALIASES[itemType.toLowerCase()] ?? null;
}

export const TIPO_SCHEMA: Record<TypeKey, TypeSchemaDef> = {
  voo: {
    label: "Voo",
    schema: [
      // ---------- template ----------
      {
        key: "categoria",
        label: "Categoria",
        type: "select",
        span: 4,
        required: true,
        group: "Detalhes do voo",
        scope: "template",
        options: [
          { value: "nacional", label: "Nacional" },
          { value: "internacional", label: "Internacional" },
          { value: "fretado", label: "Fretado" },
        ],
      },
      {
        key: "companhia",
        label: "Companhia",
        type: "airline",
        span: 4,
        required: true,
        group: "Detalhes do voo",
        scope: "template",
      },
      {
        key: "classe",
        label: "Classe",
        type: "select",
        span: 4,
        required: true,
        group: "Detalhes do voo",
        scope: "template",
        options: [
          { value: "economica", label: "Econômica" },
          { value: "premium_economica", label: "Premium Economy" },
          { value: "executiva", label: "Executiva" },
          { value: "primeira", label: "Primeira" },
        ],
      },
      {
        key: "origem",
        label: "Origem",
        type: "airport",
        span: 4,
        required: true,
        group: "Rota",
        scope: "template",
      },
      {
        key: "destino",
        label: "Destino",
        type: "airport",
        span: 4,
        required: true,
        group: "Rota",
        scope: "template",
      },
      {
        key: "conexao",
        label: "Conexões",
        type: "select",
        span: 4,
        group: "Rota",
        scope: "template",
        options: [
          { value: "direto", label: "Voo direto" },
          { value: "1_conexao", label: "1 conexão" },
          { value: "2_mais", label: "2+ conexões" },
        ],
      },
      {
        key: "bagagem_mao",
        label: "Bagagem de mão",
        type: "number",
        span: 6,
        group: "Bagagem (instância)",
        scope: "instancia",
      },
      {
        key: "bagagem_despachada",
        label: "Bagagem despachada",
        type: "number",
        span: 6,
        group: "Bagagem (instância)",
        scope: "instancia",
      },

      // ---------- instância ----------
      {
        key: "data_embarque",
        label: "Data de embarque",
        type: "date",
        span: 3,
        group: "Voo (instância)",
        scope: "instancia",
        mapsTo: "utilization_start",
      },
      {
        key: "horario_embarque",
        label: "Horário de embarque",
        type: "time",
        span: 3,
        group: "Voo (instância)",
        scope: "instancia",
      },
      {
        key: "data_chegada",
        label: "Data de chegada",
        type: "date",
        span: 3,
        group: "Voo (instância)",
        scope: "instancia",
        mapsTo: "utilization_end",
      },
      {
        key: "horario_chegada",
        label: "Horário de chegada",
        type: "time",
        span: 3,
        group: "Voo (instância)",
        scope: "instancia",
      },
      {
        key: "numero_voo",
        label: "Nº do voo",
        type: "text",
        span: 4,
        group: "Voo (instância)",
        scope: "instancia",
      },
      {
        key: "localizador",
        label: "Localizador",
        type: "text",
        span: 4,
        group: "Voo (instância)",
        scope: "instancia",
      },
      {
        key: "numero_compra",
        label: "Nº da compra",
        type: "text",
        span: 4,
        group: "Voo (instância)",
        scope: "instancia",
      },
    ],
  },
  hospedagem: {
    label: "Hospedagem",
    schema: [
      // ---------- template ----------
      {
        key: "categoria",
        label: "Categoria",
        type: "select",
        span: 4,
        required: true,
        group: "Detalhes da hospedagem",
        scope: "template",
        options: [
          { value: "hotel", label: "Hotel" },
          { value: "resort", label: "Resort" },
          { value: "pousada", label: "Pousada" },
          { value: "apart_hotel", label: "Apart-hotel" },
          { value: "villa", label: "Villa" },
        ],
      },
      {
        key: "estrelas",
        label: "Estrelas",
        type: "select",
        span: 4,
        group: "Detalhes da hospedagem",
        scope: "template",
        options: [
          { value: "1", label: "1 estrela" },
          { value: "2", label: "2 estrelas" },
          { value: "3", label: "3 estrelas" },
          { value: "4", label: "4 estrelas" },
          { value: "5", label: "5 estrelas" },
        ],
      },
      {
        key: "tipo_acomodacao",
        label: "Tipo de acomodação",
        type: "text",
        span: 4,
        group: "Detalhes da hospedagem",
        scope: "template",
        placeholder: "Ex.: Deluxe, Suíte...",
      },
      {
        key: "localizacao",
        label: "Localização",
        type: "text",
        span: 8,
        required: true,
        group: "Detalhes da hospedagem",
        scope: "template",
        placeholder: "Bairro, cidade...",
      },
      {
        key: "endereco",
        label: "Endereço completo",
        type: "textarea",
        span: 12,
        group: "Detalhes da hospedagem",
        scope: "template",
        placeholder: "Rua, número, complemento — usado em roteiro e transfer",
      },

      {
        key: "regime",
        label: "Regime",
        type: "select",
        span: 4,
        group: "Detalhes da hospedagem",
        scope: "template",
        options: [
          { value: "none", label: "Sem refeição" },
          { value: "breakfast", label: "Café da manhã" },
          { value: "half_board", label: "Meia pensão" },
          { value: "full_board", label: "Pensão completa" },
          { value: "all_inclusive", label: "All inclusive" },
        ],
      },
      {
        key: "comodidades",
        label: "Comodidades",
        type: "checkbox",
        span: 12,
        group: "Comodidades",
        scope: "template",
        options: [
          { value: "wifi", label: "Wi-Fi" },
          { value: "piscina", label: "Piscina" },
          { value: "spa", label: "Spa" },
          { value: "academia", label: "Academia" },
          { value: "estacionamento", label: "Estacionamento" },
          { value: "pet_friendly", label: "Pet friendly" },
        ],
      },
      // ---------- instância ----------
      {
        key: "check_in",
        label: "Check-in",
        type: "date",
        span: 3,
        group: "Estadia (instância)",
        scope: "instancia",
        mapsTo: "utilization_start",
      },
      {
        key: "check_out",
        label: "Check-out",
        type: "date",
        span: 3,
        group: "Estadia (instância)",
        scope: "instancia",
        mapsTo: "utilization_end",
      },
      {
        key: "num_noites",
        label: "Nº de noites",
        type: "number",
        span: 2,
        group: "Estadia (instância)",
        scope: "instancia",
      },
      {
        key: "num_quartos",
        label: "Nº de quartos",
        type: "number",
        span: 2,
        group: "Estadia (instância)",
        scope: "instancia",
      },
      {
        key: "num_hospedes",
        label: "Nº de hóspedes",
        type: "number",
        span: 2,
        group: "Estadia (instância)",
        scope: "instancia",
      },
    ],
  },
};

export function hasTypeSchema(itemType: string | null | undefined): boolean {
  return resolveTypeKey(itemType) !== null;
}

export function getTypeSchema(itemType: string | null | undefined): TypedSchema | null {
  const key = resolveTypeKey(itemType);
  return key ? TIPO_SCHEMA[key].schema : null;
}

export function getTemplateFields(itemType: string | null | undefined): TypedSchema {
  const s = getTypeSchema(itemType);
  if (!s) return [];
  return s.filter((f) => (f.scope ?? "template") === "template");
}

export function getInstanceFields(itemType: string | null | undefined): TypedSchema {
  const s = getTypeSchema(itemType);
  if (!s) return [];
  return s.filter((f) => f.scope === "instancia");
}

/** Categorias válidas (value/label) extraídas do campo `categoria` do tipo. */
export function getCategoryOptions(itemType: string | null | undefined): { value: string; label: string }[] {
  const s = getTypeSchema(itemType);
  if (!s) return [];
  const cat = s.find((f) => f.key === "categoria");
  return cat?.options ?? [];
}

export function isValidCategoryForType(itemType: string | null | undefined, categoryValue: unknown): boolean {
  const opts = getCategoryOptions(itemType);
  if (!opts.length) return true; // tipo sem categoria definida
  if (categoryValue == null || categoryValue === "") return false;
  return opts.some((o) => o.value === categoryValue);
}

/** Snapshot copiado do produto para o item da cotação ao "puxar do catálogo". */
export function pickTemplateAttributes(
  itemType: string | null | undefined,
  attrs: Record<string, any> | null | undefined
): Record<string, any> {
  if (!attrs) return {};
  const tplKeys = new Set(getTemplateFields(itemType).map((f) => f.key));
  if (!tplKeys.size) return { ...attrs };
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (tplKeys.has(k)) out[k] = v;
  }
  return out;
}

/** Exporta como CategoryFieldSchema para passar direto ao renderer existente. */
export function asCategorySchema(schema: TypedSchema): CategoryFieldSchema {
  return schema as CategoryFieldSchema;
}
