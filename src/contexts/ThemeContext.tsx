import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const LS_KEY = "altivus_theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = theme;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls === "light" || ls === "dark") return ls;
  } catch { /* ignore */ }
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedFromBackend = useRef(false);

  // Apply on mount + every change
  useEffect(() => { applyTheme(theme); }, [theme]);

  // Load from backend on login
  useEffect(() => {
    if (!user) { hydratedFromBackend.current = false; return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "theme")
        .maybeSingle();
      if (cancelled) return;
      const v = (data?.value as any)?.theme;
      if (v === "light" || v === "dark") {
        setThemeState(v);
        try { localStorage.setItem(LS_KEY, v); } catch { /* ignore */ }
      }
      hydratedFromBackend.current = true;
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(LS_KEY, t); } catch { /* ignore */ }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!user) return;
      const { error } = await supabase.from("user_preferences").upsert(
        { user_id: user.id, key: "theme", value: { theme: t } as any },
        { onConflict: "user_id,key" },
      );
      if (error) {
        // localStorage already saved as fallback; will retry next load
      }
    }, 300);
  }, [user?.id]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
