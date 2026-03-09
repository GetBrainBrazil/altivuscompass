import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check } from "lucide-react";

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reminders = [] } = useQuery({
    queryKey: ["task-reminders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_reminders")
        .select("*, tasks(title, status)")
        .eq("user_id", user!.id)
        .lte("remind_at", new Date().toISOString())
        .eq("is_read", false)
        .order("remind_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("task-reminders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "task_reminders", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["task-reminders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("task_reminders").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-reminders"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const ids = reminders.map((r: any) => r.id);
      if (ids.length) await supabase.from("task_reminders").update({ is_read: true }).in("id", ids);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-reminders"] }),
  });

  const unreadCount = reminders.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell size={18} className="text-muted-foreground" strokeWidth={1.2} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-sm font-display font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-primary hover:underline font-body">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          {reminders.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground font-body">Nenhuma notificação pendente</div>
          ) : (
            <div className="divide-y divide-border/50">
              {reminders.map((r: any) => (
                <div key={r.id} className="p-3 flex items-start gap-2 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-body truncate">{(r.tasks as any)?.title ?? "Tarefa"}</p>
                    <p className="text-[11px] text-muted-foreground font-body">
                      Lembrete: {format(new Date(r.remind_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <button
                    onClick={() => markReadMutation.mutate(r.id)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-success transition-colors"
                    title="Marcar como lida"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
