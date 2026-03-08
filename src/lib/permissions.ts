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
  { path: "/clients", label: "Clientes", allowedRoles: ["admin", "manager", "sales_agent"] },
  { path: "/quotes", label: "Cotações", allowedRoles: ["admin", "manager", "sales_agent"] },
  { path: "/campaigns", label: "Campanhas", allowedRoles: ["admin", "manager", "operations"] },
  { path: "/finance", label: "Financeiro", allowedRoles: ["admin", "manager"] },
  { path: "/miles", label: "Milhas", allowedRoles: ["admin", "manager", "sales_agent", "operations"] },
  { path: "/users", label: "Usuários", allowedRoles: ["admin"] },
  { path: "/permissions", label: "Permissões", allowedRoles: ["admin"] },
];

export function canAccess(userRole: string | null, path: string): boolean {
  if (!userRole) return false;
  if (userRole === "admin") return true;
  
  const page = PAGE_PERMISSIONS.find((p) => p.path === path);
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
