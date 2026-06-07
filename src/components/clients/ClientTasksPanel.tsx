import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckSquare, Plus, Check, X, Loader2, ExternalLink, Flag, Pencil, Bell } from "lucide-react";
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

const PRIORITY_META: Record<string, { label: string; color: string; border: string }> = {
  low: { label: "Baixa", color: "text-muted-foreground", border: "border-l-muted-foreground/40" },
  medium: { label: "Média", color: "text-blue-500", border: "border-l-blue-500" },
  high: { label: "Alta", color: "text-orange-500", border: "border-l-orange-500" },
  urgent: { label: "Urgente", color: "text-destructive", border: "border-l-destructive" },
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

  const taskIds = tasks.map((t) => t.id);

  const { data: reminderCounts = {} } = useQuery({
    queryKey: ["client-tasks-reminders", taskIds],
    enabled: taskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_reminders")
        .select("task_id")
        .in("task_id", taskIds)
        .eq("status", "pending");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        const id = (r as any).task_id as string;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      return counts;
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

  const updateTask = useMutation({
    mutationFn: async (payload: { id: string; title: string; priority: string; due_date: string | null }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: payload.title,
          priority: payload.priority,
          due_date: payload.due_date,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Tarefa atualizada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const active = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");

  if (!clientId && !contactId) return null;

  return (
    <TooltipProvider delayDuration={300}>
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
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent className="text-xs">Título da tarefa (o que precisa ser feito)</TooltipContent>
            </Tooltip>
            <div className="grid grid-cols-2 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
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
                  </div>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Prioridade da tarefa</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Prazo"
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs">Prazo para concluir (opcional)</TooltipContent>
              </Tooltip>
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
            <TaskItem
              key={t.id}
              task={t}
              reminderCount={reminderCounts[t.id] ?? 0}
              onToggle={() => toggleComplete.mutate(t)}
              onSave={(payload) => updateTask.mutate({ id: t.id, ...payload })}
            />
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
                    <TaskItem
                      key={t.id}
                      task={t}
                      reminderCount={reminderCounts[t.id] ?? 0}
                      onToggle={() => toggleComplete.mutate(t)}
                      onSave={(payload) => updateTask.mutate({ id: t.id, ...payload })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function TaskItem({
  task,
  reminderCount,
  onToggle,
  onSave,
}: {
  task: TaskRow;
  reminderCount: number;
  onToggle: () => void;
  onSave: (payload: { title: string; priority: string; due_date: string | null }) => void;
}) {
  const done = task.status === "completed";
  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const overdue =
    !done && task.due_date && new Date(task.due_date) < new Date(new Date().toDateString());

  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState(task.title);
  const [ePrio, setEPrio] = useState(task.priority);
  const [eDate, setEDate] = useState(task.due_date ?? "");

  const startEdit = () => {
    setETitle(task.title);
    setEPrio(task.priority);
    setEDate(task.due_date ?? "");
    setEditing(true);
  };

  const save = () => {
    if (!eTitle.trim()) return;
    onSave({ title: eTitle.trim(), priority: ePrio, due_date: eDate || null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-md border border-primary/40 bg-muted/20 p-2 space-y-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              value={eTitle}
              onChange={(e) => setETitle(e.target.value)}
              className="h-8 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && eTitle.trim()) save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          </TooltipTrigger>
          <TooltipContent className="text-xs">Título da tarefa</TooltipContent>
        </Tooltip>
        <div className="grid grid-cols-2 gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select value={ePrio} onValueChange={setEPrio}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Prioridade</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                type="date"
                value={eDate}
                onChange={(e) => setEDate(e.target.value)}
                className="h-8 text-xs"
              />
            </TooltipTrigger>
            <TooltipContent className="text-xs">Prazo (opcional)</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!eTitle.trim()} className="h-7 text-xs">
            <Check className="h-3.5 w-3.5 mr-1" /> Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-md border border-border bg-card/40 px-2 py-1.5 text-xs font-body",
        done && "opacity-60",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          {done ? "Reabrir tarefa (volta para pendente)" : "Marcar como concluída"}
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "flex-1 min-w-0 truncate text-left hover:text-primary transition-colors",
          done && "line-through",
        )}
        title={`${task.title} (clique para editar)`}
      >
        {task.title}
      </button>
      {reminderCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 text-sky-600 shrink-0">
              <Bell className="h-3 w-3" />
              <span className="text-[10px] font-medium">{reminderCount}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {reminderCount} lembrete{reminderCount > 1 ? "s" : ""} ativo{reminderCount > 1 ? "s" : ""}
          </TooltipContent>
        </Tooltip>
      )}
      <Flag className={cn("h-3 w-3 shrink-0", prio.color)} aria-label={prio.label} />
      {task.due_date && (
        <span className={cn("text-[10px] shrink-0", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
          {format(new Date(task.due_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={startEdit}
            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            aria-label="Editar tarefa"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">Editar rápido</TooltipContent>
      </Tooltip>
      <Link
        to={`/tasks/${task.id}`}
        className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label="Abrir tarefa completa"
        title="Abrir tarefa completa"
      >
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
