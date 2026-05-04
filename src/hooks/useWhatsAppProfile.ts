import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppProfile {
  connected: boolean;
  photoUrl: string | null;
  phone: string | null;
  formattedPhone: string | null;
  name: string | null;
  loading: boolean;
}

const CACHE_KEY = "wa-profile-cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function useWhatsAppProfile(): WhatsAppProfile {
  const [state, setState] = useState<WhatsAppProfile>(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return { ...data, loading: false };
      }
    } catch {}
    return {
      connected: false,
      photoUrl: null,
      phone: null,
      formattedPhone: null,
      name: null,
      loading: true,
    };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-status", {
          body: { action: "status" },
        });
        if (cancelled) return;
        if (error) throw error;
        const next: WhatsAppProfile = {
          connected: !!data?.connected,
          photoUrl: data?.device?.imgUrl ?? null,
          phone: data?.device?.phone ? String(data.device.phone) : null,
          formattedPhone: data?.device?.formattedPhone ?? null,
          name: data?.device?.name ?? null,
          loading: false,
        };
        setState(next);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: next, ts: Date.now() }),
          );
        } catch {}
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
