import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Tables } from "@/integrations/supabase/types";

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default", manager: "secondary", sales_agent: "outline", operations: "outline",
};

type ProfileWithRole = Tables<"profiles"> & { role: string };

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

function AvatarUpload({ currentUrl, onFileSelect, label }: { currentUrl: string | null; onFileSelect: (file: File | null) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onFileSelect(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="font-body">{label ?? "Foto"}</Label>
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {preview ? <AvatarImage src={preview} /> : null}
          <AvatarFallback className="bg-muted text-muted-foreground text-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" /></svg>
          </AvatarFallback>
        </Avatar>
        <div>
          <Button type="button" variant="outline" size="sm" className="font-body" onClick={() => inputRef.current?.click()}>
            Escolher foto
          </Button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Máx 2MB.</p>
        </div>
      </div>
    </div>
  );
}

async function uploadAvatar(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export default function UserManagement({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("sales_agent");
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<ProfileWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwUser, setPwUser] = useState<ProfileWithRole | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const { data: profilesData, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      const { data: rolesData } = await supabase.from("user_roles").select("*");
      return (profilesData ?? []).map((p: Tables<"profiles">) => ({
        ...p,
        role: rolesData?.find((r: Tables<"user_roles">) => r.user_id === p.user_id)?.role ?? "sem função",
      }));
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: newEmail.trim(), password: newPassword, full_name: newName.trim(), role: newRole },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      // Upload avatar if provided
      if (newAvatarFile && response.data?.user_id) {
        const avatarPath = await uploadAvatar(newAvatarFile, response.data.user_id);
        await supabase.functions.invoke("manage-users", {
          body: { action: "update", user_id: response.data.user_id, avatar_url: avatarPath },
        });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Usuário criado", description: `${newEmail} foi adicionado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      setCreateOpen(false); setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("sales_agent"); setNewAvatarFile(null);
    },
    onError: (err: Error) => toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" }),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      let avatarPath: string | undefined;
      if (editAvatarFile) {
        avatarPath = await uploadAvatar(editAvatarFile, editUser.user_id);
      }
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "update", user_id: editUser.user_id, full_name: editName.trim(), role: editRole, ...(avatarPath ? { avatar_url: avatarPath } : {}) },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado" });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      setEditOpen(false); setEditAvatarFile(null);
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!pwUser) return;
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "change_password", user_id: pwUser.user_id, new_password: newPw },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Senha alterada com sucesso" });
      setPwOpen(false); setNewPw(""); setConfirmPw("");
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    },
    onSuccess: () => {
      toast({ title: "Usuário removido" });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openEdit = (profile: ProfileWithRole) => { setEditUser(profile); setEditName(profile.full_name); setEditRole(profile.role); setEditAvatarFile(null); setEditOpen(true); };
  const openPasswordChange = (profile: ProfileWithRole) => { setPwUser(profile); setNewPw(""); setConfirmPw(""); setPwOpen(true); };

  return (
    <div className={embedded ? "space-y-4" : "max-w-5xl mx-auto space-y-4 sm:space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground">Gestão de Usuários</h1>
            <p className="text-sm text-muted-foreground font-body">Gerencie usuários, permissões e senhas.</p>
          </div>
        )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-body w-full sm:w-auto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">Criar Novo Usuário</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(); }} className="space-y-4">
              <AvatarUpload currentUrl={null} onFileSelect={setNewAvatarFile} />
              <div className="space-y-2"><Label className="font-body">Nome completo</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
              <div className="space-y-2"><Label className="font-body">E-mail</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required /></div>
              <div className="space-y-2"><Label className="font-body">Senha</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} /></div>
              <div className="space-y-2">
                <Label className="font-body">Função</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full font-body" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>


      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body w-[60px]">Foto</TableHead>
              <TableHead className="font-body">Nome</TableHead>
              <TableHead className="font-body">E-mail</TableHead>
              <TableHead className="font-body">Função</TableHead>
              <TableHead className="font-body text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-body py-8">Carregando...</TableCell></TableRow>
            ) : profiles?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-body py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            ) : (
              profiles?.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9">
                      {profile.avatar_url ? <AvatarImage src={getAvatarUrl(profile.avatar_url)!} /> : null}
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                        {profile.full_name?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-body font-medium">{profile.full_name}</TableCell>
                  <TableCell className="font-body text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[profile.role] ?? "outline"} className="font-body">
                      {ROLE_LABELS[profile.role] ?? profile.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" className="font-body" onClick={() => openEdit(profile)}>Editar</Button>
                    <Button variant="ghost" size="sm" className="font-body" onClick={() => openPasswordChange(profile)}>Senha</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive font-body" onClick={() => { if (confirm("Remover?")) deleteUserMutation.mutate(profile.user_id); }}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : profiles?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum usuário encontrado.</div>
        ) : (
          profiles?.map((profile) => (
            <div key={profile.id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  {profile.avatar_url ? <AvatarImage src={getAvatarUrl(profile.avatar_url)!} /> : null}
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                    {profile.full_name?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-body text-foreground">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground font-body">{profile.email}</p>
                </div>
                <Badge variant={roleBadgeVariant[profile.role] ?? "outline"} className="font-body">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="font-body flex-1" onClick={() => openEdit(profile)}>Editar</Button>
                <Button variant="outline" size="sm" className="font-body flex-1" onClick={() => openPasswordChange(profile)}>Senha</Button>
                <Button variant="ghost" size="sm" className="text-destructive font-body" onClick={() => { if (confirm("Remover?")) deleteUserMutation.mutate(profile.user_id); }}>✕</Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Editar Usuário</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate(); }} className="space-y-4">
            <AvatarUpload currentUrl={editUser?.avatar_url ? getAvatarUrl(editUser.avatar_url) : null} onFileSelect={setEditAvatarFile} />
            <div className="space-y-2"><Label className="font-body">Nome completo</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
            <div className="space-y-2">
              <Label className="font-body">Função</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full font-body" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Alterar Senha</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground font-body">Alterando senha de: <strong>{pwUser?.email}</strong></p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (newPw !== confirmPw) { toast({ title: "Senhas não coincidem", variant: "destructive" }); return; }
            changePasswordMutation.mutate();
          }} className="space-y-4">
            <div className="space-y-2"><Label className="font-body">Nova senha</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} /></div>
            <div className="space-y-2"><Label className="font-body">Confirmar nova senha</Label><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} /></div>
            <Button type="submit" className="w-full font-body" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
