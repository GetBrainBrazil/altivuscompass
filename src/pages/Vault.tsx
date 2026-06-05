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
  Star,
  ExternalLink,
  Shield,
  Pencil,
  Lock,
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

type Viewer = { id: string; vault_item_id: string; user_id: string; can_edit: boolean };
type ProfileWithRole = Tables<"profiles"> & { role?: string };
type ViewerDraft = { user_id: string; can_edit: boolean };

export default function Vault() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = user?.id ?? "";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine" | "shared">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [form, setForm] = useState<Partial<VaultItem>>({});
  const [draftViewers, setDraftViewers] = useState<ViewerDraft[]>([]);
  const [viewerSearch, setViewerSearch] = useState("");
  const [viewerDropdownOpen, setViewerDropdownOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);

  const { data: items = [], isLoading, error: itemsError, refetch: refetchItems } = useQuery({
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

  const { data: viewers = [], error: viewersError } = useQuery({
    queryKey: ["vault-viewers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_item_viewers").select("*");
      if (error) throw error;
      return data as Viewer[];
    },
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
  });

  const profileById = useMemo(() => {
    const m = new Map<string, ProfileWithRole>();
    profilesWithRoles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profilesWithRoles]);

  const filteredProfiles = useMemo(() => {
    const others = profilesWithRoles.filter((p) => p.user_id !== currentUserId);
    if (!viewerSearch.trim()) return others;
    const q = viewerSearch.toLowerCase();
    return others.filter((p) => {
      const roleLabel = ROLE_LABELS[p.role ?? ""] ?? p.role ?? "";
      return (
        p.full_name.toLowerCase().includes(q) || roleLabel.toLowerCase().includes(q)
      );
    });
  }, [profilesWithRoles, viewerSearch, currentUserId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  const canEditItem = (it: VaultItem) =>
    it.created_by === currentUserId ||
    viewers.some((v) => v.vault_item_id === it.id && v.user_id === currentUserId && v.can_edit);

  const isOwner = (it: VaultItem) => it.created_by === currentUserId;

  const visibleItems = useMemo(() => {
    let list = items;
    if (ownerFilter === "mine") list = list.filter((i) => isOwner(i));
    if (ownerFilter === "shared") list = list.filter((i) => !isOwner(i));
    if (categoryFilter !== "all") list = list.filter((i) => (i.category ?? "") === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.username ?? "").toLowerCase().includes(q) ||
          (i.url ?? "").toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q) ||
          (i.category ?? "").toLowerCase().includes(q),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search, categoryFilter, ownerFilter, currentUserId]);

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

      let itemId = editingItem?.id ?? null;
      const ownerControlsAccess = !editingItem || editingItem.created_by === currentUserId;

      if (editingItem) {
        const { error } = await supabase
          .from("vault_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("vault_items")
          .insert({ ...payload, created_by: currentUserId })
          .select("id")
          .single();
        if (error) throw error;
        itemId = data.id;
      }

      if (ownerControlsAccess && itemId) {
        await supabase.from("vault_item_viewers").delete().eq("vault_item_id", itemId);
        if (draftViewers.length > 0) {
          const rows = draftViewers.map((v) => ({
            vault_item_id: itemId!,
            user_id: v.user_id,
            can_edit: v.can_edit,
          }));
          const { error } = await supabase.from("vault_item_viewers").insert(rows);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingItem ? "Item atualizado" : "Item criado" });
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
      closeForm();
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm({ is_favorite: false });
    setDraftViewers([]);
    setShowFormPassword(false);
    setFormOpen(true);
  };

  const openEdit = (it: VaultItem) => {
    if (!canEditItem(it)) return;
    setEditingItem(it);
    setForm({ ...it });
    setShowFormPassword(false);
    setDraftViewers(
      viewers
        .filter((v) => v.vault_item_id === it.id)
        .map((v) => ({ user_id: v.user_id, can_edit: v.can_edit })),
    );
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingItem(null);
    setForm({});
    setDraftViewers([]);
    setViewerSearch("");
  };

  const addViewer = (uid: string) =>
    setDraftViewers((prev) =>
      prev.some((v) => v.user_id === uid) ? prev : [...prev, { user_id: uid, can_edit: false }],
    );
  const removeViewer = (uid: string) =>
    setDraftViewers((prev) => prev.filter((v) => v.user_id !== uid));
  const toggleViewerEdit = (uid: string) =>
    setDraftViewers((prev) =>
      prev.map((v) => (v.user_id === uid ? { ...v, can_edit: !v.can_edit } : v)),
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

  const ownerCanManageDraft = !editingItem || editingItem.created_by === currentUserId;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground flex items-center gap-2">
            <Shield className="text-primary" size={26} />
            Cofre de Senhas
          </h1>
          <p className="text-sm font-body text-muted-foreground mt-1">
            Senhas e acessos são privados por padrão. Quem cria escolhe quem mais pode ver ou editar.
          </p>
        </div>
        <Button onClick={openCreate} className="font-body">
          <Plus size={16} className="mr-1" /> Novo Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, usuário, URL, observações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-body"
          />
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {(["all", "mine", "shared"] as const).map((k) => (
            <Button
              key={k}
              type="button"
              variant={ownerFilter === k ? "default" : "outline"}
              size="sm"
              onClick={() => setOwnerFilter(k)}
              className="font-body text-xs h-9"
            >
              {k === "all" ? "Todos" : k === "mine" ? "Meus" : "Compartilhados"}
            </Button>
          ))}
          {categories.length > 0 && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <Button
                type="button"
                variant={categoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter("all")}
                className="font-body text-xs h-9"
              >
                Todas as tags
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
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-sm font-body text-muted-foreground">Carregando...</p>
      ) : itemsError || viewersError ? (
        <div className="border border-dashed border-destructive/40 rounded-lg p-10 text-center space-y-3">
          <Lock className="mx-auto text-destructive" size={28} />
          <div className="space-y-1">
            <p className="text-sm font-body text-foreground">Não foi possível carregar o cofre agora.</p>
            <p className="text-xs font-body text-muted-foreground">
              {(itemsError ?? viewersError)?.message ?? "Tente novamente em instantes."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => refetchItems()} className="font-body">
            Tentar novamente
          </Button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <Lock className="mx-auto text-muted-foreground mb-3" size={28} />
          <p className="text-sm font-body text-muted-foreground">
            {items.length === 0
              ? "Nenhum item no cofre ainda. Clique em \"Novo Item\" para começar."
              : "Nenhum item corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 w-8"></th>
                  <th className="px-3 py-2.5">Título</th>
                  <th className="px-3 py-2.5">Tag</th>
                  <th className="px-3 py-2.5">Usuário</th>
                  <th className="px-3 py-2.5">Senha</th>
                  <th className="px-3 py-2.5">URL</th>
                  <th className="px-3 py-2.5">Compartilhado</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((it) => {
                  const show = revealed[it.id];
                  const editable = canEditItem(it);
                  const itemViewers = viewers.filter((v) => v.vault_item_id === it.id);
                  const sharedNames = itemViewers
                    .map((v) => profileById.get(v.user_id)?.full_name)
                    .filter(Boolean) as string[];
                  return (
                    <tr
                      key={it.id}
                      onClick={() => editable && openEdit(it)}
                      className={`border-b border-border/60 last:border-0 transition-colors ${
                        editable ? "hover:bg-muted/30 cursor-pointer" : "hover:bg-muted/10"
                      }`}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        {it.is_favorite ? (
                          <Star size={14} className="text-amber-500 fill-amber-500" />
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="font-medium text-foreground truncate max-w-[260px]">
                          {it.title}
                        </div>
                        {it.notes && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                            {it.notes.replace(/\s+/g, " ").slice(0, 80)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {it.category ? (
                          <span className="inline-flex text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                            {it.category}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {it.username ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono text-xs truncate max-w-[160px]">{it.username}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(it.username, "Usuário")}
                            >
                              <Copy size={11} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {it.password ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="font-mono text-xs truncate max-w-[140px]">
                              {show ? it.password : "••••••••"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => setRevealed((r) => ({ ...r, [it.id]: !r[it.id] }))}
                            >
                              {show ? <EyeOff size={11} /> : <Eye size={11} />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(it.password, "Senha")}
                            >
                              <Copy size={11} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {it.url ? (
                          <a
                            href={it.url.startsWith("http") ? it.url : `https://${it.url}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline inline-flex items-center gap-1 text-xs truncate max-w-[180px]"
                          >
                            {it.url} <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {sharedNames.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                            <Lock size={10} /> Privado
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 max-w-[220px] truncate"
                            title={sharedNames.join(", ")}
                          >
                            <Users size={10} />
                            {sharedNames.length === 1
                              ? sharedNames[0]
                              : `${sharedNames.length} usuários`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => (o ? setFormOpen(true) : closeForm())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingItem ? "Editar Item" : "Novo Item do Cofre"}
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
                <CategoryPicker
                  value={form.category ?? ""}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={categories}
                />
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
                <div className="relative">
                  <Input
                    type={showFormPassword ? "text" : "password"}
                    value={form.password ?? ""}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="font-mono pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowFormPassword((s) => !s)}
                      title={showFormPassword ? "Ocultar" : "Mostrar"}
                    >
                      {showFormPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => copyToClipboard(form.password ?? "", "Senha")}
                      title="Copiar"
                    >
                      <Copy size={13} />
                    </Button>
                  </div>
                </div>
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
            {ownerCanManageDraft ? (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label className="font-body text-xs font-semibold flex items-center gap-1">
                  <Users size={12} /> Compartilhar com outros usuários
                </Label>
                <p className="text-[11px] font-body text-muted-foreground">
                  Por padrão, apenas você vê este item. Adicione abaixo quem pode visualizar e marque
                  "Editar" para também permitir alterações.
                </p>
                <Popover open={viewerDropdownOpen} onOpenChange={setViewerDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between h-9 text-xs font-body font-normal"
                    >
                      <span>Adicionar usuário...</span>
                      <ChevronDown size={14} className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
                    <div className="p-2 border-b border-border/50">
                      <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar usuário..."
                          value={viewerSearch}
                          onChange={(e) => setViewerSearch(e.target.value)}
                          className="h-8 text-xs pl-7"
                        />
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {filteredProfiles.length === 0 ? (
                        <p className="text-xs text-muted-foreground font-body text-center py-3">
                          Nenhum usuário.
                        </p>
                      ) : (
                        filteredProfiles.map((p) => {
                          const already = draftViewers.some((v) => v.user_id === p.user_id);
                          const roleLabel = ROLE_LABELS[p.role ?? ""] ?? p.role ?? "";
                          return (
                            <button
                              key={p.user_id}
                              type="button"
                              disabled={already}
                              onClick={() => { addViewer(p.user_id); setViewerDropdownOpen(false); }}
                              className="w-full text-left text-xs font-body hover:bg-muted/40 disabled:opacity-50 rounded px-2 py-1.5 flex items-center justify-between"
                            >
                              <span>
                                {p.full_name}
                                {roleLabel && (
                                  <span className="text-muted-foreground"> — {roleLabel}</span>
                                )}
                              </span>
                              {already && <span className="text-[10px] text-muted-foreground">Adicionado</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {draftViewers.length > 0 && (
                  <div className="border border-border/60 rounded-md divide-y divide-border/40">
                    {draftViewers.map((v) => {
                      const p = profileById.get(v.user_id);
                      return (
                        <div key={v.user_id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                          <span className="truncate">{p?.full_name ?? v.user_id}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <Checkbox
                                checked={v.can_edit}
                                onCheckedChange={() => toggleViewerEdit(v.user_id)}
                              />
                              <span>Pode editar</span>
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground"
                              onClick={() => removeViewer(v.user_id)}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] font-body text-muted-foreground pt-2 border-t border-border/40">
                Você tem permissão de edição neste item, mas apenas o criador pode gerenciar quem mais
                vê este registro.
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <div>
              {editingItem && editingItem.created_by === currentUserId && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(editingItem.id)}
                  className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  <Trash2 size={14} className="mr-1" /> Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
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

function CategoryPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const filtered = trimmed
    ? options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : options;
  const canCreate = trimmed.length > 0 && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const commit = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-left text-sm font-body flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
        >
          {value ? (
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
              {value}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onChange(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onChange(""); } }}
                className="hover:text-destructive"
                aria-label="Limpar categoria"
              >
                <X size={11} />
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Selecione ou crie uma tag...</span>
          )}
          <ChevronDown size={14} className="opacity-60 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                commit(trimmed);
              }
            }}
            placeholder="Buscar ou criar..."
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhuma tag</div>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => commit(opt)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors ${value === opt ? "text-primary font-medium" : ""}`}
            >
              {opt}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(trimmed)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors border-t border-border text-primary"
            >
              + Criar "{trimmed}"
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
