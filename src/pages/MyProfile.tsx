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
import type { Tables } from "@/integrations/supabase/types";

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export default function MyProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as Tables<"profiles">;
    },
    enabled: !!user,
  });

  if (profile && !initialized) {
    setFullName(profile.full_name);
    setEmail(profile.email ?? "");
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
          full_name: fullName.trim(),
          ...(avatarPath ? { avatar_url: avatarPath } : {}),
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado" });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground font-body">
        Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={18} />
          </Button>
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
                {fullName?.[0]?.toUpperCase() ?? "U"}
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
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="font-body">E-mail</Label>
              <Input value={email} disabled className="opacity-60" />
              <p className="text-[10px] text-muted-foreground font-body">O e-mail não pode ser alterado.</p>
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
