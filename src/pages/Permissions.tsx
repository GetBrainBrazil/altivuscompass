import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { notify } from "@/lib/notify";
import { PAGE_PERMISSIONS, FEATURE_PERMISSIONS, ROLE_LABELS, type AppRole, type PagePermission, type FeaturePermission } from "@/lib/permissions";
import { savePermissionOverrides } from "@/lib/permissionSync";

// Agrupamento conforme menu lateral. `paths` referencia páginas em PAGE_PERMISSIONS.
type PermGroup = { id: string; label: string; paths: string[] };
const PERMISSION_GROUPS: PermGroup[] = [
  { id: "menu-superior", label: "Menu Superior", paths: ["/profile", "/changelog"] },
  { id: "painel", label: "Painel", paths: ["/"] },
  { id: "tarefas", label: "Tarefas", paths: ["/tasks"] },

  { id: "clientes", label: "Clientes", paths: ["/clients"] },
  {
    id: "crm",
    label: "CRM",
    paths: ["/crm", "/crm/dashboard", "/quotes", "/crm/sales?tab=sales", "/crm/ops?tab=ops", "/sales"],
  },
  { id: "roteiros", label: "Roteiros", paths: ["/itineraries"] },
  { id: "campanhas", label: "Campanhas", paths: ["/campaigns"] },
  { id: "milhas", label: "Milhas", paths: ["/miles"] },
  {
    id: "financeiro",
    label: "Financeiro",
    paths: [
      "/finance/reports",
      "/finance",
      "/finance/payables-receivables",
      "/finance/payables",
      "/finance/receivables",
      "/finance/closed-sales",
      "/finance/suppliers",
      "/finance/registrations",
    ],
  },
  { id: "vault", label: "Cofre de Senhas", paths: ["/vault"] },
  { id: "catalogo", label: "Catálogo", paths: ["/catalog"] },
  { id: "cadastros", label: "Cadastros", paths: ["/registrations"] },
  { id: "service-center", label: "Central de Atendimento", paths: ["/service-center"] },
  { id: "ai", label: "Agentes IA", paths: ["/ai-agents"] },
  { id: "sistema", label: "Sistema", paths: ["/system", "/users", "/permissions"] },

];

