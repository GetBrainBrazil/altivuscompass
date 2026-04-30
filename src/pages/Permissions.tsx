import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/notify";
import { PAGE_PERMISSIONS, FEATURE_PERMISSIONS, ROLE_LABELS, type AppRole, type PagePermission, type FeaturePermission } from "@/lib/permissions";

export default function Permissions({ embedded = false }: { embedded?: boolean }) {
  const [permissions, setPermissions] = useState<PagePermission[]>(PAGE_PERMISSIONS);
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermission[]>(FEATURE_PERMISSIONS);

  const allRoles: AppRole[] = ["admin", "manager", "sales_agent", "operations"];

  const togglePageRole = (page: PagePermission, role: AppRole, next: boolean) => {
    if (role === "admin") return;
    const newRoles = next
      ? Array.from(new Set([...page.allowedRoles, role]))
      : page.allowedRoles.filter((r) => r !== role);
    const updated = permissions.map((p) =>
      p.path === page.path ? { ...p, allowedRoles: newRoles } : p,
    );
    setPermissions(updated);
    const original = PAGE_PERMISSIONS.find((p) => p.path === page.path);
    if (original) original.allowedRoles = [...newRoles];
    notify.success(
      `${ROLE_LABELS[role]} ${next ? "agora tem" : "perdeu"} acesso a "${page.label}"`,
    );
  };

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
              {permissions.map((page) => {
                const isSubPage = page.path.startsWith("/crm?");
                return (
                  <TableRow key={page.path} className="hover:bg-slate-50 transition-colors">
                    <TableCell
                      className={
                        isSubPage
                          ? "font-body text-sm text-muted-foreground pl-8 border-l-2 border-l-primary/30"
                          : "font-body text-sm font-medium"
                      }
                    >
                      {isSubPage ? page.label.replace(/^CRM\s*—\s*/, "↳ ") : page.label}
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
                );
              })}
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
