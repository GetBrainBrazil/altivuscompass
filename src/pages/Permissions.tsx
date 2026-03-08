import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PAGE_PERMISSIONS, FEATURE_PERMISSIONS, ROLE_LABELS, type AppRole, type PagePermission, type FeaturePermission } from "@/lib/permissions";

export default function Permissions({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PagePermission[]>(PAGE_PERMISSIONS);
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermission[]>(FEATURE_PERMISSIONS);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PagePermission | null>(null);
  const [editingFeature, setEditingFeature] = useState<FeaturePermission | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);

  const allRoles: AppRole[] = ["admin", "manager", "sales_agent", "operations"];

  const openEdit = (page: PagePermission) => {
    setEditingPage(page);
    setEditingFeature(null);
    setEditRoles([...page.allowedRoles]);
    setEditOpen(true);
  };

  const openFeatureEdit = (feature: FeaturePermission) => {
    setEditingFeature(feature);
    setEditingPage(null);
    setEditRoles([...feature.allowedRoles]);
    setEditOpen(true);
  };

  const toggleRole = (role: AppRole) => {
    if (role === "admin") return; // admin always has access
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const savePermission = () => {
    if (editingPage) {
      const updated = permissions.map((p) =>
        p.path === editingPage.path ? { ...p, allowedRoles: editRoles } : p
      );
      setPermissions(updated);
      const original = PAGE_PERMISSIONS.find((p) => p.path === editingPage.path);
      if (original) {
        original.allowedRoles = [...editRoles];
      }
      toast({ title: "Permissões atualizadas", description: `Permissões de "${editingPage.label}" foram salvas.` });
    } else if (editingFeature) {
      const updated = featurePermissions.map((f) =>
        f.key === editingFeature.key ? { ...f, allowedRoles: editRoles } : f
      );
      setFeaturePermissions(updated);
      const original = FEATURE_PERMISSIONS.find((f) => f.key === editingFeature.key);
      if (original) {
        original.allowedRoles = [...editRoles];
      }
      toast({ title: "Permissões atualizadas", description: `Permissões de "${editingFeature.label}" foram salvas.` });
    }
    setEditOpen(false);
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
                <TableHead className="font-body text-xs min-w-[100px]">Página</TableHead>
                {allRoles.map((role) => (
                  <TableHead key={role} className="font-body text-xs text-center min-w-[80px]">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
                <TableHead className="font-body text-xs text-right min-w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((page) => (
                <TableRow key={page.path}>
                  <TableCell className="font-body text-sm font-medium">{page.label}</TableCell>
                  {allRoles.map((role) => (
                    <TableCell key={role} className="text-center">
                      {role === "admin" || page.allowedRoles.includes(role) ? (
                        <span className="text-primary font-bold">✓</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="font-body" onClick={() => openEdit(page)}>
                      Editar
                    </Button>
                  </TableCell>
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
                <TableHead className="font-body text-xs min-w-[150px]">Funcionalidade</TableHead>
                {allRoles.map((role) => (
                  <TableHead key={role} className="font-body text-xs text-center min-w-[80px]">
                    {ROLE_LABELS[role]}
                  </TableHead>
                ))}
                <TableHead className="font-body text-xs text-right min-w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featurePermissions.map((feature) => (
                <TableRow key={feature.key}>
                  <TableCell className="font-body text-sm">
                    <div>
                      <span className="font-medium">{feature.label}</span>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </TableCell>
                  {allRoles.map((role) => (
                    <TableCell key={role} className="text-center">
                      {role === "admin" || feature.allowedRoles.includes(role) ? (
                        <span className="text-primary font-bold">✓</span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="font-body" onClick={() => openFeatureEdit(feature)}>
                      Editar
                    </Button>
                  </TableCell>
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

      {/* Edit Permission Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Editar Permissões — {editingPage?.label || editingFeature?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-body">
              Selecione quais funções podem acessar <strong>{editingPage?.label || editingFeature?.label}</strong>.
            </p>
            <div className="space-y-3">
              {allRoles.map((role) => {
                const isAdmin = role === "admin";
                const checked = isAdmin || editRoles.includes(role);
                return (
                  <div key={role} className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={isAdmin}
                      onCheckedChange={() => toggleRole(role)}
                      className={isAdmin ? "opacity-50" : ""}
                    />
                    <div>
                      <span className="text-sm font-body font-medium text-foreground">{ROLE_LABELS[role]}</span>
                      {isAdmin && (
                        <span className="text-xs text-muted-foreground ml-2">(sempre tem acesso)</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button onClick={savePermission} className="w-full font-body">
              Salvar Permissões
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
