import { useEffect, useState } from "react";

export type CompanyFilter = "all" | "altivus" | "milhas_e_voos";

/**
 * Persists the "Empresa" filter selection (per scope key) in localStorage.
 * Default selection is "all".
 */
export function useCompanyFilter(scopeKey: string) {
  const storageKey = `companyFilter:${scopeKey}`;
  const [value, setValue] = useState<CompanyFilter>(() => {
    if (typeof window === "undefined") return "all";
    const raw = window.localStorage.getItem(storageKey);
    if (raw === "altivus" || raw === "milhas_e_voos" || raw === "all") return raw;
    return "all";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      /* ignore */
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

export function matchesCompanyFilter(
  filter: CompanyFilter,
  company: string | null | undefined,
): boolean {
  if (filter === "all") return true;
  const c = company ?? "altivus";
  return c === filter;
}
