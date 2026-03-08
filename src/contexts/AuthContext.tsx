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
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    setRealRole(data?.role ?? null);
  };

  const hasLoggedLoginRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserRole(session.user.id), 0);
          // Log login event once per session
          if (!hasLoggedLoginRef.current) {
            hasLoggedLoginRef.current = true;
            logAuditEvent({
              action: "create",
              tableName: "sessions",
              newData: { event: "LOGIN", email: session.user.email },
            });
          }
        } else {
          setRealRole(null);
          setImpersonatingRoleState(null);
          setImpersonatingUserState(null);
          hasLoggedLoginRef.current = false;
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
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
