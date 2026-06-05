import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Users,
  ChevronDown,
  Search,
  X,
  Copy,
  Lock,
  Star,
  ExternalLink,
  Shield,
  Pencil,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Tables } from "@/integrations/supabase/types";

type VaultItem = {
  id: string;
  title: string;
  category: string | null;
  url: string | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  is_favorite: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Viewer = { id: string; vault_item_id: string; user_id: string };
type ProfileWithRole = Tables<"profiles"> & { role?: string };

export default function Vault() {
  const { toast } = useToast();
  const { userRole, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userRole === "admin";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<VaultItem>>({});
  const [selectedViewers, setSelectedViewers] = useState<string[]>([]);
  const [viewerSearch, setViewerSearch] = useState("");
  const [viewerDropdownOpen, setViewerDropdownOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["vault-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_items")
        .select("*")
        .order("is_favorite", { ascending: false })
        .order("title");
      if (error) throw error;
      return data as VaultItem[];
    },
  });

  const { data: viewers = [] } = useQuery({
    queryKey: ["vault-viewers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_item_viewers")
        .select("*");
      if (error) throw error;
      return data as Viewer[];
    },
    enabled: isAdmin,
  });

  const { data: profilesWithRoles = [] } = useQuery({
    queryKey: ["profiles-with-roles-list"],
    queryFn: async () => {
      const [{ data: profilesData, error: pErr }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      if (pErr) throw pErr;
      return (profilesData ?? []).map((p: Tables<"profiles">) => ({
        ...p,
        role: rolesData?.find((r: Tables<"user_roles">) => r.user_id === p.user_id)?.role ?? "",
      })) as ProfileWithRole[];
    },
    enabled: isAdmin,
  });

  const filteredProfiles = useMemo(() => {
    if (!viewerSearch.trim()) return profilesWithRoles;
    const q = viewerSearch.toLowerCase();
    return profilesWithRoles.filter((p) => {
      const roleLabel = ROLE_LABELS[p.role ?? ""] ?? p.role ?? "";
      return (
        p.full_name.toLowerCase().includes(q) ||
        roleLabel.toLowerCase().includes(q)
      );
    });
  }, [profilesWithRoles, viewerSearch]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    let list = items;
    if (categoryFilter !== "all") {
      list = list.filter((i) => (i.category ?? "") === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.username ?? "").toLowerCase().includes(q) ||
          (i.url ?? "").toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q) ||
          (i.category ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search, categoryFilter]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: (form.title ?? "").trim(),
        category: form.category?.trim() || null,
        url: form.url?.trim() || null,
        username: form.username?.trim() || null,
        password: form.password ?? null,
        notes: form.notes ?? null,
        is_favorite: form.is_favorite ?? false,
      };
      if (!payload.title) throw new Error("Título é obrigatório");

      let itemId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("vault_items")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        await supabase.from("vault_item_viewers").delete().eq("vault_item_id", editingId);
      } else {
        const { data, error } = await supabase
          .from("vault_items")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        itemId = data.id;
      }

      if (selectedViewers.length > 0 && itemId) {
        const rows = selectedViewers.map((uid) => ({
          vault_item_id: itemId!,
          user_id: uid,
        }));
        const { error } = await supabase.from("vault_item_viewers").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Item atualizado" : "Item criado" });
      queryClient.invalidateQueries({ queryKey: ["vault-items"] });
      queryClient.invalidateQueries({ queryKey: ["vault-viewers"] });
      closeForm();
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vault_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Item removido" });
      queryClient.invalidateQueries({ queryKey: ["vault-items"] });
      queryClient.invalidateQueries({ queryKey: ["vault-viewers"] });
      setConfirmDelete(null);
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ is_favorite: false });
    setSelectedViewers([]);
    setFormOpen(true);
  };

  const openEdit = (it: VaultItem) => {
    setEditingId(it.id);
    setForm({ ...it });
    setSelectedViewers(viewers.filter((v) => v.vault_item_id === it.id).map((v) => v.user_id));
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({});
    setSelectedViewers([]);
    setViewerSearch("");
  };

  const toggleViewer = (uid: string) =>
    setSelectedViewers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );

  const copyToClipboard = async (text: string | null, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const getViewerNames = (itemId: string) => {
    const ids = viewers.filter((v) => v.vault_item_id === itemId).map((v) => v.user_id);
    return profilesWithRoles
      .filter((p) => ids.includes(p.user_id))
      .map((p) => p.full_name)
      .join(", ");
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground flex items-center gap-2">
            <Shield className="text-primary" size={26} />
            Cofre de Senhas
          </h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            {isAdmin
              ? "Gerencie senhas, acessos e observações sensíveis. Você controla quem pode ver cada item."
              : "Visualize apenas os itens em que um administrador te autorizou."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="font-body">
            <Plus size={16} className="mr-1" /> Novo Item
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, usuário, URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-body"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            <Button
              type="button"
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("all")}
              className="font-body text-xs h-9"
            >
              Todas
            </Button>
            {categories.map((c) => (
              <Button
                key={c}
                type="button"
                variant={categoryFilter === c ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(c)}
                className="font-body text-xs h-9"
              >
                {c}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm font-body text-muted-foreground">Carregando...</p>
      ) : visibleItems.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <Lock className="mx-auto text-muted-foreground mb-3" size={28} />
          <p className="text-sm font-body text-muted-foreground">
            {items.length === 0
              ? isAdmin
                ? "Nenhum item no cofre ainda. Clique em \"Novo Item\" para começar."
                : "Você ainda não foi autorizado a ver nenhum item."
              : "Nenhum item corresponde à busca."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleItems.map((it) => {
            const show = revealed[it.id];
            const viewerNames = isAdmin ? getViewerNames(it.id) : "";
            return (
              <div
                key={it.id}
                className="border border-border/60 rounded-lg p-4 bg-card hover:border-primary/40 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {it.is_favorite && (
                        <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
                      )}
                      <h3 className="font-display text-base text-foreground truncate">
                        {it.title}
                      </h3>
                      {it.category && (
                        <span className="text-[10px] font-body bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                          {it.category}
                        </span>
                      )}
                    </div>
                    {it.url && (
                      <a
                        href={it.url.startsWith("http") ? it.url : `https://${it.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-body text-primary hover:underline inline-flex items-center gap-1 mt-1 truncate"
                      >
                        {it.url} <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(it)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(it.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {it.username && (
                    <div className="flex items-center gap-2 text-xs font-body">
                      <span className="text-muted-foreground w-20">Usuário</span>
                      <span className="flex-1 font-mono text-foreground truncate">{it.username}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(it.username, "Usuário")}
                      >
                        <Copy size={12} />
                      </Button>
                    </div>
                  )}
                  {it.password && (
                    <div className="flex items-center gap-2 text-xs font-body">
                      <span className="text-muted-foreground w-20">Senha</span>
                      <span className="flex-1 font-mono text-foreground truncate">
                        {show ? it.password : "••••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setRevealed((r) => ({ ...r, [it.id]: !r[it.id] }))}
                      >
                        {show ? <EyeOff size={12} /> : <Eye size={12} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(it.password, "Senha")}
                      >
                        <Copy size={12} />
                      </Button>
                    </div>
                  )}
                  {it.notes && (
                    <div className="text-xs font-body text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap">
                      {it.notes}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div className="pt-2 border-t border-border/40 text-[11px] font-body text-muted-foreground flex items-center gap-1">
                    <Users size={11} />
                    <span className="truncate">
                      Visível para: {viewerNames || <em>somente admins</em>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => (o ? setFormOpen(true) : closeForm())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Editar Item" : "Novo Item do Cofre"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Título *</Label>
                <Input
                  value={form.title ?? ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Conta Google Ads"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Categoria</Label>
                <Input
                  value={form.category ?? ""}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ex.: Redes Sociais, Bancos..."
                  list="vault-categories"
                />
                <datalist id="vault-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="font-body text-xs">URL</Label>
                <Input
                  value={form.url ?? ""}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Usuário / E-mail</Label>
                <Input
                  value={form.username ?? ""}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-xs">Senha</Label>
                <Input
                  type="text"
                  value={form.password ?? ""}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="font-body text-xs">Observações</Label>
                <Textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Códigos de backup, 2FA, instruções..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                <Checkbox
                  checked={form.is_favorite ?? false}
                  onCheckedChange={(v) => setForm({ ...form, is_favorite: !!v })}
                />
                <span className="text-xs font-body">Marcar como favorito</span>
              </label>
            </div>

            {/* Viewers selector */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="font-body text-xs font-semibold flex items-center gap-1">
                <Users size={12} /> Usuários autorizados a ver este item
              </Label>
              <p className="text-[11px] font-body text-muted-foreground">
                Administradores sempre têm acesso. Selecione abaixo os demais usuários que poderão visualizar este item.
              </p>
              <Popover open={viewerDropdownOpen} onOpenChange={setViewerDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-auto min-h-[2.25rem] text-xs font-body font-normal px-3 py-1.5"
                  >
                    <span className="text-left truncate">
                      {selectedViewers.length === 0
                        ? "Nenhum usuário adicional (apenas admins)"
                        : `${selectedViewers.length} usuário(s) autorizado(s)`}
                    </span>
                    <ChevronDown size={14} className="shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <div className="p-2 border-b border-border/50">
                    <div className="relative">
                      <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar usuário ou função..."
                        value={viewerSearch}
                        onChange={(e) => setViewerSearch(e.target.value)}
                        className="h-8 text-xs pl-7 pr-7"
                      />
                      {viewerSearch && (
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setViewerSearch("")}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto p-1">
                    {filteredProfiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-body text-center py-3">
                        Nenhum usuário encontrado.
                      </p>
                    ) : (
                      filteredProfiles
                        .filter((p) => (p.role ?? "") !== "admin")
                        .map((p) => {
                          const roleLabel = ROLE_LABELS[p.role ?? ""] ?? p.role ?? "";
                          return (
                            <label
                              key={p.user_id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded px-2 py-1.5"
                            >
                              <Checkbox
                                checked={selectedViewers.includes(p.user_id)}
                                onCheckedChange={() => toggleViewer(p.user_id)}
                              />
                              <span className="text-xs font-body">
                                {p.full_name}
                                {roleLabel && (
                                  <span className="text-muted-foreground"> — {roleLabel}</span>
                                )}
                              </span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedViewers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedViewers.map((uid) => {
                    const p = profilesWithRoles.find((pr) => pr.user_id === uid);
                    if (!p) return null;
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 text-[10px] font-body bg-muted rounded-full px-2 py-0.5"
                      >
                        {p.full_name}
                        <button
                          type="button"
                          onClick={() => toggleViewer(uid)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item do cofre?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item e todas as autorizações de acesso serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
