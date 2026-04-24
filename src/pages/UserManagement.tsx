import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/permissions";
import { Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default", manager: "secondary", sales_agent: "outline", operations: "outline",
};

type ProfileWithRole = Tables<"profiles"> & { role: string; phone?: string | null };

function getAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export default function UserManagement({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles-with-roles"],
    queryFn: async () => {
      const { data: profilesData, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      const { data: rolesData } = await supabase.from("user_roles").select("*");
      return (profilesData ?? []).map((p: any) => ({
        ...p,
        role: rolesData?.find((r: any) => r.user_id === p.user_id)?.role ?? "sem função",
      })) as ProfileWithRole[];
    },
  });

  return (
    <div className={embedded ? "space-y-4" : "max-w-5xl mx-auto space-y-4 sm:space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground">Gestão de Usuários</h1>
            <p className="text-sm text-muted-foreground font-body">Gerencie usuários, permissões e senhas.</p>
          </div>
        )}
        <Button className="font-body w-full sm:w-auto gap-2" onClick={() => navigate("/users/new")}>
          <Plus size={16} /> Novo Usuário
        </Button>
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
                <TableRow key={profile.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/users/${profile.user_id}`)}>
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
            <div key={profile.id} className="glass-card rounded-xl p-4 space-y-3 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/users/${profile.user_id}`)}>
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
    </div>
  );
}
