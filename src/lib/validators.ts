/**
 * Pure validators for client-facing forms (acceptance, contact, etc).
 * Keep this module tiny and dependency-free so it stays trivially testable.
 */

export function cleanDigits(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\D/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = String(email).trim();
  if (trimmed.length > 254) return false;
  return EMAIL_RE.test(trimmed);
}

/** Lightweight check: only ensures CPF has 11 digits. DV check is intentionally out of scope. */
export function isValidCPFLength(cpf: string | null | undefined): boolean {
  return cleanDigits(cpf).length === 11;
}

/** Full CPF validation including check digits (DV) per Receita Federal algorithm. */
export function isValidCPF(cpf: string | null | undefined): boolean {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const calcDV = (base: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const dv1 = calcDV(digits.slice(0, 9), 10);
  if (dv1 !== parseInt(digits[9], 10)) return false;
  const dv2 = calcDV(digits.slice(0, 10), 11);
  return dv2 === parseInt(digits[10], 10);
}

/** Full CNPJ validation including check digits per Receita Federal algorithm. */
export function isValidCNPJ(cnpj: string | null | undefined): boolean {
  const digits = cleanDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calcDV = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calcDV(digits.slice(0, 12), w1);
  if (dv1 !== parseInt(digits[12], 10)) return false;
  const dv2 = calcDV(digits.slice(0, 13), w2);
  return dv2 === parseInt(digits[13], 10);
}

/** Accepts either a valid CPF (11 digits) or a valid CNPJ (14 digits). */
export function isValidCPFOrCNPJ(value: string | null | undefined): boolean {
  const len = cleanDigits(value).length;
  if (len === 11) return isValidCPF(value);
  if (len === 14) return isValidCNPJ(value);
  return false;
}

/** Brazilian-friendly range: 10 (landline w/ DDD) up to 13 digits (with country code). */
export function isValidPhoneLength(phone: string | null | undefined): boolean {
  const len = cleanDigits(phone).length;
  return len >= 10 && len <= 13;
}
