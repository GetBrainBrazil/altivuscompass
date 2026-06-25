import { supabase } from "@/integrations/supabase/client";
import {
  PAGE_PERMISSIONS,
  FEATURE_PERMISSIONS,
  type AppRole,
} from "@/lib/permissions";

const SETTING_ID = "matrix_v1";

type Snapshot = {
  pages: Record<string, AppRole[]>;
  features: Record<string, AppRole[]>;
};

export function currentSnapshot(): Snapshot {
  return {
    pages: Object.fromEntries(PAGE_PERMISSIONS.map((p) => [p.path, [...p.allowedRoles]])),
    features: Object.fromEntries(FEATURE_PERMISSIONS.map((f) => [f.key, [...f.allowedRoles]])),
  };
}

export function applySnapshot(snap: Partial<Snapshot> | null | undefined) {
  if (!snap) return;
  if (snap.pages) {
    for (const p of PAGE_PERMISSIONS) {
      const next = snap.pages[p.path];
      if (Array.isArray(next)) p.allowedRoles = [...next] as AppRole[];
    }
  }
  if (snap.features) {
    for (const f of FEATURE_PERMISSIONS) {
      const next = snap.features[f.key];
      if (Array.isArray(next)) f.allowedRoles = [...next] as AppRole[];
    }
  }
}

export async function loadPermissionOverrides() {
  try {
    const { data } = await supabase
      .from("permission_settings" as any)
      .select("data")
      .eq("id", SETTING_ID)
      .maybeSingle();
    if (data && (data as any).data) applySnapshot((data as any).data as Snapshot);
  } catch (e) {
    console.warn("[permissions] failed to load overrides", e);
  }
}

export async function savePermissionOverrides() {
  const snap = currentSnapshot();
  const { error } = await supabase
    .from("permission_settings" as any)
    .upsert({ id: SETTING_ID, data: snap, updated_at: new Date().toISOString() } as any, {
      onConflict: "id",
    });
  if (error) throw error;
}

export function subscribePermissionOverrides(onChange: () => void) {
  const channel = supabase
    .channel("permission_settings_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "permission_settings" },
      (payload: any) => {
        const row = payload.new ?? payload.record;
        if (row?.data) applySnapshot(row.data as Snapshot);
        onChange();
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
