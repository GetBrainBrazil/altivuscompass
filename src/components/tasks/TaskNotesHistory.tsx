import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, StickyNote, History, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "A iniciar",
  in_progress: "Em andamento",
  review: "Em revisão",
  completed: "Concluído",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Normal",
  high: "Alta",
};
const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  status: "Status",
  priority: "Importância",
  assigned_to: "Responsável",
  due_date: "Prazo de entrega",
  start_date: "Data de início",
  quote_id: "Cotação",
  client_id: "Cliente",
};

type Filter = "all" | "notes" | "activity";

interface Props {
  taskId: string;
}

export function TaskNotesHistory({ taskId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.user_id, p.full_name));
    return m;
  }, [profiles]);

  const { data: notes = [] } = useQuery({
    queryKey: ["task-notes", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_notes")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_activity")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const content = note.trim();
      if (!content || !user?.id) return;
      const { error } = await supabase
        .from("task_notes")
        .insert({ task_id: taskId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["task-notes", taskId] });
    },
    onError: () => toast({ title: "Erro ao adicionar nota", variant: "destructive" }),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("task_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-notes", taskId] }),
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      addNote.mutate();
    }
  };

  const formatValue = (field: string | null, value: string | null) => {
    if (!value) return "—";
    if (field === "status") return STATUS_LABEL[value] ?? value;
    if (field === "priority") return PRIORITY_LABEL[value] ?? value;
    if (field === "assigned_to") return profileMap.get(value) ?? "Usuário";
    if (field === "due_date" || field === "start_date") {
      try {
        return format(new Date(value), "dd/MM/yyyy");
      } catch {
        return value;
      }
    }
    return value.length > 40 ? value.slice(0, 40) + "…" : value;
  };

  // Combina e ordena
  type Item =
    | { kind: "note"; id: string; created_at: string; user_id: string | null; content: string }
    | { kind: "activity"; id: string; created_at: string; user_id: string | null; action: string; field_name: string | null; old_value: string | null; new_value: string | null };

  const items: Item[] = useMemo(() => {
    const all: Item[] = [
      ...notes.map((n: any) => ({ kind: "note" as const, id: n.id, created_at: n.created_at, user_id: n.user_id, content: n.content })),
      ...activity.map((a: any) => ({ kind: "activity" as const, id: a.id, created_at: a.created_at, user_id: a.user_id, action: a.action, field_name: a.field_name, old_value: a.old_value, new_value: a.new_value })),
    ];
    let filtered = all;
    if (filter === "notes") filtered = filtered.filter((i) => i.kind === "note");
    if (filter === "activity") filtered = filtered.filter((i) => i.kind === "activity");
    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter((i) => {
        const userName = i.user_id ? (profileMap.get(i.user_id) ?? "").toLowerCase() : "";
        if (i.kind === "note") return i.content.toLowerCase().includes(s) || userName.includes(s);
        return (
          (i.field_name ?? "").toLowerCase().includes(s) ||
          (i.new_value ?? "").toLowerCase().includes(s) ||
          (i.old_value ?? "").toLowerCase().includes(s) ||
          userName.includes(s)
        );
      });
    }
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notes, activity, filter, search, profileMap]);

  const initials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  const totalCount = notes.length + activity.length;

  return (
    <div className="space-y-5">
      {/* Adicionar nota */}
      <div>
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-body mb-2">
          <StickyNote size={12} />
          Adicionar nota
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Adicionar uma nota... (Ctrl+Enter para enviar)"
            className="min-h-[72px] resize-none"
          />
          <Button
            size="icon"
            onClick={() => addNote.mutate()}
            disabled={!note.trim() || addNote.isPending}
            className="shrink-0"
            aria-label="Enviar nota"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* Histórico */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-body">
            <History size={12} />
            Histórico ({totalCount})
          </div>
          <div className="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs">
            {([
              { v: "all", l: "Tudo" },
              { v: "notes", l: "Notas" },
              { v: "activity", l: "Atividades" },
            ] as { v: Filter; l: string }[]).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setFilter(opt.v)}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-body transition-colors",
                  filter === opt.v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no histórico..."
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground font-body py-6 text-center">
              Nenhum registro encontrado.
            </p>
          )}
          {items.map((item) => {
            const userName = item.user_id ? (profileMap.get(item.user_id) ?? "Usuário") : "Sistema";
            const date = new Date(item.created_at);
            return (
              <div key={`${item.kind}-${item.id}`} className="flex gap-2.5 group">
                <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                  <AvatarFallback className="text-[10px] bg-muted">{initials(userName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-medium text-foreground font-body">{userName}</span>
                    <span className="text-muted-foreground">{format(date, "dd/MM/yyyy, HH:mm", { locale: ptBR })}</span>
                    {item.kind === "activity" && item.action === "created" && (
                      <span className="text-success font-medium ml-auto">Criação</span>
                    )}
                    {item.kind === "activity" && item.action === "completed" && (
                      <span className="text-success font-medium ml-auto">Concluída</span>
                    )}
                    {item.kind === "note" && item.user_id === user?.id && (
                      <button
                        onClick={() => deleteNote.mutate(item.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        aria-label="Excluir nota"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {item.kind === "note" ? (
                    <p className="mt-1 text-sm text-foreground font-body whitespace-pre-wrap break-words">
                      {item.content}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground font-body">
                      {item.action === "created" ? (
                        <span>Tarefa criada</span>
                      ) : item.field_name ? (
                        <>
                          <span className="text-foreground/80">{FIELD_LABEL[item.field_name] ?? item.field_name}:</span>{" "}
                          <span className="line-through text-muted-foreground/70">{formatValue(item.field_name, item.old_value)}</span>
                          {" → "}
                          <span className="text-foreground">{formatValue(item.field_name, item.new_value)}</span>
                        </>
                      ) : (
                        <span>{item.action}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
