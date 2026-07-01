import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { canAccess, getAccessiblePages } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, userRole, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          {/* Stats / filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          {/* Content */}
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(userRole, location.pathname)) {
    // Redireciona para o Painel se permitido, senão para a primeira página acessível.
    if (canAccess(userRole, "/")) {
      return <Navigate to="/" replace />;
    }
    const accessible = getAccessiblePages(userRole).filter((p) => p.path !== "/profile" && p.path !== "/changelog");
    const fallback = accessible[0]?.path;
    if (fallback && fallback !== location.pathname) {
      return <Navigate to={fallback} replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-display font-semibold text-foreground">Acesso Negado</h2>
          <p className="text-muted-foreground font-body text-sm">
            {userRole
              ? "Você não tem permissão para acessar esta página."
              : "Não foi possível carregar suas permissões. Faça login novamente para continuar."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            <Button variant="destructive" onClick={() => signOut("manual")}>Sair</Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
