import { useEffect, useCallback, useRef } from "react";

/**
 * Persists form data to localStorage automatically.
 * Data is saved on every change, on tab switch (visibilitychange), and before unload.
 * Data is cleared when clearPersistence() is called (typically on successful save).
 *
 * @param key - Unique localStorage key for this form (e.g. "itinerary-form-<id>")
 * @param formData - Current form state object
 * @param setFormData - Setter to restore form state
 * @param enabled - Whether persistence is active (default true)
 */
export function useFormPersistence<T extends Record<string, any>>(
  key: string,
  formData: T,
  setFormData: (data: T) => void,
  enabled: boolean = true
) {
  const formDataRef = useRef(formData);
  const hasRestoredRef = useRef(false);
  const keyRef = useRef(key);

  // Keep refs up to date
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  // Restore on mount (only once per key)
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    try {
      const stored = localStorage.getItem(`form-draft:${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setFormData(parsed as T);
        }
      }
    } catch {
      // ignore parse errors
    }
    hasRestoredRef.current = true;
  }, [key, enabled, setFormData]);

  // Reset restored flag when key changes
  useEffect(() => {
    hasRestoredRef.current = false;
  }, [key]);

  // Save to localStorage on changes (debounced)
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`form-draft:${key}`, JSON.stringify(formData));
      } catch {
        // quota exceeded or other error
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [key, formData, enabled]);

  // Save on visibility change (tab switch) and beforeunload
  useEffect(() => {
    if (!enabled) return;

    const save = () => {
      try {
        localStorage.setItem(`form-draft:${keyRef.current}`, JSON.stringify(formDataRef.current));
      } catch {
        // ignore errors
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", save);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", save);
    };
  }, [enabled]);

  const clearPersistence = useCallback(() => {
    try {
      localStorage.removeItem(`form-draft:${keyRef.current}`);
    } catch {
      // ignore errors
    }
  }, []);

  return { clearPersistence };
}
