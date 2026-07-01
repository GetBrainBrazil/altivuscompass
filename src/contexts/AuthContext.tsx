import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";

interface ImpersonatingUser {
  userId: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  realRole: string | null;
  impersonatingRole: string | null;
  impersonatingUser: ImpersonatingUser | null;
  setImpersonatingRole: (role: string | null) => void;
  setImpersonatingUser: (user: ImpersonatingUser | null) => void;
  loading: boolean;
  signOut: (reason?: "manual" | "inactivity") => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userRole: null,
  realRole: null,
  impersonatingRole: null,
  impersonatingUser: null,
  setImpersonatingRole: () => {},
  setImpersonatingUser: () => {},
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [realRole, setRealRole] = useState<string | null>(null);
  const [impersonatingRole, setImpersonatingRoleState] = useState<string | null>(null);
  const [impersonatingUser, setImpersonatingUserState] = useState<ImpersonatingUser | null>(null);
  const [loading, setLoading] = useState(true);

  // When impersonating a user, use that user's role; otherwise use role override or real role
  const userRole = impersonatingUser?.role ?? impersonatingRole ?? realRole;

  const setImpersonatingRole = (role: string | null) => {
    setImpersonatingRoleState(role);
    setImpersonatingUserState(null); // clear user impersonation when switching to role
  };

  const setImpersonatingUser = (u: ImpersonatingUser | null) => {
    setImpersonatingUserState(u);
    setImpersonatingRoleState(null); // clear role impersonation when switching to user
  };

  const fetchUserRole = async (userId: string) => {
    const attempt = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      return { role: (data?.role as string | undefined) ?? null, error };
    };
    let { role } = await attempt();
    if (!role) {
      // Retry once after a short delay: on cold start the session/JWT may not
      // have propagated to PostgREST yet, causing RLS to return zero rows.
      await new Promise((r) => setTimeout(r, 400));
      role = (await attempt()).role;
    }
    // Never overwrite a previously-resolved role with null — a concurrent
    // race between onAuthStateChange and getSession could otherwise clear
    // a valid role and lock the user out with "Acesso Negado".
    setRealRole((prev) => role ?? prev);
    setLoading(false);
  };

  const hasLoggedLoginRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Only show loading spinner on actual user change (login), not on token refresh / tab focus
          const isNewUser = lastUserIdRef.current !== session.user.id;
          lastUserIdRef.current = session.user.id;
          if (isNewUser) {
            setLoading(true);
            fetchUserRole(session.user.id);
          }
          // Log LOGIN only on a real sign-in event (not on token refresh, tab focus, or initial restore)
          if (event === "SIGNED_IN" && !hasLoggedLoginRef.current) {
            hasLoggedLoginRef.current = true;
            logAuditEvent({
              action: "create",
              tableName: "sessions",
              newData: { event: "LOGIN", email: session.user.email },
            });
          }
        } else {
          lastUserIdRef.current = null;
          setRealRole(null);
          setImpersonatingRoleState(null);
          setImpersonatingUserState(null);
          hasLoggedLoginRef.current = false;
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        lastUserIdRef.current = session.user.id;
        setLoading(true);
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async (reason: "manual" | "inactivity" = "manual") => {
    const logoutEvent = reason === "inactivity" ? "LOGOUT_INACTIVITY" : "LOGOUT";
    await logAuditEvent({
      action: "create",
      tableName: "sessions",
      newData: { event: logoutEvent, email: user?.email },
    });
    hasLoggedLoginRef.current = false;
    try { sessionStorage.clear(); } catch {}
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRealRole(null);
    setImpersonatingRoleState(null);
    setImpersonatingUserState(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, userRole, realRole, impersonatingRole, impersonatingUser, setImpersonatingRole, setImpersonatingUser, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
