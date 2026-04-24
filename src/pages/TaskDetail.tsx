import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TaskAttachments } from "@/components/TaskAttachments";
import { TaskNotesHistory } from "@/components/tasks/TaskNotesHistory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, CalendarIcon, CheckSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "pending", label: "A iniciar", dot: "bg-warning" },
  { value: "in_progress", label: "Em andamento", dot: "bg-soft-blue" },
  { value: "review", label: "Em revisão", dot: "bg-purple-500" },
  { value: "completed", label: "Concluída", dot: "bg-success" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa", dot: "bg-muted-foreground" },
  { value: "medium", label: "Normal", dot: "bg-muted-foreground" },
  { value: "high", label: "Alta", dot: "bg-destructive" },
];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get("status") as string) || "pending";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: initialStatus,
    assigned_to: "",
    quote_id: "none",
    client_id: "none",
    due_date: null as Date | null,
    start_date: new Date() as Date | null,
  });

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
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
      const { data } = await supabase
        .from("quotes")
        .select("id, title, destination, clients(full_name)")
        .eq("is_template", false)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
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

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title ?? "",
        description: task.description ?? "",
        priority: task.priority ?? "medium",
        status: task.status ?? "pending",
        assigned_to: task.assigned_to ?? "",
        quote_id: task.quote_id ?? "none",
        client_id: task.client_id ?? "none",
        due_date: task.due_date ? new Date(task.due_date) : null,
        start_date: task.start_date ? new Date(task.start_date) : new Date(),
      });
    } else if (isNew && user?.id && !form.assigned_to) {
      setForm((f) => ({ ...f, assigned_to: user.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, isNew, user?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        status: form.status,
        assigned_to: form.assigned_to || null,
        quote_id: form.quote_id && form.quote_id !== "none" ? form.quote_id : null,
        client_id: form.client_id && form.client_id !== "none" ? form.client_id : null,
        due_date: form.due_date ? format(form.due_date, "yyyy-MM-dd") : null,
        start_date: form.start_date ? format(form.start_date, "yyyy-MM-dd") : null,
        completed_at: form.status === "completed" ? (task?.completed_at ?? new Date().toISOString()) : null,
      };
      let savedId = id!;
      const activityRows: any[] = [];
      if (isNew) {
        const { data: inserted, error } = await supabase
          .from("tasks")
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (error) throw error;
        savedId = inserted.id;
        activityRows.push({
          task_id: savedId,
          user_id: user?.id ?? null,
          action: "created",
        });
      } else {
        const { error } = await supabase.from("tasks").update(payload).eq("id", id!);
        if (error) throw error;
        // Diff de campos relevantes para o histórico
        const trackable: Array<keyof typeof payload> = [
          "title", "description", "priority", "status",
          "assigned_to", "quote_id", "client_id", "due_date", "start_date",
        ];
        for (const field of trackable) {
          const before = (task as any)?.[field] ?? null;
          const after = payload[field] ?? null;
          const beforeStr = before == null ? null : String(before);
          const afterStr = after == null ? null : String(after);
          if (beforeStr !== afterStr) {
            activityRows.push({
              task_id: savedId,
              user_id: user?.id ?? null,
              action: field === "status" && afterStr === "completed"
                ? "completed"
                : field === "status" ? "status_changed"
                : field === "assigned_to" ? "assigned"
                : "updated",
              field_name: field as string,
              old_value: beforeStr,
              new_value: afterStr,
            });
          }
        }
      }
      if (activityRows.length > 0) {
        await supabase.from("task_activity").insert(activityRows);
      }
      // Upload de anexos pendentes (criação)
      if (pendingFiles.length > 0) {
        for (const f of pendingFiles) {
          const ext = f.name.split(".").pop() || "bin";
          const path = `${savedId}/${crypto.randomUUID()}.${ext}`;
          const up = await supabase.storage.from("task-attachments").upload(path, f, { contentType: f.type });
          if (up.error) continue;
          await supabase.from("task_attachments").insert({
            task_id: savedId,
            file_name: f.name,
            file_path: path,
            file_type: f.type,
            file_size: f.size,
            uploaded_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", id] });
      toast({ title: isNew ? "Tarefa criada" : "Tarefa atualizada" });
      navigate("/tasks");
    },
    onError: () => toast({ title: "Erro ao salvar tarefa", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: "Informe o título da tarefa", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  if (!isNew && isLoading) {
    return <div className="text-center py-16 text-muted-foreground font-body">Carregando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 pb-5 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate("/tasks")}
            className="mt-1 p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CheckSquare size={20} className="text-warning" />
              <h1 className="text-xl sm:text-2xl font-display font-semibold text-foreground truncate">
                {isNew ? "Nova Tarefa" : form.title || "Editar Tarefa"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {isNew ? "Preencha os dados para criar uma nova tarefa." : "Atualize os dados da tarefa."}
            </p>
          </div>
        </div>
      </div>

      <div className={cn("py-6 grid gap-6", !isNew && "lg:grid-cols-[minmax(0,1fr)_360px]")}>
        {/* Form */}
        <div className="space-y-5 min-w-0">
          <div className="space-y-5">
            <div>
          <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Título *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Nome da tarefa..."
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Responsável</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p: any) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Importância</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", p.dot)} />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Prazo de entrega</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full mt-1.5 justify-start text-left font-normal", !form.due_date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.due_date ? format(form.due_date, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.due_date ?? undefined} onSelect={(d) => setForm({ ...form, due_date: d ?? null })} className="p-3 pointer-events-auto" locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Cotação vinculada</Label>
            <Select
              value={form.quote_id}
              onValueChange={(v) => setForm({ ...form, quote_id: v, client_id: v !== "none" ? "none" : form.client_id })}
            >
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
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
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">Cliente vinculado</Label>
            <Select
              value={form.client_id}
              onValueChange={(v) => setForm({ ...form, client_id: v, quote_id: v !== "none" ? "none" : form.quote_id })}
            >
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <FileText size={12} /> Descrição
          </Label>
          <div className="mt-1.5">
            <RichTextEditor
              value={form.description}
              onChange={(html) => setForm({ ...form, description: html })}
              placeholder="Descreva os detalhes da tarefa..."
              uploadFolder={isNew ? "new" : id!}
            />
          </div>
        </div>

        <TaskAttachments
          taskId={isNew ? null : id!}
          pending={pendingFiles}
          onPendingChange={setPendingFiles}
        />
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={() => navigate("/tasks")}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {isNew ? "Criar Tarefa" : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
