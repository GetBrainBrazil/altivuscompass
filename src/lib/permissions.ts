// Page-level permissions configuration
// Maps each route to the roles that can access it

export type AppRole = "admin" | "manager" | "sales_agent" | "operations";

export interface PagePermission {
  path: string;
  label: string;
  allowedRoles: AppRole[];
}

// All pages and which roles can access them
// "admin" always has access to everything (enforced in canAccess)
export const PAGE_PERMISSIONS: PagePermission[] = [
  { path: "/", label: "Painel", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
  { path: "/tasks", label: "Tarefas", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
  { path: "/clients", label: "Clientes", allowedRoles: ["admin", "manager", "sales_agent"] },
  { path: "/quotes", label: "Cotações", allowedRoles: ["admin", "manager", "sales_agent"] },
  { path: "/sales", label: "Vendas", allowedRoles: ["admin", "manager", "sales_agent"] },
  { path: "/campaigns", label: "Campanhas", allowedRoles: ["admin", "manager", "operations"] },
  { path: "/finance", label: "Financeiro", allowedRoles: ["admin", "manager"] },
  { path: "/finance/registrations", label: "Cadastros Financeiros", allowedRoles: ["admin", "manager"] },
  { path: "/miles", label: "Milhas", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
  { path: "/users", label: "Usuários", allowedRoles: ["admin"] },
  { path: "/permissions", label: "Permissões", allowedRoles: ["admin"] },
  { path: "/registrations", label: "Cadastros", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
  { path: "/itineraries", label: "Roteiros", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
  { path: "/system", label: "Sistema", allowedRoles: ["admin"] },
  { path: "/ai-agents", label: "Agentes IA", allowedRoles: ["admin", "manager"] },
  { path: "/profile", label: "Meu Perfil", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
];

// Feature-level permissions (not page routes, but specific UI features)
export interface FeaturePermission {
  key: string;
  label: string;
  description: string;
  allowedRoles: AppRole[];
}

export const FEATURE_PERMISSIONS: FeaturePermission[] = [
  { key: "client_miles_tab", label: "Aba Milhas (Ficha do Cliente)", description: "Acesso à aba de milhas na ficha do cliente", allowedRoles: ["admin", "manager"] },
  { key: "client_miles_access_data", label: "Dados de Acesso (Milhas)", description: "Visualizar dados de acesso (senha) dos programas de milhas", allowedRoles: ["admin"] },
];

export function canAccessFeature(userRole: string | null, featureKey: string): boolean {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  const feature = FEATURE_PERMISSIONS.find((f) => f.key === featureKey);
  if (!feature) return false;
  return feature.allowedRoles.includes(userRole as AppRole);
}

export function canAccess(userRole: string | null, path: string): boolean {
  if (!userRole) return false;
  if (userRole === "admin") return true;

  // Match exato OU prefixo (ex.: /ai-agents/new herda permissão de /ai-agents)
  const page =
    PAGE_PERMISSIONS.find((p) => p.path === path) ??
    PAGE_PERMISSIONS.filter((p) => p.path !== "/" && path.startsWith(p.path + "/"))
      .sort((a, b) => b.path.length - a.path.length)[0];
  if (!page) return false;

  return page.allowedRoles.includes(userRole as AppRole);
}

export function getAccessiblePages(userRole: string | null): PagePermission[] {
  if (!userRole) return [];
  if (userRole === "admin") return PAGE_PERMISSIONS;
  return PAGE_PERMISSIONS.filter((p) => p.allowedRoles.includes(userRole as AppRole));
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  sales_agent: "Agente de Vendas",
  operations: "Operações",
};
