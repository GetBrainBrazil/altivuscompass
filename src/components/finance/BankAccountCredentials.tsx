import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, EyeOff, Users, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Tables } from "@/integrations/supabase/types";

type Credential = {
  id: string;
  bank_account_id: string;
  login_username: string | null;
  access_password: string | null;
  transaction_password: string | null;
  has_facial: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CredentialViewer = {
  id: string;
  credential_id: string;
  user_id: string;
};

type ProfileWithRole = Tables<"profiles"> & { role?: string };

export default function BankAccountCredentials({ bankAccountId }: { bankAccountId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [selectedViewers, setSelectedViewers] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [viewerSearch, setViewerSearch] = useState("");
  const [viewerDropdownOpen, setViewerDropdownOpen] = useState(false);
  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["bank-credentials", bankAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_account_credentials")
        .select("*")
        .eq("bank_account_id", bankAccountId)
        .order("created_at");
      if (error) throw error;
      return data as Credential[];
    },
  });

  const { data: allViewers = [] } = useQuery({
    queryKey: ["bank-credential-viewers", bankAccountId],
    queryFn: async () => {
      const credIds = credentials.map((c) => c.id);
      if (credIds.length === 0) return [];
      const { data, error } = await supabase
        .from("bank_account_credential_viewers")
        .select("*")
        .in("credential_id", credIds);
      if (error) throw error;
      return data as CredentialViewer[];
    },
    enabled: credentials.length > 0,
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
      }));
    },
  });

  const filteredProfiles = useMemo(() => {
    if (!viewerSearch.trim()) return profilesWithRoles;
    const q = viewerSearch.toLowerCase();
    return profilesWithRoles.filter((p) => {
      const roleLabel = ROLE_LABELS[p.role] ?? p.role;
      return p.full_name.toLowerCase().includes(q) || roleLabel.toLowerCase().includes(q);
    });
  }, [profilesWithRoles, viewerSearch]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bank_account_id: bankAccountId,
        login_username: form.login_username || null,
        access_password: form.access_password || null,
        transaction_password: form.transaction_password || null,
        has_facial: form.has_facial ?? false,
        notes: form.notes || null,
      };

      let credentialId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("bank_account_credentials")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        // Remove old viewers
        await supabase
          .from("bank_account_credential_viewers")
          .delete()
          .eq("credential_id", editingId);
      } else {
        const { data, error } = await supabase
          .from("bank_account_credentials")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        credentialId = data.id;
      }

      // Insert viewers
      if (selectedViewers.length > 0 && credentialId) {
        const rows = selectedViewers.map((uid) => ({
          credential_id: credentialId!,
          user_id: uid,
        }));
        const { error } = await supabase
          .from("bank_account_credential_viewers")
          .insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Acesso atualizado" : "Acesso criado" });
      queryClient.invalidateQueries({ queryKey: ["bank-credentials", bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ["bank-credential-viewers", bankAccountId] });
      closeForm();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_account_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Acesso removido" });
      queryClient.invalidateQueries({ queryKey: ["bank-credentials", bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ["bank-credential-viewers", bankAccountId] });
      closeForm();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ has_facial: false });
    setSelectedViewers([]);
    setFormOpen(true);
  };

  const openEdit = (cred: Credential) => {
    setEditingId(cred.id);
    setForm({
      login_username: cred.login_username ?? "",
      access_password: cred.access_password ?? "",
      transaction_password: cred.transaction_password ?? "",
      has_facial: cred.has_facial,
      notes: cred.notes ?? "",
    });
    const viewers = allViewers.filter((v) => v.credential_id === cred.id).map((v) => v.user_id);
    setSelectedViewers(viewers);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({});
    setSelectedViewers([]);
    setShowPassword({});
  };

  const toggleViewer = (userId: string) => {
    setSelectedViewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getViewerNames = (credId: string) => {
    const viewerIds = allViewers.filter((v) => v.credential_id === credId).map((v) => v.user_id);
    return profilesWithRoles
      .filter((p) => viewerIds.includes(p.user_id))
      .map((p) => {
        const roleLabel = ROLE_LABELS[p.role] ?? p.role;
        return `${p.full_name}${roleLabel ? ` (${roleLabel})` : ""}`;
      })
      .join(", ");
  };

  if (isLoading) return <p className="text-xs text-muted-foreground font-body">Carregando acessos...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-body font-semibold text-sm">Acessos</Label>
        <Button type="button" variant="outline" size="sm" onClick={openCreate} className="font-body text-xs h-7">
          <Plus size={12} className="mr-1" /> Novo Acesso
        </Button>
      </div>

      {credentials.length === 0 && !formOpen && (
        <p className="text-xs text-muted-foreground font-body">Nenhum acesso cadastrado.</p>
      )}

      {/* List existing credentials */}
      {credentials.map((cred) => (
        <div key={cred.id} className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-body font-medium text-foreground hover:text-primary transition-colors"
              onClick={() => setExpandedId(expandedId === cred.id ? null : cred.id)}
            >
              {expandedId === cred.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {cred.login_username || "Acesso sem usuário"}
            </button>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(cred)} className="h-7 text-xs font-body">
                Editar
              </Button>
            </div>
          </div>

          {expandedId === cred.id && (
            <div className="grid grid-cols-2 gap-2 text-xs font-body text-muted-foreground pt-1">
              <div><span className="font-medium text-foreground">Usuário:</span> {cred.login_username || "—"}</div>
              <div><span className="font-medium text-foreground">Facial:</span> {cred.has_facial ? "Sim" : "Não"}</div>
              <div className="col-span-2">
                <span className="font-medium text-foreground">
                  <Users size={12} className="inline mr-1" />Visível para:
                </span>{" "}
                {getViewerNames(cred.id) || "Ninguém"}
              </div>
              {cred.notes && (
                <div className="col-span-2"><span className="font-medium text-foreground">Obs:</span> {cred.notes}</div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Create/Edit form */}
      {formOpen && (
        <div className="border border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
          <p className="text-sm font-body font-semibold text-foreground">
            {editingId ? "Editar Acesso" : "Novo Acesso"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-body text-xs">Usuário</Label>
              <Input
                value={form.login_username ?? ""}
                onChange={(e) => setForm({ ...form, login_username: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Senha de Acesso</Label>
              <div className="relative">
                <Input
                  type={showPassword.access ? "text" : "password"}
                  value={form.access_password ?? ""}
                  onChange={(e) => setForm({ ...form, access_password: e.target.value })}
                  className="h-8 text-sm pr-8"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword({ ...showPassword, access: !showPassword.access })}
                >
                  {showPassword.access ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-body text-xs">Senha de Transação</Label>
              <div className="relative">
                <Input
                  type={showPassword.transaction ? "text" : "password"}
                  value={form.transaction_password ?? ""}
                  onChange={(e) => setForm({ ...form, transaction_password: e.target.value })}
                  className="h-8 text-sm pr-8"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword({ ...showPassword, transaction: !showPassword.transaction })}
                >
                  {showPassword.transaction ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={form.has_facial ?? false}
                onCheckedChange={(v) => setForm({ ...form, has_facial: v })}
              />
              <Label className="font-body text-xs">Facial</Label>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label className="font-body text-xs">Observações</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label className="font-body text-xs font-semibold flex items-center gap-1">
                <Users size={12} /> Visível para
              </Label>
              <Popover open={viewerDropdownOpen} onOpenChange={setViewerDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between h-auto min-h-[2rem] text-xs font-body font-normal px-3 py-1.5">
                    <span className="text-left truncate">
                      {selectedViewers.length === 0
                        ? "Selecione usuários..."
                        : `${selectedViewers.length} usuário(s) selecionado(s)`}
                    </span>
                    <ChevronDown size={14} className="shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
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
                  <div className="max-h-48 overflow-y-auto p-1">
                    {filteredProfiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-body text-center py-3">Nenhum usuário encontrado.</p>
                    ) : (
                      filteredProfiles.map((p) => {
                        const roleLabel = ROLE_LABELS[p.role] ?? p.role;
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
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedViewers.map((uid) => {
                    const p = profilesWithRoles.find((pr) => pr.user_id === uid);
                    if (!p) return null;
                    return (
                      <span key={uid} className="inline-flex items-center gap-1 text-[10px] font-body bg-muted rounded-full px-2 py-0.5">
                        {p.full_name}
                        <button type="button" onClick={() => toggleViewer(uid)} className="hover:text-destructive">
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {editingId ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="font-body text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={12} className="mr-1" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(editingId)}>Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeForm} className="font-body text-xs h-7">
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="font-body text-xs h-7"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar Acesso"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
