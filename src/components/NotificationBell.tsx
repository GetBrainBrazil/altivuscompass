import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Sparkles, ListTodo } from "lucide-react";

type GenericItem = {
  kind: "reminder" | "notification";
  id: string;
  title: string;
  description: string;
  timestamp: string;
  link?: string | null;
  type?: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;
    const remindersChannel = supabase
      .channel("task-reminders-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_reminders", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["task-reminders"] }),
      )
      .subscribe();
    const notificationsChannel = supabase
      .channel("notifications-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(remindersChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, queryClient]);

  const markReminderRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("task_reminders").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-reminders"] }),
  });

  const markNotificationRead = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const reminderIds = reminders.map((r: any) => r.id);
      const notifIds = notifications.map((n: any) => n.id);
      if (reminderIds.length) {
        await supabase.from("task_reminders").update({ is_read: true }).in("id", reminderIds);
      }
      if (notifIds.length) {
        await (supabase as any).from("notifications").update({ is_read: true }).in("id", notifIds);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Lista unificada ordenada por data desc
  const items = useMemo<GenericItem[]>(() => {
    const reminderItems: GenericItem[] = reminders.map((r: any) => ({
      kind: "reminder",
      id: r.id,
      title: (r.tasks as any)?.title ?? "Tarefa",
      description: `Lembrete: ${format(new Date(r.remind_at), "dd/MM/yyyy HH:mm")}`,
      timestamp: r.remind_at,
    }));
    const notifItems: GenericItem[] = (notifications as any[]).map((n) => ({
      kind: "notification",
      id: n.id,
      title: n.title,
      description: n.message ?? "",
      timestamp: n.created_at,
      link: n.link,
      type: n.type,
    }));
    return [...reminderItems, ...notifItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [reminders, notifications]);

  const unreadCount = items.length;

  const handleClickItem = (item: GenericItem) => {
    if (item.kind === "notification") {
      markNotificationRead.mutate(item.id);
      if (item.link) navigate(item.link);
    } else {
      markReminderRead.mutate(item.id);
    }
  };

  const renderIcon = (item: GenericItem) => {
    if (item.kind === "notification" && item.type === "lead_promoted") {
      return <Sparkles size={14} className="text-sky-600" strokeWidth={1.5} />;
    }
    return <ListTodo size={14} className="text-muted-foreground" strokeWidth={1.5} />;
  };

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
            <button
              onClick={() => markAllRead.mutate()}
              className="text-xs text-primary hover:underline font-body"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground font-body">
              Nenhuma notificação pendente
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="p-3 flex items-start gap-2 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleClickItem(item)}
                >
                  <div className="mt-0.5 shrink-0">{renderIcon(item)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-body truncate">{item.title}</p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground font-body line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.kind === "notification") markNotificationRead.mutate(item.id);
                      else markReminderRead.mutate(item.id);
                    }}
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
