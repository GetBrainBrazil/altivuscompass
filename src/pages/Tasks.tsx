import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CalendarIcon, Plus, Search, CheckCircle2, Clock, AlertCircle, Bell, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendente", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  in_progress: { label: "Em Andamento", color: "bg-soft-blue/10 text-soft-blue border-soft-blue/20", icon: AlertCircle },
  completed: { label: "Concluída", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  medium: { label: "Média", color: "bg-warning/10 text-warning" },
  high: { label: "Alta", color: "bg-destructive/10 text-destructive" },
};

type SortField = "title" | "due_date" | "priority" | "status" | "assigned_to";
type SortDir = "asc" | "desc" | null;

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [quoteFilter, setQuoteFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderTask, setReminderTask] = useState<any>(null);
  const [reminderDate, setReminderDate] = useState<Date>();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assigned_to: "",
    quote_id: "none",
    client_id: "none",
    due_date: null as Date | null,
    start_date: new Date(),
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, quotes(title, destination, clients(full_name)), clients(full_name)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-list-for-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("id, title, destination, clients(full_name)").order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list-for-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").order("full_name").limit(200);
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (taskData: any) => {
      if (editingTask) {
        const { error } = await supabase.from("tasks").update(taskData).eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert({ ...taskData, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: editingTask ? "Tarefa atualizada" : "Tarefa criada" });
      closeDialog();
    },
    onError: () => toast({ title: "Erro ao salvar tarefa", variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "completed" ? "pending" : "completed";
      const update: any = { status: newStatus };
      if (newStatus === "completed") update.completed_at = new Date().toISOString();
      else update.completed_at = null;
      const { error } = await supabase.from("tasks").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-reminders"] });
    },
  });

  const addReminderMutation = useMutation({
    mutationFn: async ({ taskId, remindAt }: { taskId: string; remindAt: string }) => {
      const { error } = await supabase.from("task_reminders").insert({
        task_id: taskId,
        user_id: user!.id,
        remind_at: remindAt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-reminders"] });
      toast({ title: "Lembrete adicionado" });
      setReminderDialogOpen(false);
      setReminderDate(undefined);
    },
    onError: () => toast({ title: "Erro ao adicionar lembrete", variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setForm({ title: "", description: "", priority: "medium", assigned_to: "", quote_id: "none", client_id: "none", due_date: null, start_date: new Date() });
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      assigned_to: task.assigned_to ?? "",
      quote_id: task.quote_id ?? "none",
      client_id: task.client_id ?? "none",
      due_date: task.due_date ? new Date(task.due_date) : null,
      start_date: task.start_date ? new Date(task.start_date) : new Date(),
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    saveMutation.mutate({
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      quote_id: form.quote_id && form.quote_id !== "none" ? form.quote_id : null,
      client_id: form.client_id && form.client_id !== "none" ? form.client_id : null,
      due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : null,
      start_date: form.start_date ? format(form.start_date, "yyyy-MM-dd") : null,
    });
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles.find((p: any) => p.user_id === userId)?.full_name ?? "Usuário";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />;
    if (sortDir === "asc") return <ArrowUp size={12} />;
    return <ArrowDown size={12} />;
  };

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, completed: 2 };

  const filteredTasks = tasks
    .filter((t: any) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
      }
      if (userFilter !== "all" && t.assigned_to !== userFilter) return false;
      if (quoteFilter !== "all") {
        if (quoteFilter === "none" && t.quote_id) return false;
        if (quoteFilter !== "none" && t.quote_id !== quoteFilter) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      if (!sortField || !sortDir) return 0;
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "title") return (a.title ?? "").localeCompare(b.title ?? "") * dir;
      if (sortField === "due_date") {
        const da = a.due_date ?? "9999";
        const db = b.due_date ?? "9999";
        return da.localeCompare(db) * dir;
      }
      if (sortField === "priority") return ((priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)) * dir;
      if (sortField === "status") return ((statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)) * dir;
      if (sortField === "assigned_to") return getAssigneeName(a.assigned_to).localeCompare(getAssigneeName(b.assigned_to)) * dir;
      return 0;
    });

  // Get unique quotes that have tasks for the filter
  const quotesWithTasks = quotes.filter((q: any) => tasks.some((t: any) => t.quote_id === q.id));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Gerencie suas tarefas e acompanhamentos.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus size={16} /> Nova Tarefa
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar tarefas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Usuários</SelectItem>
            {profiles.map((p: any) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quoteFilter} onValueChange={setQuoteFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Cotação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Cotações</SelectItem>
            <SelectItem value="none">Sem cotação</SelectItem>
            {quotesWithTasks.map((q: any) => (
              <SelectItem key={q.id} value={q.id}>
                {q.clients?.full_name ?? "—"} — {q.destination ?? q.title ?? "Sem destino"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground font-body">Carregando...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground font-body">Nenhuma tarefa encontrada.</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="cursor-pointer font-body" onClick={() => handleSort("title")}>
                  <span className="flex items-center gap-1">Título {getSortIcon("title")}</span>
                </TableHead>
                <TableHead className="cursor-pointer font-body hidden md:table-cell" onClick={() => handleSort("assigned_to")}>
                  <span className="flex items-center gap-1">Responsável {getSortIcon("assigned_to")}</span>
                </TableHead>
                <TableHead className="cursor-pointer font-body" onClick={() => handleSort("priority")}>
                  <span className="flex items-center gap-1">Prioridade {getSortIcon("priority")}</span>
                </TableHead>
                <TableHead className="cursor-pointer font-body" onClick={() => handleSort("status")}>
                  <span className="flex items-center gap-1">Status {getSortIcon("status")}</span>
                </TableHead>
                <TableHead className="cursor-pointer font-body hidden sm:table-cell" onClick={() => handleSort("due_date")}>
                  <span className="flex items-center gap-1">Prazo {getSortIcon("due_date")}</span>
                </TableHead>
                <TableHead className="font-body hidden lg:table-cell">Cotação / Cliente</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task: any) => {
                const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
                const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date();

                return (
                  <TableRow
                    key={task.id}
                    className={cn("cursor-pointer hover:bg-muted/30 transition-colors", task.status === "completed" && "opacity-60")}
                    onClick={() => openEdit(task)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={task.status === "completed"}
                        onCheckedChange={() => toggleStatusMutation.mutate({ id: task.id, currentStatus: task.status })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <span className={cn("text-sm font-medium font-body", task.status === "completed" && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                        {task.description && (
                          <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-body">{getAssigneeName(task.assigned_to)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-body whitespace-nowrap", priority.color)}>{priority.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] font-body whitespace-nowrap", status.color)}>{status.label}</Badge>
                      {isOverdue && <Badge variant="destructive" className="text-[10px] font-body ml-1">Atrasada</Badge>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {task.due_date ? (
                        <span className={cn("text-xs font-body whitespace-nowrap", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          {task.due_date.split("-").reverse().join("/")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {task.quotes ? (
                        <span className="text-xs text-soft-blue font-body truncate max-w-[150px] block">
                          {task.quotes.destination ?? task.quotes.title ?? "—"}
                        </span>
                      ) : task.clients ? (
                        <span className="text-xs text-muted-foreground font-body truncate max-w-[150px] block">
                          {(task.clients as any).full_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setReminderTask(task); setReminderDialogOpen(true); }}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Adicionar lembrete"
                      >
                        <Bell size={14} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Task form dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-body text-xs">Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Enviar proposta ao cliente" />
            </div>
            <div>
              <Label className="font-body text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-body text-xs">Responsável</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p: any) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.start_date ?? undefined} onSelect={(d) => setForm({ ...form, start_date: d ?? new Date() })} className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="font-body text-xs">Prazo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.due_date ? format(form.due_date, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.due_date ?? undefined} onSelect={(d) => setForm({ ...form, due_date: d ?? null })} className="p-3 pointer-events-auto" locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Cotação (opcional)</Label>
              <Select value={form.quote_id} onValueChange={(v) => setForm({ ...form, quote_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular a uma cotação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {quotes.map((q: any) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.clients?.full_name ?? "—"} — {q.destination ?? q.title ?? "Sem destino"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body text-xs">Cliente (opcional)</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vincular a um cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{editingTask ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Lembrete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            Tarefa: <strong>{reminderTask?.title}</strong>
          </p>
          <div>
            <Label className="font-body text-xs">Data e hora do lembrete</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !reminderDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reminderDate ? format(reminderDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate} className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!reminderDate || addReminderMutation.isPending}
              onClick={() => {
                if (reminderDate && reminderTask) {
                  addReminderMutation.mutate({ taskId: reminderTask.id, remindAt: reminderDate.toISOString() });
                }
              }}
            >
              Salvar Lembrete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
