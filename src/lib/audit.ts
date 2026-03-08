import { supabase } from "@/integrations/supabase/client";

export async function logAuditEvent({
  action,
  tableName,
  recordId,
  recordLabel,
  oldData,
  newData,
}: {
  action: "create" | "update" | "delete";
  tableName: string;
  recordId?: string;
  recordLabel?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    // For updates, only store fields that actually changed
    let filteredOldData = oldData ?? null;
    let filteredNewData = newData ?? null;

    if (action === "update" && oldData && newData) {
      const changedOld: Record<string, any> = {};
      const changedNew: Record<string, any> = {};
      for (const key of Object.keys(newData)) {
        if (["updated_at", "created_at", "id"].includes(key)) continue;
        if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
          changedOld[key] = oldData[key];
          changedNew[key] = newData[key];
        }
      }
      if (Object.keys(changedNew).length === 0) return;
      filteredOldData = changedOld;
      filteredNewData = changedNew;
    }

    // Inject record label for identification
    if (recordLabel) {
      filteredNewData = { _label: recordLabel, ...(filteredNewData ?? {}) };
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: profile?.full_name ?? user.email ?? "Desconhecido",
      action: action.toUpperCase(),
      table_name: tableName,
      record_id: recordId ?? null,
      old_data: filteredOldData,
      new_data: filteredNewData,
    });
  } catch (e) {
    console.error("Failed to log audit event:", e);
  }
}
