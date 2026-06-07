import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWaUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("wa_conversations")
        .select("unread_count");
      if (cancelled || error || !data) return;
      const total = data.reduce((s, r: any) => s + (r.unread_count || 0), 0);
      setCount(total);
    };

    load();

    const channel = supabase
      .channel("wa-unread-sidebar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_conversations" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
