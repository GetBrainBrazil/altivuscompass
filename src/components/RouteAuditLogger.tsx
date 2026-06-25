import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logAuditEvent } from "@/lib/audit";

/**
 * Mounted once globally inside the authenticated layout.
 * Watches the URL and writes:
 *   - VIEW on the matching table when a record id is present in the path
 *   - NAVIGATE on the page when there is no record id
 *
 * Dedupes the same path within 60s to avoid spamming the log on
 * refresh / tab focus / quick back-and-forth.
 */

// UUID v4-ish detector (broad enough to also catch v1/v7)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID_RE.test(s);

type PageInfo = { label: string; table?: string };

/** Map first path segment to a friendly label + table */
function describePage(pathname: string): PageInfo {
  const [first = "", second = ""] = pathname.replace(/^\//, "").split("/");
  switch (first) {
    case "":          return { label: "Dashboard" };
    case "tasks":     return { label: "Tarefas", table: "tasks" };
    case "clients":   return { label: "Clientes", table: "clients" };
    case "contacts":  return { label: "Contatos", table: "contacts" };
    case "leads":     return { label: "Leads", table: "leads" };
    case "quotes":    return { label: "Cotações", table: "quotes" };
    case "sales":     return { label: "Vendas", table: "sales" };
    case "deals":     return { label: "Negócios", table: "deals" };
    case "campaigns": return { label: "Campanhas", table: "campaigns" };
    case "itineraries": return { label: "Roteiros", table: "itineraries" };
    case "service-center": return { label: "Central de Atendimento", table: "wa_conversations" };
    case "miles":     return { label: "Milhas", table: "miles_programs" };
    case "users":     return { label: "Usuários", table: "profiles" };
    case "permissions": return { label: "Permissões" };
    case "registrations": return { label: "Cadastros" };
    case "catalog":   return { label: "Catálogo", table: "products" };
    case "profile":   return { label: "Meu Perfil", table: "profiles" };
    case "vault":     return { label: "Cofre", table: "vault_items" };
    case "ai-agents": return { label: "Agentes IA", table: "ai_agents" };
    case "changelog": return { label: "Changelog" };
    case "crm":       return { label: "CRM" };
    case "ops":       return { label: "Operações", table: "ops_cards" };
    case "finance": {
      switch (second) {
        case "":               return { label: "Financeiro – Extrato", table: "financial_transactions" };
        case "payables":       return { label: "Contas a Pagar", table: "financial_transactions" };
        case "receivables":    return { label: "Contas a Receber", table: "financial_transactions" };
        case "payables-receivables": return { label: "Contas a Pagar / Receber", table: "financial_transactions" };
        case "registrations":  return { label: "Cadastros Financeiros" };
        case "reports":        return { label: "Dashboard Financeiro" };
        case "closed-sales":   return { label: "Vendas Fechadas", table: "sales" };
        default:               return { label: "Financeiro" };
      }
    }
    default: return { label: first };
  }
}

/** Extract a record UUID from the URL if present in path or ?id=/?edit= query */
function extractRecordId(pathname: string, search: string): string | null {
  // Path segments
  for (const seg of pathname.split("/")) {
    if (seg && isUuid(seg)) return seg;
  }
  // Query params commonly used by this app
  try {
    const p = new URLSearchParams(search);
    for (const key of ["edit", "id", "contact", "lead", "client"]) {
      const v = p.get(key);
      if (v && isUuid(v)) return v;
    }
  } catch { /* ignore */ }
  return null;
}

// Paths we never log (auth, public, noisy)
const SKIP_PREFIXES = [
  "/login", "/reset-password", "/quote/", "/roteiro/", "/unsubscribe", "/r/",
];

export default function RouteAuditLogger() {
  const location = useLocation();
  const { user } = useAuth();
  const lastKeyRef = useRef<{ key: string; ts: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const pathname = location.pathname;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return;

    const recordId = extractRecordId(pathname, location.search);
    const page = describePage(pathname);
    const key = `${pathname}${location.search}|${recordId ?? ""}`;

    // Dedupe: same path+id within 60s → skip
    const now = Date.now();
    const last = lastKeyRef.current;
    if (last && last.key === key && now - last.ts < 60_000) return;
    lastKeyRef.current = { key, ts: now };

    if (recordId && page.table) {
      // VIEW of a specific record
      logAuditEvent({
        action: "view",
        tableName: page.table,
        recordId,
        newData: { page: page.label, path: pathname },
      });
    } else {
      // Generic page navigation
      logAuditEvent({
        action: "navigate",
        tableName: "pages",
        recordId: pathname,
        recordLabel: page.label,
        newData: { path: pathname, page: page.label },
      });
    }
  }, [location.pathname, location.search, user]);

  return null;
}
