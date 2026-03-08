import { Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface AppLayoutProps {
  children: React.ReactNode;
}

const IMPERSONATABLE_ROLES = ["manager", "sales_agent", "operations"] as const;

export function AppLayout({ children }: AppLayoutProps) {
  const { user, userRole, realRole, impersonatingRole, setImpersonatingRole, signOut } = useAuth();
  const isRealAdmin = realRole === "admin";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-3 sm:px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

            {/* Impersonation banner */}
            {impersonatingRole && (
              <div className="ml-3 flex items-center gap-2">
                <Badge variant="destructive" className="font-body text-xs gap-1.5 py-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Visualizando como: {ROLE_LABELS[impersonatingRole] ?? impersonatingRole}
                </Badge>
                <button
                  onClick={() => setImpersonatingRole(null)}
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
                      <AvatarFallback className={`text-xs font-medium ${impersonatingRole ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                        {user?.email?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground hidden sm:inline max-w-[150px] truncate">
                      {user?.email ?? ""}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {canAccess(realRole, "/users") && (
                    <DropdownMenuItem asChild>
                      <Link to="/users" className="flex items-center gap-2 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Usuários
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canAccess(realRole, "/permissions") && (
                    <DropdownMenuItem asChild>
                      <Link to="/permissions" className="flex items-center gap-2 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Permissões
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {/* Impersonate role - admin only */}
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
                        <DropdownMenuSubContent>
                          {impersonatingRole && (
                            <DropdownMenuItem onClick={() => setImpersonatingRole(null)} className="cursor-pointer font-medium text-primary">
                              ✓ Voltar ao Admin
                            </DropdownMenuItem>
                          )}
                          {!impersonatingRole && (
                            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                              Administrador (atual)
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
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
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}

                  {(canAccess(realRole, "/users") || canAccess(realRole, "/permissions") || isRealAdmin) && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
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
