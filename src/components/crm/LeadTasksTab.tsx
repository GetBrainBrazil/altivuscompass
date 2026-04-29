import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ListChecks, Loader2, Check, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/RichTextEditor";
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

const STATUS_OPTIONS = [
  { value: "pending", label: "A iniciar" },
  { value: "in_progress", label: "Em andamento" },
  { value: "review", label: "Em revisão" },
  { value: "completed", label: "Concluída" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Alta" },
];

export function LeadTasksTab({ contactId, contactName }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const emptyForm = {
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    assigned_to: user?.id ?? "",
    quote_id: "none",
    due_date: null as Date | null,
  };
  const [form, setForm] = useState(emptyForm);
  const [duePickerOpen, setDuePickerOpen] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      setForm({ ...emptyForm, assigned_to: user?.id ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

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

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    enabled: dialogOpen,
    queryFn: async () => {
      const { data } = await supabase.from("profiles_basic").select("user_id, full_name");
      return data ?? [];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-list-for-tasks", contactId],
    enabled: dialogOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, title, destination")
        .eq("is_template", false)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const sortedTasks = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "completed");
    const done = tasks
      .filter((t) => t.status === "completed")
      .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
    return [...pending, ...done];
  }, [tasks]);

  const handleCreate = async () => {
    const title = form.title.trim();
    if (!title || !contactId || creating) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title,
        description: form.description || null,
        client_id: contactId,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        quote_id: form.quote_id && form.quote_id !== "none" ? form.quote_id : null,
        due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Tarefa criada");
      setDialogOpen(false);
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
      {/* Header with subtle internal-use note */}
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">✅ Tarefas</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
          <Lock className="h-3 w-3 shrink-0" />
          Estas tarefas são apenas para uso interno da equipe.
        </p>
      </div>

      {/* Quick add (opens modal) */}
      <div className="px-3 py-2.5 border-b border-border bg-background">
        <Input
          readOnly
          onClick={() => setDialogOpen(true)}
          onFocus={() => setDialogOpen(true)}
          placeholder={`Nova tarefa${contactName ? ` para ${contactName}` : ""}...`}
          className="h-9 cursor-pointer"
        />
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

      {/* Create Task Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="md:max-w-2xl md:max-h-[85vh] md:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova tarefa{contactName ? ` — ${contactName}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Título *</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Ligar para confirmar interesse"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Importância</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prazo de Entrega</Label>
                <Popover open={duePickerOpen} onOpenChange={setDuePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start font-normal",
                        !form.due_date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.due_date
                        ? format(form.due_date, "dd/MM/yyyy", { locale: ptBR })
                        : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.due_date ?? undefined}
                      onSelect={(d) => {
                        setForm({ ...form, due_date: d ?? null });
                        setDuePickerOpen(false);
                      }}
                      locale={ptBR}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cotação Vinculada</Label>
              <Select value={form.quote_id} onValueChange={(v) => setForm({ ...form, quote_id: v })}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {quotes.map((q: any) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title || q.destination || q.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <RichTextEditor
                value={form.description}
                onChange={(html) => setForm({ ...form, description: html })}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!form.title.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
