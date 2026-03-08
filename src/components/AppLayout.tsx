import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

interface AppLayoutProps {
  children: React.ReactNode;
}

const IMPERSONATABLE_ROLES = ["manager", "sales_agent", "operations"] as const;

export function AppLayout({ children }: AppLayoutProps) {
  const { user, userRole, realRole, impersonatingRole, impersonatingUser, setImpersonatingRole, setImpersonatingUser, signOut, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isRealAdmin = realRole === "admin";
  const [userSearch, setUserSearch] = useState("");

  const handleInactivityLogout = useCallback(async () => {
    if (!session) return;
    await signOut("inactivity");
    toast({ title: "Sessão encerrada", description: "Você foi desconectado por inatividade (2 horas).", variant: "destructive" });
    navigate("/login", { replace: true });
  }, [session, signOut, toast, navigate]);

  useInactivityLogout(handleInactivityLogout);

  const { data: usersWithRoles = [] } = useQuery({
    queryKey: ["impersonate-users-list"],
    queryFn: async () => {
      const [{ data: profilesData }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profilesData ?? []).map((p: Tables<"profiles">) => ({
        ...p,
        role: rolesData?.find((r: Tables<"user_roles">) => r.user_id === p.user_id)?.role ?? "",
      }));
    },
    enabled: isRealAdmin,
  });

  const filteredUsers = usersWithRoles.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    const roleLabel = ROLE_LABELS[u.role] ?? u.role;
    return u.full_name.toLowerCase().includes(q) || roleLabel.toLowerCase().includes(q);
  });

  const isImpersonating = !!impersonatingRole || !!impersonatingUser;

  const impersonationLabel = impersonatingUser
    ? `${impersonatingUser.fullName} (${ROLE_LABELS[impersonatingUser.role] ?? impersonatingUser.role})`
    : impersonatingRole
      ? ROLE_LABELS[impersonatingRole] ?? impersonatingRole
      : "";

  const clearImpersonation = () => {
    setImpersonatingRole(null);
    setImpersonatingUser(null);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-3 sm:px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

            {/* Impersonation banner */}
            {isImpersonating && (
              <div className="ml-3 flex items-center gap-2">
                <Badge variant="destructive" className="font-body text-xs gap-1.5 py-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Visualizando como: {impersonationLabel}
                </Badge>
                <button
                  onClick={clearImpersonation}
                  className="text-xs font-body font-medium text-destructive hover:underline"
                >
                  Voltar ao Admin
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold rounded-full" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={`text-xs font-medium ${isImpersonating ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                        {user?.email?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground hidden sm:inline max-w-[150px] truncate">
                      {user?.email ?? ""}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {/* Meu Perfil - always visible */}
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" />
                      </svg>
                      Meu Perfil
                    </Link>
                  </DropdownMenuItem>

                  {/* Sistema - only for roles with /system access */}
                  {canAccess(userRole, "/system") && (
                    <DropdownMenuItem asChild>
                      <Link to="/system" className="flex items-center gap-2 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* Impersonate - admin only */}
                  {isRealAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          Ver como...
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-64">
                          {isImpersonating && (
                            <>
                              <DropdownMenuItem onClick={clearImpersonation} className="cursor-pointer font-medium text-primary">
                                ✓ Voltar ao Admin
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}

                          {/* By role */}
                          <DropdownMenuItem disabled className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-1">
                            Por Função
                          </DropdownMenuItem>
                          {!impersonatingRole && !impersonatingUser && (
                            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                              Administrador (atual)
                            </DropdownMenuItem>
                          )}
                          {IMPERSONATABLE_ROLES.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => setImpersonatingRole(role)}
                              className={`cursor-pointer ${impersonatingRole === role ? "font-medium text-primary" : ""}`}
                            >
                              {impersonatingRole === role && "✓ "}
                              {ROLE_LABELS[role]}
                            </DropdownMenuItem>
                          ))}

                          <DropdownMenuSeparator />

                          {/* By user */}
                          <DropdownMenuItem disabled className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-1">
                            Por Usuário
                          </DropdownMenuItem>
                          <div className="px-2 py-1.5" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <div className="relative">
                              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Buscar usuário..."
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="h-7 text-xs pl-7"
                              />
                            </div>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                Nenhum usuário encontrado
                              </DropdownMenuItem>
                            ) : (
                              filteredUsers.map((u) => {
                                const isActive = impersonatingUser?.userId === u.user_id;
                                const roleLabel = ROLE_LABELS[u.role] ?? u.role;
                                return (
                                  <DropdownMenuItem
                                    key={u.user_id}
                                    onClick={() => setImpersonatingUser({
                                      userId: u.user_id,
                                      fullName: u.full_name,
                                      role: u.role,
                                    })}
                                    className={`cursor-pointer text-xs ${isActive ? "font-medium text-primary" : ""}`}
                                  >
                                    {isActive && "✓ "}
                                    {u.full_name}
                                    {roleLabel && (
                                      <span className="text-muted-foreground ml-1">— {roleLabel}</span>
                                    )}
                                  </DropdownMenuItem>
                                );
                              })
                            )}
                          </div>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut("manual")} className="cursor-pointer text-destructive focus:text-destructive">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
