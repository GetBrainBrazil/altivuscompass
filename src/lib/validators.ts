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

/** Brazilian-friendly range: 10 (landline w/ DDD) up to 13 digits (with country code). */
export function isValidPhoneLength(phone: string | null | undefined): boolean {
  const len = cleanDigits(phone).length;
  return len >= 10 && len <= 13;
}
