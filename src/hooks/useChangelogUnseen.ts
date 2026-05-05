import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPreference } from "./useUserPreference";

interface LatestEntry {
  id: string;
  title: string;
  date: string;
  created_at: string;
}

/**
 * Tracks whether there are platform_changelog entries newer than the user's
 * last visit to /changelog. Returns the latest entry for the "What's new" toast.
 */
export function useChangelogUnseen() {
  const { value, loading: prefLoading } = useUserPreference<{ lastSeenAt?: string }>(
    "changelog_last_seen",
    {},
  );
  const [latest, setLatest] = useState<LatestEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_changelog")
        .select("id, title, date, created_at")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLatest(data as LatestEntry | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const lastSeen = value.lastSeenAt ? new Date(value.lastSeenAt).getTime() : 0;
  const latestTs = latest ? new Date(latest.created_at || latest.date).getTime() : 0;
  const hasUnseen = !prefLoading && latestTs > lastSeen;

  return { hasUnseen, latest, loading: loading || prefLoading };
}
