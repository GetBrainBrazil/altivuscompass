import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera } from "lucide-react";
import { Link } from "react-router-dom";

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
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

export default function MyProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    cep: "", address_street: "", address_number: "", address_complement: "",
    neighborhood: "", city: "", state: "", country: "Brasil",
    emergency_contact_name: "", emergency_contact_phone: "",
    health_plan: "",
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  if (profile && !initialized) {
    setForm({
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      cep: profile.cep ?? "",
      address_street: profile.address_street ?? "",
      address_number: profile.address_number ?? "",
      address_complement: profile.address_complement ?? "",
      neighborhood: profile.neighborhood ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      country: profile.country ?? "Brasil",
      emergency_contact_name: profile.emergency_contact_name ?? "",
      emergency_contact_phone: profile.emergency_contact_phone ?? "",
      health_plan: profile.health_plan ?? "",
    });
    setAvatarPreview(getAvatarUrl(profile.avatar_url));
    setInitialized(true);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCepBlur = async () => {
    if (!form.cep || form.country !== "Brasil") return;
    setLoadingCep(true);
    const data = await fetchCep(form.cep);
    if (data) setForm(f => ({ ...f, ...data }));
    setLoadingCep(false);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");

      let avatarPath: string | undefined;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (error) throw error;
        avatarPath = path;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
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
          ...(avatarPath ? { avatar_url: avatarPath } : {}),
        } as any)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado" });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["header-profile"] });
      setAvatarFile(null);
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Senhas não coincidem");
      if (newPassword.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Senha alterada com sucesso" });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground font-body">Carregando...</div>;
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft size={18} /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground font-body">Gerencie suas informações pessoais.</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {avatarPreview ? <AvatarImage src={avatarPreview} /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-medium">
                {form.full_name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md"
            >
              <Camera size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFileChange} />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-foreground">{profile?.full_name}</p>
            <p className="text-sm text-muted-foreground font-body">{profile?.email}</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); updateProfileMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Nome completo</Label>
              <Input value={form.full_name} onChange={set("full_name")} required />
            </div>
            <div className="space-y-2">
              <Label className="font-body">E-mail</Label>
              <Input value={form.email} disabled className="opacity-60" />
              <p className="text-[10px] text-muted-foreground font-body">O e-mail não pode ser alterado.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Celular</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Plano de Saúde</Label>
              <Input value={form.health_plan} onChange={set("health_plan")} placeholder="Ex: Unimed, SulAmérica" />
            </div>
          </div>

          {/* Address */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold font-body text-foreground">Endereço</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-body">CEP</Label>
                <Input value={form.cep} onChange={set("cep")} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} />
                {loadingCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
              </div>
              <div className="space-y-2">
                <Label className="font-body">País</Label>
                <Input value={form.country} onChange={set("country")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label className="font-body">Endereço</Label>
                <Input value={form.address_street} onChange={set("address_street")} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Número</Label>
                <Input value={form.address_number} onChange={set("address_number")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-body">Complemento</Label>
                <Input value={form.address_complement} onChange={set("address_complement")} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Bairro</Label>
                <Input value={form.neighborhood} onChange={set("neighborhood")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-body">Cidade</Label>
                <Input value={form.city} onChange={set("city")} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Estado</Label>
                <Input value={form.state} onChange={set("state")} />
              </div>
            </div>
          </div>

          {/* Emergency contact */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold font-body text-foreground">Contato de Emergência</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-body">Nome</Label>
                <Input value={form.emergency_contact_name} onChange={set("emergency_contact_name")} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Telefone</Label>
                <Input value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfileMutation.isPending} className="font-body">
              {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-display font-semibold text-foreground">Alterar Senha</h2>
        <form onSubmit={(e) => { e.preventDefault(); changePasswordMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body">Nova senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Confirmar nova senha</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={changePasswordMutation.isPending} className="font-body">
              {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