export default function Permissions({ embedded = false }: { embedded?: boolean }) {
  const [permissions, setPermissions] = useState<PagePermission[]>(PAGE_PERMISSIONS);
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermission[]>(FEATURE_PERMISSIONS);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const allRoles: AppRole[] = ["admin", "manager", "sales_agent", "operations"];

  const applyPageUpdates = (updates: Array<{ path: string; allowedRoles: AppRole[] }>) => {
    const map = new Map(updates.map((u) => [u.path, u.allowedRoles]));
    const updated = permissions.map((p) => (map.has(p.path) ? { ...p, allowedRoles: map.get(p.path)! } : p));
    setPermissions(updated);
    updates.forEach((u) => {
      const original = PAGE_PERMISSIONS.find((p) => p.path === u.path);
      if (original) original.allowedRoles = [...u.allowedRoles];
    });
    savePermissionOverrides().catch((e) => {
      console.error(e);
      notify.error("Não foi possível salvar a permissão");
    });
  };

  const togglePageRole = (page: PagePermission, role: AppRole, next: boolean) => {
    if (role === "admin") return;
    const newRoles = next
      ? Array.from(new Set([...page.allowedRoles, role]))
      : page.allowedRoles.filter((r) => r !== role);
    applyPageUpdates([{ path: page.path, allowedRoles: newRoles }]);
    notify.success(
      `${ROLE_LABELS[role]} ${next ? "agora tem" : "perdeu"} acesso a "${page.label}"`,
    );
  };

  const toggleGroupRole = (group: PermGroup, role: AppRole, next: boolean) => {
    if (role === "admin") return;
    const updates = group.paths
      .map((path) => permissions.find((p) => p.path === path))
      .filter((p): p is PagePermission => !!p)
      .map((p) => ({
        path: p.path,
        allowedRoles: next
          ? (Array.from(new Set([...p.allowedRoles, role])) as AppRole[])
          : p.allowedRoles.filter((r) => r !== role),
      }));
    applyPageUpdates(updates);
    notify.success(
      `${ROLE_LABELS[role]} ${next ? "agora tem" : "perdeu"} acesso a "${group.label}" (todos os itens)`,
    );
  };

  const groupState = (group: PermGroup, role: AppRole): "all" | "none" | "some" => {
    const pages = group.paths
      .map((path) => permissions.find((p) => p.path === path))
      .filter((p): p is PagePermission => !!p);
    if (pages.length === 0) return "none";
    const onCount = pages.filter((p) => p.allowedRoles.includes(role)).length;
    if (onCount === 0) return "none";
    if (onCount === pages.length) return "all";
    return "some";
  };

  const groupedPaths = new Set(PERMISSION_GROUPS.flatMap((g) => g.paths));
  const ungrouped = permissions.filter((p) => !groupedPaths.has(p.path));


  const toggleFeatureRole = (feature: FeaturePermission, role: AppRole, next: boolean) => {
    if (role === "admin") return;
    const newRoles = next
      ? Array.from(new Set([...feature.allowedRoles, role]))
      : feature.allowedRoles.filter((r) => r !== role);
    const updated = featurePermissions.map((f) =>
      f.key === feature.key ? { ...f, allowedRoles: newRoles } : f,
    );
    setFeaturePermissions(updated);
    const original = FEATURE_PERMISSIONS.find((f) => f.key === feature.key);
    if (original) original.allowedRoles = [...newRoles];
    notify.success(
      `${ROLE_LABELS[role]} ${next ? "agora tem" : "perdeu"} acesso a "${feature.label}"`,
    );
  };

  return (
    <div className={embedded ? "space-y-4" : "max-w-5xl mx-auto space-y-4 sm:space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Permissões</h1>
          <p className="text-sm text-muted-foreground font-body">
            Gerencie as permissões de acesso por função para cada página do sistema.
          </p>
        </div>
      )}

      {/* Permissions Matrix */}
      <div className="glass-card rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-display font-semibold text-foreground mb-3">Matriz de Permissões</h3>
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-body text-xs min-w-[100px] sticky top-0 z-10 bg-background">Página</TableHead>
                {allRoles.map((role) => (
                  <TableHead key={role} className="font-body text-xs text-center min-w-[80px] sticky top-0 z-10 bg-background">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_GROUPS.map((group) => {
                const childPages = group.paths
                  .map((path) => permissions.find((p) => p.path === path))
                  .filter((p): p is PagePermission => !!p);
                const isSingleton = childPages.length === 1 && childPages[0].label === group.label;
                const isOpen = !collapsed[group.id];

                if (isSingleton) {
                  const page = childPages[0];
                  return (
                    <TableRow key={group.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-body text-sm font-medium">{page.label}</TableCell>
                      {allRoles.map((role) => {
                        const isAdmin = role === "admin";
                        const checked = isAdmin || page.allowedRoles.includes(role);
                        return (
                          <TableCell key={role} className="text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={checked}
                                disabled={isAdmin}
                                onCheckedChange={(v) => togglePageRole(page, role, v)}
                                aria-label={`${ROLE_LABELS[role]} - ${page.label}`}
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                }

                return (
                  <React.Fragment key={group.id}>

                    <TableRow className="bg-slate-50/60 hover:bg-slate-100/60 transition-colors">

                      <TableCell className="font-body text-sm font-semibold">
                        <button
                          type="button"
                          onClick={() => setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))}
                          className="inline-flex items-center gap-1 hover:text-primary"
                          aria-label={isOpen ? "Recolher" : "Expandir"}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {group.label}
                        </button>
                      </TableCell>
                      {allRoles.map((role) => {
                        const isAdmin = role === "admin";
                        const state = groupState(group, role);
                        const checked = isAdmin || state === "all";
                        return (
                          <TableCell key={role} className="text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={checked}
                                disabled={isAdmin}
                                onCheckedChange={(v) => toggleGroupRole(group, role, v)}
                                aria-label={`${ROLE_LABELS[role]} - ${group.label} (todos)`}
                                className={!isAdmin && state === "some" ? "opacity-60 ring-2 ring-primary/40" : ""}
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {isOpen &&
                      childPages.map((page) => (
                        <TableRow key={page.path} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-body text-sm pl-10 text-muted-foreground">
                            {page.label}
                          </TableCell>
                          {allRoles.map((role) => {
                            const isAdmin = role === "admin";
                            const checked = isAdmin || page.allowedRoles.includes(role);
                            return (
                              <TableCell key={role} className="text-center">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={checked}
                                    disabled={isAdmin}
                                    onCheckedChange={(v) => togglePageRole(page, role, v)}
                                    aria-label={`${ROLE_LABELS[role]} - ${page.label}`}
                                  />
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                  </React.Fragment>
                );
              })}
              {ungrouped.map((page) => (
                <TableRow key={page.path} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-body text-sm font-medium">{page.label}</TableCell>
                  {allRoles.map((role) => {
                    const isAdmin = role === "admin";
                    const checked = isAdmin || page.allowedRoles.includes(role);
                    return (
                      <TableCell key={role} className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={checked}
                            disabled={isAdmin}
                            onCheckedChange={(v) => togglePageRole(page, role, v)}
                            aria-label={`${ROLE_LABELS[role]} - ${page.label}`}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>

          </Table>
        </div>
      </div>

      {/* Feature Permissions Matrix */}
      <div className="glass-card rounded-xl p-3 sm:p-4">
        <h3 className="text-sm font-display font-semibold text-foreground mb-3">Permissões de Funcionalidades</h3>
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-body text-xs min-w-[150px] sticky top-0 z-10 bg-background">Funcionalidade</TableHead>
                {allRoles.map((role) => (
                  <TableHead key={role} className="font-body text-xs text-center min-w-[80px] sticky top-0 z-10 bg-background">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {featurePermissions.map((feature) => (
                <TableRow key={feature.key} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-body text-sm">
                    <div>
                      <span className="font-medium">{feature.label}</span>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </TableCell>
                  {allRoles.map((role) => {
                    const isAdmin = role === "admin";
                    const checked = isAdmin || feature.allowedRoles.includes(role);
                    return (
                      <TableCell key={role} className="text-center">
                        <div className="flex justify-center">
                          <Switch
                            checked={checked}
                            disabled={isAdmin}
                            onCheckedChange={(v) => toggleFeatureRole(feature, role, v)}
                            aria-label={`${ROLE_LABELS[role]} - ${feature.label}`}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {allRoles.map((role) => {
          const accessiblePages = permissions.filter(
            (p) => role === "admin" || p.allowedRoles.includes(role)
          );
          const accessibleFeatures = featurePermissions.filter(
            (f) => role === "admin" || f.allowedRoles.includes(role)
          );
          return (
            <div key={role} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-display font-semibold text-foreground">{ROLE_LABELS[role]}</h4>
                <Badge variant={role === "admin" ? "default" : "secondary"} className="font-body text-xs">
                  {accessiblePages.length + accessibleFeatures.length}/{permissions.length + featurePermissions.length}
                </Badge>
              </div>
              <div className="space-y-1">
                {permissions.map((page) => {
                  const hasAccess = role === "admin" || page.allowedRoles.includes(role);
                  return (
                    <div key={page.path} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${hasAccess ? "bg-primary" : "bg-muted-foreground/20"}`} />
                      <span className={`text-xs font-body ${hasAccess ? "text-foreground" : "text-muted-foreground/50"}`}>
                        {page.label}
                      </span>
                    </div>
                  );
                })}
                {featurePermissions.map((feature) => {
                  const hasAccess = role === "admin" || feature.allowedRoles.includes(role);
                  return (
                    <div key={feature.key} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${hasAccess ? "bg-primary" : "bg-muted-foreground/20"}`} />
                      <span className={`text-xs font-body ${hasAccess ? "text-foreground" : "text-muted-foreground/50"}`}>
                        {feature.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
