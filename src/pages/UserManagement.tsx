import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  sales_agent: "Agente de Vendas",
  operations: "Operações",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  manager: "secondary",
  sales_agent: "outline",
  operations: "outline",
};

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("sales_agent");

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
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Usuário criado", description: `${newEmail} foi adicionado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
      setOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("sales_agent");
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id: userId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Usuário removido" });
      queryClient.invalidateQueries({ queryKey: ["profiles-with-roles"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground font-body">Gerencie quem pode acessar o sistema.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="font-body">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); createUserMutation.mutate(); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="font-body">Nome completo</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">E-mail</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Função</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="sales_agent">Agente de Vendas</SelectItem>
                    <SelectItem value="operations">Operações</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full font-body" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Nome</TableHead>
              <TableHead className="font-body">E-mail</TableHead>
              <TableHead className="font-body">Função</TableHead>
              <TableHead className="font-body text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground font-body py-8">Carregando...</TableCell></TableRow>
            ) : profiles?.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground font-body py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            ) : (
              profiles?.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-body font-medium">{profile.full_name}</TableCell>
                  <TableCell className="font-body text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[profile.role] ?? "outline"} className="font-body">
                      {roleLabels[profile.role] ?? profile.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive font-body"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja remover este usuário?")) {
                          deleteUserMutation.mutate(profile.user_id);
                        }
                      }}
                    >
                      Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
