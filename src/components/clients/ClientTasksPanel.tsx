import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Plus, Check, X, Loader2, ExternalLink, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  contactId: string | null;
  clientId: string | null;
}

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "text-muted-foreground" },
  medium: { label: "Média", color: "text-blue-500" },
  high: { label: "Alta", color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-destructive" },
};

export function ClientTasksPanel({ contactId, clientId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const queryKey = ["client-tasks", clientId, contactId];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    enabled: !!(clientId || contactId),
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("id,title,status,priority,due_date,completed_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (clientId && contactId) {
        query = query.or(`client_id.eq.${clientId},contact_id.eq.${contactId}`);
      } else if (clientId) {
        query = query.eq("client_id", clientId);
      } else if (contactId) {
        query = query.eq("contact_id", contactId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !title.trim()) return;
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        status: "pending",
        priority,
        due_date: dueDate || null,
        client_id: clientId,
        contact_id: contactId,
        created_by: user.id,
        assigned_to: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setTitle("");
      setPriority("medium");
      setDueDate("");
      setAdding(false);
      toast({ title: "Tarefa criada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao criar tarefa", description: e.message, variant: "destructive" }),
  });

  const toggleComplete = useMutation({
    mutationFn: async (row: TaskRow) => {
      const done = row.status === "completed";
      const { error } = await supabase
        .from("tasks")
        .update({
          status: done ? "pending" : "completed",
          completed_at: done ? null : new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const active = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");

  if (!clientId && !contactId) return null;

  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">
            Tarefas {active.length > 0 && <span className="text-muted-foreground font-normal">({active.length})</span>}
          </h3>
        </div>
        {!adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)} className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da tarefa"
            className="h-8 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) create.mutate();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-xs"
              placeholder="Prazo"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-7 text-xs">
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => create.mutate()}
              disabled={!title.trim() || create.isPending}
              className="h-7 text-xs"
            >
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              Criar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {isLoading && <div className="text-xs text-muted-foreground py-2 text-center">Carregando...</div>}
        {!isLoading && active.length === 0 && !adding && (
          <div className="text-xs text-muted-foreground py-3 text-center font-body">
            Nenhuma tarefa pendente.
          </div>
        )}
        {active.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => toggleComplete.mutate(t)} />
        ))}

        {completed.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCompleted ? "Ocultar" : "Ver"} concluídas ({completed.length})
            </button>
            {showCompleted && (
              <div className="space-y-1.5 mt-1.5">
                {completed.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={() => toggleComplete.mutate(t)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: TaskRow; onToggle: () => void }) {
  const done = task.status === "completed";
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const overdue =
    !done && task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border border-border bg-card/40 px-2 py-1.5 text-xs font-body",
        done && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
          done ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary",
        )}
        aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <Link
        to={`/tasks/${task.id}`}
        className={cn(
          "flex-1 min-w-0 truncate hover:text-primary transition-colors",
          done && "line-through",
        )}
        title={task.title}
      >
        {task.title}
      </Link>
      <Flag className={cn("h-3 w-3 shrink-0", prio.color)} aria-label={prio.label} />
      {task.due_date && (
        <span className={cn("text-[10px] shrink-0", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
          {format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
        </span>
      )}
      <Link
        to={`/tasks/${task.id}`}
        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label="Abrir tarefa"
      >
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
