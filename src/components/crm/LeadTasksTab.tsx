import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ListChecks, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  contactId?: string | null;
  contactName?: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string;
  completed_at: string | null;
}

export function LeadTasksTab({ contactId, contactName }: Props) {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({
    queryKey: ["lead-tasks", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, priority, completed_at")
        .eq("client_id", contactId!)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  // Pendentes primeiro, concluídas no fim
  const sortedTasks = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "completed");
    const done = tasks
      .filter((t) => t.status === "completed")
      .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
    return [...pending, ...done];
  }, [tasks]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || !contactId || creating) return;
    setCreating(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        title,
        client_id: contactId,
        status: "pending",
        priority: "medium",
        due_date: newDueDate ? format(newDueDate, "yyyy-MM-dd") : null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      setNewTitle("");
      setNewDueDate(undefined);
      qc.invalidateQueries({ queryKey: ["lead-tasks", contactId] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao criar tarefa");
    } finally {
      setCreating(false);
    }
  };

  const toggleDone = async (task: TaskRow) => {
    const done = task.status === "completed";
    const update = done
      ? { status: "pending", completed_at: null }
      : { status: "completed", completed_at: new Date().toISOString() };

    // Optimistic update
    qc.setQueryData<TaskRow[]>(["lead-tasks", contactId], (old) =>
      (old ?? []).map((t) => (t.id === task.id ? { ...t, ...update } : t)),
    );

    const { error } = await supabase.from("tasks").update(update).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["lead-tasks", contactId] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["lead-tasks", contactId] });
  };

  if (!contactId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-muted-foreground">
        <ListChecks className="h-10 w-10" />
        <p className="text-sm">Salve o contato para criar tarefas.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Quick add */}
      <div className="px-3 py-2.5 border-b border-border bg-background space-y-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={`Nova tarefa${contactName ? ` para ${contactName}` : ""}...`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          className="h-9"
          disabled={creating}
        />
        <div className="flex items-center gap-2">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 px-2.5 gap-1.5 text-xs font-normal flex-1 justify-start",
                  !newDueDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {newDueDate
                  ? format(newDueDate, "dd/MM/yyyy", { locale: ptBR })
                  : "Vencimento (opcional)"}
                {newDueDate && (
                  <X
                    className="h-3 w-3 ml-auto text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNewDueDate(undefined);
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={newDueDate}
                onSelect={(d) => {
                  setNewDueDate(d);
                  setDatePickerOpen(false);
                }}
                locale={ptBR}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
            size="sm"
            className="h-9 shrink-0"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Adicionar"
            )}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Carregando tarefas...
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2 text-muted-foreground">
            <ListChecks className="h-10 w-10" />
            <p className="text-sm">Nenhuma tarefa para este lead.</p>
            <p className="text-xs">Use o campo acima para adicionar a primeira.</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <ul className="divide-y divide-border/60">
              {sortedTasks.map((task) => {
                const done = task.status === "completed";
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors",
                      done && "opacity-70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDone(task)}
                      aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 inline-flex items-center justify-center transition-colors",
                        done
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 hover:border-primary hover:bg-primary/5",
                      )}
                    >
                      {done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm leading-snug break-words",
                          done && "line-through text-muted-foreground/70",
                        )}
                      >
                        {task.title}
                      </p>
                      {task.due_date && (
                        <div
                          className={cn(
                            "mt-0.5 inline-flex items-center gap-1 text-[11px]",
                            done ? "text-muted-foreground/60" : "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
