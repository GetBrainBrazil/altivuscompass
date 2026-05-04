import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Per-user JSON preference stored in `user_preferences` (key/value).
 * - Reads once on mount (or when user/key changes).
 * - Writes are debounced (300ms) and silent.
 * - On network error, falls back to localStorage and retries on next load.
 */
export function useUserPreference<T extends Record<string, any>>(
  key: string,
  defaultValue: T,
) {
  const { user } = useAuth();
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lbKey = `user_pref_fallback:${key}`;

  // Load
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    setLoading(true);

    const applyFallback = () => {
      try {
        const raw = localStorage.getItem(lbKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !cancelled) {
            setValue({ ...defaultValue, ...parsed });
            return true;
          }
        }
      } catch { /* ignore */ }
      return false;
    };

    if (!user) {
      applyFallback();
      if (!cancelled) {
        setLoading(false);
        hydratedRef.current = true;
      }
      return () => { cancelled = true; };
    }

    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        applyFallback();
      } else if (data?.value && typeof data.value === "object") {
        setValue({ ...defaultValue, ...(data.value as T) });
        try { localStorage.removeItem(lbKey); } catch { /* ignore */ }
      } else {
        // No saved prefs: try fallback (in case prior save failed)
        const used = applyFallback();
        if (used) {
          // try to push fallback up to backend
          try {
            const raw = localStorage.getItem(lbKey);
            if (raw) {
              await supabase.from("user_preferences").upsert(
                { user_id: user.id, key, value: JSON.parse(raw) },
                { onConflict: "user_id,key" },
              );
              localStorage.removeItem(lbKey);
            }
          } catch { /* ignore */ }
        }
      }
      setLoading(false);
      hydratedRef.current = true;
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, key]);

  // Save (debounced) when value changes after hydration
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!user) {
        try { localStorage.setItem(lbKey, JSON.stringify(value)); } catch { /* ignore */ }
        return;
      }
      const { error } = await supabase.from("user_preferences").upsert(
        { user_id: user.id, key, value },
        { onConflict: "user_id,key" },
      );
      if (error) {
        try { localStorage.setItem(lbKey, JSON.stringify(value)); } catch { /* ignore */ }
      } else {
        try { localStorage.removeItem(lbKey); } catch { /* ignore */ }
      }
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, user?.id, key]);

  const reset = useCallback(async () => {
    setValue(defaultValue);
    try { localStorage.removeItem(lbKey); } catch { /* ignore */ }
    if (user) {
      await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("key", key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, key]);

  return { value, setValue, loading, reset };
}
