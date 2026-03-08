import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS } from "@/lib/permissions";
import UserContractsTab from "@/components/users/UserContractsTab";
import type { Tables } from "@/integrations/supabase/types";

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default", manager: "secondary", sales_agent: "outline", operations: "outline",
};

type ProfileWithRole = Tables<"profiles"> & { role: string; phone?: string | null; cep?: string | null; address_street?: string | null; address_number?: string | null; address_complement?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null; country?: string | null; emergency_contact_name?: string | null; emergency_contact_phone?: string | null; health_plan?: string | null };

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

// CEP auto-fill
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

// Address fields component
function AddressFields({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const [loadingCep, setLoadingCep] = useState(false);

  const handleCepBlur = async () => {
    if (!form.cep || form.country !== "Brasil") return;
    setLoadingCep(true);
    const data = await fetchCep(form.cep);
    if (data) setForm({ ...form, ...data });
    setLoadingCep(false);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-body">CEP</Label>
          <Input value={form.cep ?? ""} onChange={(e) => setForm({ ...form, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} />
          {loadingCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
        </div>
        <div className="space-y-2">
          <Label className="font-body">País</Label>
          <Input value={form.country ?? "Brasil"} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 col-span-2">
          <Label className="font-body">Endereço</Label>
          <Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="font-body">Número</Label>
          <Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-body">Complemento</Label>
          <Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="font-body">Bairro</Label>
          <Input value={form.neighborhood ?? ""} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="font-body">Cidade</Label>
          <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="font-body">Estado</Label>
          <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </div>
      </div>
    </>
  );
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
  const [newPhone, setNewPhone] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<ProfileWithRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

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
      return (profilesData ?? []).map((p: any) => ({
        ...p,
        role: rolesData?.find((r: any) => r.user_id === p.user_id)?.role ?? "sem função",
      }));
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email: newEmail.trim(), password: newPassword, full_name: newName.trim(), role: newRole, phone: newPhone.trim() || null },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

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
      setCreateOpen(false); setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("sales_agent"); setNewAvatarFile(null); setNewPhone("");
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
        body: {
          action: "update",
          user_id: editUser.user_id,
          full_name: editName.trim(),
          role: editRole,
          ...(avatarPath ? { avatar_url: avatarPath } : {}),
          phone: editForm.phone ?? null,
          cep: editForm.cep ?? null,
          address_street: editForm.address_street ?? null,
          address_number: editForm.address_number ?? null,
          address_complement: editForm.address_complement ?? null,
          neighborhood: editForm.neighborhood ?? null,
          city: editForm.city ?? null,
          state: editForm.state ?? null,
          country: editForm.country ?? null,
          emergency_contact_name: editForm.emergency_contact_name ?? null,
          emergency_contact_phone: editForm.emergency_contact_phone ?? null,
          health_plan: editForm.health_plan ?? null,
        },
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

  const openEdit = (profile: ProfileWithRole) => {
    setEditUser(profile);
    setEditName(profile.full_name);
    setEditRole(profile.role);
    setEditAvatarFile(null);
    setEditForm({
      phone: (profile as any).phone ?? "",
      cep: (profile as any).cep ?? "",
      address_street: (profile as any).address_street ?? "",
      address_number: (profile as any).address_number ?? "",
      address_complement: (profile as any).address_complement ?? "",
      neighborhood: (profile as any).neighborhood ?? "",
      city: (profile as any).city ?? "",
      state: (profile as any).state ?? "",
      country: (profile as any).country ?? "Brasil",
      emergency_contact_name: (profile as any).emergency_contact_name ?? "",
      emergency_contact_phone: (profile as any).emergency_contact_phone ?? "",
      health_plan: (profile as any).health_plan ?? "",
    });
    setEditOpen(true);
  };

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
              <div className="space-y-2"><Label className="font-body">Celular</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(11) 99999-9999" /></div>
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
              <TableHead className="font-body">Celular</TableHead>
              <TableHead className="font-body">Função</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-body py-8">Carregando...</TableCell></TableRow>
            ) : profiles?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground font-body py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            ) : (
              profiles?.map((profile: any) => (
                <TableRow key={profile.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(profile)}>
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
                  <TableCell className="font-body text-muted-foreground">{profile.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[profile.role] ?? "outline"} className="font-body">
                      {ROLE_LABELS[profile.role] ?? profile.role}
                    </Badge>
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
          profiles?.map((profile: any) => (
            <div key={profile.id} className="glass-card rounded-xl p-4 space-y-3 cursor-pointer hover:bg-muted/50" onClick={() => openEdit(profile)}>
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
                  {profile.phone && <p className="text-xs text-muted-foreground font-body">{profile.phone}</p>}
                </div>
                <Badge variant={roleBadgeVariant[profile.role] ?? "outline"} className="font-body">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit dialog with tabs */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-display">Editar Usuário</DialogTitle></DialogHeader>
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="dados" className="font-body text-xs">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="endereco" className="font-body text-xs">Endereço & Emergência</TabsTrigger>
              <TabsTrigger value="contratos" className="font-body text-xs">Contratos</TabsTrigger>
              <TabsTrigger value="senha" className="font-body text-xs">Senha</TabsTrigger>
            </TabsList>

            <TabsContent value="dados">
              <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate(); }} className="space-y-4">
                <AvatarUpload currentUrl={editUser?.avatar_url ? getAvatarUrl(editUser.avatar_url) : null} onFileSelect={setEditAvatarFile} />
                <div className="space-y-2"><Label className="font-body">Nome completo</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
                <div className="space-y-2"><Label className="font-body">Celular</Label><Input value={formatPhone(editForm.phone ?? "")} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="(11) 99999-9999" /></div>
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
            </TabsContent>

            <TabsContent value="endereco">
              <form onSubmit={(e) => { e.preventDefault(); updateUserMutation.mutate(); }} className="space-y-4">
                <AddressFields form={editForm} setForm={setEditForm} />
                <div className="border-t pt-4 space-y-4">
                  <h4 className="text-sm font-semibold font-body text-foreground">Contato de Emergência</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">Nome</Label>
                      <Input value={editForm.emergency_contact_name ?? ""} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">Telefone</Label>
                      <Input value={editForm.emergency_contact_phone ?? ""} onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full font-body" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="contratos">
              {editUser && <UserContractsTab userId={editUser.user_id} />}
            </TabsContent>

            <TabsContent value="senha">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-body">Alterando senha de: <strong>{editUser?.email}</strong></p>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (newPw !== confirmPw) { toast({ title: "Senhas não coincidem", variant: "destructive" }); return; }
                  setPwUser(editUser);
                  changePasswordMutation.mutate();
                }} className="space-y-4">
                  <div className="space-y-2"><Label className="font-body">Nova senha</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={6} /></div>
                  <div className="space-y-2"><Label className="font-body">Confirmar nova senha</Label><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} /></div>
                  <Button type="submit" className="w-full font-body" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>

          {/* Delete user */}
          {editUser && (
            <div className="border-t pt-4 mt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive font-body">
                    Excluir Usuário
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá permanentemente <strong>{editUser.full_name}</strong> ({editUser.email}). Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { deleteUserMutation.mutate(editUser.user_id); setEditOpen(false); }}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
