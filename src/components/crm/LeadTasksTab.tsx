import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ListChecks, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [creating, setCreating] = useState(false);

  const { data: tasks = [], isLoading } = useQuery<TaskRow[]>({
    queryKey: ["lead-tasks", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, priority, completed_at")
        .eq("client_id", contactId!)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

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
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      setNewTitle("");
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
    const { error } = await supabase.from("tasks").update(update).eq("id", task.id);
    if (error) {
      toast.error(error.message);
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
      <div className="px-3 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`Nova tarefa para ${contactName || "este contato"}...`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            className="h-9"
            disabled={creating}
          />
          <Button
            size="icon"
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
            className="h-9 w-9 shrink-0"
            aria-label="Criar tarefa"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Carregando tarefas...
          </div>
        ) : tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2 text-muted-foreground">
            <ListChecks className="h-10 w-10" />
            <p className="text-sm">Nenhuma tarefa para este lead.</p>
            <p className="text-xs">Use o campo acima para adicionar a primeira.</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <ul className="divide-y divide-border">
              {tasks.map((task) => {
                const done = task.status === "completed";
                return (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => toggleDone(task)}
                      className="mt-0.5"
                      aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          done && "line-through text-muted-foreground",
                        )}
                      >
                        {task.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {task.due_date && (
                          <span>
                            Vence{" "}
                            {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {task.priority && task.priority !== "medium" && (
                          <span className="capitalize">{task.priority}</span>
                        )}
                        {done && (
                          <span className="inline-flex items-center gap-1 text-success">
                            <Check className="h-3 w-3" /> Concluída
                          </span>
                        )}
                      </div>
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
