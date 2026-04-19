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

/** Brazilian-friendly range: 10 (landline w/ DDD) up to 13 digits (with country code). */
export function isValidPhoneLength(phone: string | null | undefined): boolean {
  const len = cleanDigits(phone).length;
  return len >= 10 && len <= 13;
}
