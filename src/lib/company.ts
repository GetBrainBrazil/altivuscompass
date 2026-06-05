// Empresas (marca organizacional) — usado em cotações, contas bancárias e transações financeiras.
// Cliente NÃO recebe esse campo.

export type CompanyBrand = "altivus" | "milhas_e_voos";

export const COMPANY_OPTIONS: { value: CompanyBrand; label: string }[] = [
  { value: "altivus", label: "Altivus" },
  { value: "milhas_e_voos", label: "Milhas e Voos" },
];

export const COMPANY_LABEL: Record<CompanyBrand, string> = {
  altivus: "Altivus",
  milhas_e_voos: "Milhas e Voos",
};

export const DEFAULT_COMPANY: CompanyBrand = "altivus";

export function isCompanyBrand(v: unknown): v is CompanyBrand {
  return v === "altivus" || v === "milhas_e_voos";
}
