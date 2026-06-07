import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  ArrowLeft,
  Trash2,
  Eye,
  EyeOff,
  Users,
  ChevronDown,
  Search,
  X,
  Copy,
  Shield,
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

export default function VaultEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = user?.id ?? "";

  const [form, setForm] = useState<Partial<VaultItem>>({ is_favorite: false });
  const [draftViewers, setDraftViewers] = useState<ViewerDraft[]>([]);
  const [viewerSearch, setViewerSearch] = useState("");
  const [viewerDropdownOpen, setViewerDropdownOpen] = useState(false);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: editingItem, isLoading: loadingItem } = useQuery({
    queryKey: ["vault-item", id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_items").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as VaultItem | null;
    },
  });

  const { data: itemViewers = [] } = useQuery({
    queryKey: ["vault-item-viewers", id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_item_viewers")
        .select("*")
        .eq("vault_item_id", id!);
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

  const { data: categories = [] } = useQuery({
    queryKey: ["vault-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_items").select("category");
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { category: string | null }) => r.category && set.add(r.category));
      return Array.from(set).sort();
    },
  });

  useEffect(() => {
    if (editingItem) {
      setForm({ ...editingItem });
      setDraftViewers(
        itemViewers.map((v) => ({ user_id: v.user_id, can_edit: v.can_edit })),
      );
    }
  }, [editingItem, itemViewers]);

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
      return p.full_name.toLowerCase().includes(q) || roleLabel.toLowerCase().includes(q);
    });
  }, [profilesWithRoles, viewerSearch, currentUserId]);

  const ownerCanManageDraft = isNew || editingItem?.created_by === currentUserId;
  const isOwner = !isNew && editingItem?.created_by === currentUserId;

  const goBack = () => navigate("/vault");

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

      let itemId = editingItem?.id ?? crypto.randomUUID();

      if (editingItem) {
        const { error } = await supabase
          .from("vault_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vault_items")
          .insert({ id: itemId, ...payload, created_by: currentUserId });
        if (error) throw error;
      }

      if (ownerCanManageDraft && itemId) {
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
      queryClient.invalidateQueries({ queryKey: ["vault-item", id] });
      goBack();
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      const { error } = await supabase.from("vault_items").delete().eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Item removido" });
      queryClient.invalidateQueries({ queryKey: ["vault-items"] });
      queryClient.invalidateQueries({ queryKey: ["vault-viewers"] });
      goBack();
    },
    onError: (err: Error) =>
      toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

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

  if (!isNew && loadingItem) {
    return <p className="container mx-auto p-6 text-sm font-body text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goBack} className="font-body">
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
        <h1 className="text-xl sm:text-2xl font-display text-foreground flex items-center gap-2">
          <Shield className="text-primary" size={22} />
          {isNew ? "Novo Item do Cofre" : "Editar Item"}
        </h1>
      </div>

      <div className="border border-border rounded-lg bg-card shadow-sm p-4 space-y-4">
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
                >
                  {showFormPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => copyToClipboard(form.password ?? "", "Senha")}
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
                          onClick={() => {
                            addViewer(p.user_id);
                            setViewerDropdownOpen(false);
                          }}
                          className="w-full text-left text-xs font-body hover:bg-muted/40 disabled:opacity-50 rounded px-2 py-1.5 flex items-center justify-between"
                        >
                          <span>
                            {p.full_name}
                            {roleLabel && (
                              <span className="text-muted-foreground"> — {roleLabel}</span>
                            )}
                          </span>
                          {already && (
                            <span className="text-[10px] text-muted-foreground">Adicionado</span>
                          )}
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
                    <div
                      key={v.user_id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
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
            Você tem permissão de edição neste item, mas apenas o criador pode gerenciar quem mais vê
            este registro.
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <div>
            {isOwner && (
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                <Trash2 size={14} className="mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={goBack}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
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
              onClick={() => deleteMutation.mutate()}
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
  const canCreate =
    trimmed.length > 0 && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

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
          className="w-full inline-flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background text-sm font-body hover:bg-accent/40"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value || "Selecione ou crie uma tag..."}
          </span>
          <ChevronDown size={14} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <div className="relative p-2 border-b border-border">
          <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ou criar..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
              Nenhuma tag
            </div>
          )}
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => commit(o)}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted/60"
            >
              {o}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(trimmed)}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-muted/60 text-primary"
            >
              Criar "{trimmed}"
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
