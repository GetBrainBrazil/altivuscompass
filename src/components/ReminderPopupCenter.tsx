import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, X, ExternalLink, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Item = {
  id: string;
  task_id: string;
  remind_at: string;
  channels: string[];
  message: string | null;
  task_title?: string;
};

export function ReminderPopupCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);

  const fetchDue = async () => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("task_reminders")
      .select("id, task_id, remind_at, channels, message, is_read")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .lte("remind_at", nowIso)
      .order("remind_at", { ascending: true })
      .limit(10);
    const list = (data ?? []).filter((r: any) =>
      Array.isArray(r.channels) ? r.channels.includes("system") : true
    );
    if (list.length === 0) {
      setItems([]);
      return;
    }
    const ids = Array.from(new Set(list.map((r: any) => r.task_id)));
    const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", ids);
    const titleMap = new Map((tasks ?? []).map((t: any) => [t.id, t.title]));
    setItems(
      list.map((r: any) => ({
        id: r.id,
        task_id: r.task_id,
        remind_at: r.remind_at,
        channels: r.channels ?? [],
        message: r.message,
        task_title: titleMap.get(r.task_id) ?? "Tarefa",
      }))
    );
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchDue();
    const interval = setInterval(fetchDue, 30000);
    const channel = supabase
      .channel(`reminders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_reminders", filter: `user_id=eq.${user.id}` },
        () => fetchDue()
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const dismiss = async (id: string) => {
    setItems((cur) => cur.filter((i) => i.id !== id));
    await supabase.from("task_reminders").update({ is_read: true }).eq("id", id);
  };

  const openTask = (item: Item) => {
    dismiss(item.id);
    navigate(`/tasks/${item.task_id}`);
  };

  const snooze = async (item: Item, minutes = 30) => {
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    const next = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("task_reminders")
      .update({ remind_at: next, is_read: false })
      .eq("id", item.id);
    if (error) {
      toast.error("Não foi possível adiar o lembrete");
      fetchDue();
    } else {
      toast.success(`Lembrete adiado por ${minutes} min`);
    }
  };

  const complete = async (item: Item) => {
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    const [{ error: tErr }, { error: rErr }] = await Promise.all([
      supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", item.task_id),
      supabase.from("task_reminders").update({ is_read: true }).eq("id", item.id),
    ]);
    if (tErr || rErr) {
      toast.error("Não foi possível concluir a tarefa");
      fetchDue();
    } else {
      toast.success("Tarefa concluída");
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-96">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-border bg-card shadow-lg p-3 animate-in slide-in-from-right"
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary shrink-0">
              <Bell size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{item.task_title}</p>
                <button
                  onClick={() => dismiss(item.id)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  aria-label="Dispensar"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(item.remind_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              {item.message && (
                <p className="text-xs text-foreground mt-1.5 whitespace-pre-wrap break-words">
                  {item.message}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" className="h-7 text-xs" onClick={() => openTask(item)}>
                  <ExternalLink size={12} className="mr-1" /> Abrir
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => snooze(item, 30)}>
                  <Clock size={12} className="mr-1" /> Adiar 30min
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => complete(item)}>
                  <Check size={12} className="mr-1" /> Concluído
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismiss(item.id)}>
                  Dispensar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
