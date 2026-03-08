import { supabase } from "@/integrations/supabase/client";

export async function logAuditEvent({
  action,
  tableName,
  recordId,
  oldData,
  newData,
}: {
  action: "create" | "update" | "delete";
  tableName: string;
  recordId?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user name from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: profile?.full_name ?? user.email ?? "Desconhecido",
      action: action.toUpperCase(),
      table_name: tableName,
      record_id: recordId ?? null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
    });
  } catch (e) {
    console.error("Failed to log audit event:", e);
  }
}
