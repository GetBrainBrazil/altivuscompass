import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS } from "@/lib/permissions";
import UserContractsTab from "@/components/users/UserContractsTab";
import { ArrowLeft, Camera, Trash2, KeyRound, Save, User as UserIcon, MapPin, FileText, Lock } from "lucide-react";

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

async function uploadAvatar(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

async function fetchCep(cep: string) {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { address_street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" };
  } catch { return null; }
}

export default function UserDetail() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({
    full_name: "", email: "", password: "", role: "sales_agent",
    phone: "", cep: "", address_street: "", address_number: "", address_complement: "",
    neighborhood: "", city: "", state: "", country: "Brasil",
    emergency_contact_name: "", emergency_contact_phone: "", health_plan: "",
  });
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  const { data: userData, isLoading } = useQuery({
    queryKey: ["user-detail", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", id!).maybeSingle();
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", id!).maybeSingle();
      return { ...profile, role: roleRow?.role ?? "sales_agent" };
    },
  });

  useEffect(() => {
    if (userData) {
      setForm({
        full_name: userData.full_name ?? "",
        email: userData.email ?? "",
        password: "",
        role: userData.role ?? "sales_agent",
        phone: userData.phone ?? "",
        cep: userData.cep ?? "",
        address_street: userData.address_street ?? "",
        address_number: userData.address_number ?? "",
        address_complement: userData.address_complement ?? "",
        neighborhood: userData.neighborhood ?? "",
        city: userData.city ?? "",
        state: userData.state ?? "",
        country: userData.country ?? "Brasil",
        emergency_contact_name: userData.emergency_contact_name ?? "",
        emergency_contact_phone: userData.emergency_contact_phone ?? "",
        health_plan: userData.health_plan ?? "",
      });
    }
  }, [userData]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAvatarFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCepBlur = async () => {
    if (!form.cep || form.country !== "Brasil") return;
    setLoadingCep(true);
    const data = await fetchCep(form.cep);
    if (data) setForm({ ...form, ...data });
    setLoadingCep(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const response = await supabase.functions.invoke("manage-users", {
          body: {
            action: "create",
            email: form.email.trim(),
            password: form.password,
            full_name: form.full_name.trim(),
            role: form.role,
            phone: form.phone?.trim() || null,
          },
        });
        if (response.error) throw new Error(response.error.message);
        if (response.data?.error) throw new Error(response.data.error);
        const newId = response.data?.user_id;
        if (avatarFile && newId) {
          const path = await uploadAvatar(avatarFile, newId);
          await supabase.functions.invoke("manage-users", { body: { action: "update", user_id: newId, avatar_url: path } });
        }
        return newId;
      } else {
        let avatarPath: string | undefined;
        if (avatarFile) avatarPath = await uploadAvatar(avatarFile, id!);
        const response = await supabase.functions.invoke("manage-users", {
          body: {
            action: "update",
            user_id: id,
            full_name: form.full_name.trim(),
            role: form.role,
            ...(avatarPath ? { avatar_url: avatarPath } : {}),
            phone: form.phone || null,
            cep: form.cep || null,
            address_street: form.address_street || null,
            address_number: form.address_number || null,
            address_complement: form.address_complement || null,
            neighborhood: form.neighborhood || null,
            city: form.city || null,
            state: form.state || null,
            country: form.country || null,
            emergency_contact_name: form.emergency_contact_name || null,
            emergency_contact_phone: form.emergency_contact_phone || null,
            health_plan: form.health_plan || null,
          },
        });
        if (response.error) throw new Error(response.error.message);
        if (response.data?.error) throw new Error(response.data.error);
        return id;
      }
    },
    onSuccess: (savedId) => {
      toast({ title: isNew ? "Usuário criado" : "Alterações salvas" });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-detail", savedId] });
      if (isNew && savedId) navigate(`/users/${savedId}`);
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPw !== confirmPw) throw new Error("As senhas não coincidem");
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "change_password", user_id: id, new_password: newPw },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Senha alterada com sucesso" });
      setNewPw(""); setConfirmPw("");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("manage-users", { body: { action: "delete", user_id: id } });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Usuário removido" });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      navigate("/system?tab=users");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const currentAvatar = avatarPreview ?? (userData?.avatar_url ? getAvatarUrl(userData.avatar_url) : null);
  const initial = form.full_name?.[0]?.toUpperCase() ?? "U";

  if (!isNew && isLoading) {
    return <div className="max-w-4xl mx-auto p-8 text-center text-muted-foreground font-body">Carregando...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/system?tab=users")}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-body">
            <Link to="/system?tab=users" className="hover:text-foreground transition-colors">Admin</Link>
            <span className="mx-1.5">/</span>
            <span>Usuários</span>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{isNew ? "Novo" : form.full_name || "Editar"}</span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground truncate">
            {isNew ? "Novo Usuário" : form.full_name || "Editar Usuário"}
          </h1>
        </div>
      </div>

      {/* Hero card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-4 ring-background shadow-lg">
              {currentAvatar ? <AvatarImage src={currentAvatar} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-3xl font-display font-semibold">
                {initial}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform"
              aria-label="Alterar foto"
            >
              <Camera size={16} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-semibold text-foreground">
                {form.full_name || "Sem nome"}
              </h2>
              <p className="text-sm text-muted-foreground font-body">{form.email || "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <Badge variant="secondary" className="font-body">{ROLE_LABELS[form.role] ?? form.role}</Badge>
              {form.phone && <Badge variant="outline" className="font-body">{formatPhone(form.phone)}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground font-body">JPG ou PNG. Máx 2MB.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className={`w-full grid ${isNew ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4"}`}>
          <TabsTrigger value="dados" className="font-body gap-2">
            <UserIcon size={14} /> <span className="hidden sm:inline">Dados Pessoais</span><span className="sm:hidden">Dados</span>
          </TabsTrigger>
          {!isNew && (
            <>
              <TabsTrigger value="endereco" className="font-body gap-2">
                <MapPin size={14} /> <span className="hidden sm:inline">Endereço & Emergência</span><span className="sm:hidden">Endereço</span>
              </TabsTrigger>
              <TabsTrigger value="contratos" className="font-body gap-2">
                <FileText size={14} /> Contratos
              </TabsTrigger>
              <TabsTrigger value="senha" className="font-body gap-2">
                <Lock size={14} /> Senha
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Dados pessoais */}
        <TabsContent value="dados" className="mt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="glass-card rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h3 className="text-sm font-display font-semibold text-foreground mb-1">Informações de identificação</h3>
              <p className="text-xs text-muted-foreground font-body">Dados básicos para acesso e contato.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Nome completo</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={!isNew} />
              </div>
              <div className="space-y-2">
                <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Celular</Label>
                <Input
                  value={formatPhone(form.phone ?? "")}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              {isNew && (
                <div className="space-y-2 sm:col-span-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Senha inicial</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                  <p className="text-xs text-muted-foreground font-body">O usuário poderá alterá-la após o primeiro acesso.</p>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Função</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => navigate("/system?tab=users")} className="font-body">
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="font-body gap-2">
                <Save size={16} />
                {saveMutation.isPending ? "Salvando..." : isNew ? "Criar Usuário" : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Endereço */}
        {!isNew && (
          <TabsContent value="endereco" className="mt-6">
            <form
              onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
              className="glass-card rounded-2xl p-6 sm:p-8 space-y-8"
            >
              <div>
                <h3 className="text-sm font-display font-semibold text-foreground mb-1">Endereço</h3>
                <p className="text-xs text-muted-foreground font-body">Informe o CEP para preenchimento automático.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">CEP</Label>
                  <Input value={form.cep ?? ""} onChange={(e) => setForm({ ...form, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} />
                  {loadingCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">País</Label>
                  <Input value={form.country ?? "Brasil"} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Endereço</Label>
                  <Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Número</Label>
                  <Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Complemento</Label>
                  <Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Bairro</Label>
                  <Input value={form.neighborhood ?? ""} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Cidade</Label>
                  <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
                  <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>

              <div className="pt-6 border-t border-border/50 space-y-4">
                <div>
                  <h3 className="text-sm font-display font-semibold text-foreground mb-1">Contato de Emergência</h3>
                  <p className="text-xs text-muted-foreground font-body">Pessoa a ser acionada em caso de necessidade.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Nome</Label>
                    <Input value={form.emergency_contact_name ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Telefone</Label>
                    <Input
                      value={formatPhone(form.emergency_contact_phone ?? "")}
                      onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border/50 space-y-2">
                <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Plano de Saúde</Label>
                <Input value={form.health_plan ?? ""} onChange={(e) => setForm({ ...form, health_plan: e.target.value })} placeholder="Ex: Unimed, SulAmérica" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                <Button type="submit" disabled={saveMutation.isPending} className="font-body gap-2">
                  <Save size={16} />
                  {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </TabsContent>
        )}

        {/* Contratos */}
        {!isNew && (
          <TabsContent value="contratos" className="mt-6">
            <div className="glass-card rounded-2xl p-6 sm:p-8">
              <UserContractsTab userId={id!} />
            </div>
          </TabsContent>
        )}

        {/* Senha */}
        {!isNew && (
          <TabsContent value="senha" className="mt-6">
            <form
              onSubmit={(e) => { e.preventDefault(); passwordMutation.mutate(); }}
              className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 max-w-xl"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound size={18} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-semibold text-foreground">Alterar senha</h3>
                  <p className="text-xs text-muted-foreground font-body">Definindo nova senha para <strong>{form.email}</strong></p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Nova senha</Label>
                  <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Confirmar nova senha</Label>
                  <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border/50">
                <Button type="submit" disabled={passwordMutation.isPending} className="font-body gap-2">
                  <KeyRound size={16} />
                  {passwordMutation.isPending ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </form>
          </TabsContent>
        )}
      </Tabs>

      {/* Danger zone */}
      {!isNew && (
        <div className="glass-card rounded-2xl p-6 sm:p-8 border border-destructive/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-display font-semibold text-destructive mb-1">Zona de perigo</h3>
              <p className="text-xs text-muted-foreground font-body">Esta ação remove permanentemente o usuário e não pode ser desfeita.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive font-body gap-2">
                  <Trash2 size={16} /> Excluir usuário
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso removerá permanentemente <strong>{form.full_name}</strong> ({form.email}). Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
