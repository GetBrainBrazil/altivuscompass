import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Plus, Trash2, MessageSquare, Mail, Monitor, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isValidPhoneLength } from "@/lib/validators";

interface Props {
  taskId: string;
  assigneePhone?: string | null;
  assigneeName?: string | null;
  autoOpenIfEmpty?: boolean;
}

type Reminder = {
  id: string;
  task_id: string;
  user_id: string;
  remind_at: string;
  channels: string[];
  message: string | null;
  status: string;
  sent_at: string | null;
  delivered_channels: string[];
  error: string | null;
};

const CHANNEL_META = {
  system: { label: "Sistema", Icon: Monitor },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare },
  email: { label: "Email", Icon: Mail },
} as const;

function defaultDate() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d;
}

export function TaskReminders({ taskId, assigneePhone, assigneeName, autoOpenIfEmpty }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draftDate, setDraftDate] = useState(format(defaultDate(), "yyyy-MM-dd"));
  const [draftTime, setDraftTime] = useState(format(defaultDate(), "HH:mm"));
  const [draftChannels, setDraftChannels] = useState<string[]>(["system"]);
  const [draftMsg, setDraftMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSent, setShowSent] = useState(false);

  const assigneeHasWhatsapp = isValidPhoneLength(assigneePhone);

  // Se o responsável mudar e não tiver WhatsApp válido, desmarca o canal do rascunho
  useEffect(() => {
    if (!assigneeHasWhatsapp && draftChannels.includes("whatsapp")) {
      setDraftChannels((cur) => cur.filter((c) => c !== "whatsapp"));
    }
  }, [assigneeHasWhatsapp]); // eslint-disable-line react-hooks/exhaustive-deps

  const isNewTask = !taskId || taskId === "new";

  const { data: reminders = [] } = useQuery({
    queryKey: ["task-reminders", taskId],
    enabled: !isNewTask,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_reminders")
        .select("*")
        .eq("task_id", taskId)
        .order("remind_at", { ascending: true });
      return (data ?? []) as Reminder[];
    },
  });

  const activeCount = reminders.filter((r) => r.status !== "sent" && r.status !== "partial").length;
  useEffect(() => {
    if (autoOpenIfEmpty && !isNewTask && activeCount === 0 && !adding && !editingId) {
      setAdding(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenIfEmpty, isNewTask, activeCount]);

  const resetDraft = () => {
    const d = defaultDate();
    setDraftDate(format(d, "yyyy-MM-dd"));
    setDraftTime(format(d, "HH:mm"));
    setDraftChannels(["system"]);
    setDraftMsg("");
  };

  const startEdit = (r: Reminder) => {
    const d = new Date(r.remind_at);
    setDraftDate(format(d, "yyyy-MM-dd"));
    setDraftTime(format(d, "HH:mm"));
    setDraftChannels(r.channels?.length ? r.channels : ["system"]);
    setDraftMsg(r.message ?? "");
    setEditingId(r.id);
    setAdding(false);
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    resetDraft();
  };

  const saveReminder = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const remindAt = new Date(`${draftDate}T${draftTime}:00`);
      if (isNaN(remindAt.getTime())) throw new Error("Data/hora inválida");
      const channels = draftChannels.includes("system") ? draftChannels : ["system", ...draftChannels];
      if (editingId) {
        const { error } = await supabase
          .from("task_reminders")
          .update({
            remind_at: remindAt.toISOString(),
            channels,
            message: draftMsg.trim() || null,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_reminders").insert({
          task_id: taskId,
          user_id: user.id,
          remind_at: remindAt.toISOString(),
          channels,
          message: draftMsg.trim() || null,
          status: "pending",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-reminders", taskId] });
      const wasEditing = !!editingId;
      cancelForm();
      toast({ title: wasEditing ? "Lembrete atualizado" : "Lembrete criado" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar lembrete", description: e.message, variant: "destructive" }),
  });

  const removeReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-reminders", taskId] }),
  });

  const toggleChannel = (ch: string) => {
    if (ch === "system") return; // sempre obrigatório
    if (ch === "whatsapp" && !assigneeHasWhatsapp) return; // bloqueado sem WA válido
    setDraftChannels((cur) => (cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch]));
  };

  if (isNewTask) {
    return (
      <div>
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-body mb-2">
          <Bell size={12} /> Lembretes
        </div>
        <p className="text-xs text-muted-foreground font-body">
          Salve a tarefa para adicionar lembretes.
        </p>
      </div>
    );
  }

  const activeReminders = reminders.filter((r) => r.status !== "sent" && r.status !== "partial");
  const sentReminders = reminders.filter((r) => r.status === "sent" || r.status === "partial");

  const renderReminder = (r: Reminder) => {
    const isDone = r.status === "sent" || r.status === "partial";
    const isFailed = r.status === "failed";
    return (
      <div
        key={r.id}
        className={cn(
          "rounded-md border border-border bg-card/30 p-2.5 text-xs space-y-1 group",
          isDone && "opacity-60"
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground">
            {format(new Date(r.remind_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {isDone && (
            <Badge variant="secondary" className="h-5 text-[10px] gap-1">
              <Check size={10} /> Enviado
            </Badge>
          )}
          {isFailed && (
            <Badge variant="destructive" className="h-5 text-[10px]">Falhou</Badge>
          )}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isDone && (
              <button
                onClick={() => startEdit(r)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Editar lembrete"
              >
                <Pencil size={12} />
              </button>
            )}
            <button
              onClick={() => removeReminder.mutate(r.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover lembrete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {r.channels.map((ch) => {
            const meta = (CHANNEL_META as any)[ch];
            if (!meta) return null;
            const delivered = r.delivered_channels?.includes(ch);
            const Icon = meta.Icon;
            return (
              <span
                key={ch}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                  delivered
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon size={10} /> {meta.label}
              </span>
            );
          })}
        </div>
        {r.message && (
          <p className="text-muted-foreground whitespace-pre-wrap break-words">{r.message}</p>
        )}
        {isFailed && r.error && (
          <p className="text-destructive/80 text-[10px]">{r.error}</p>
        )}
      </div>
    );
  };

  const showForm = adding || !!editingId;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground font-body">
          <Bell size={12} /> Lembretes ({activeReminders.length})
        </div>
        {!showForm && (
          <Button size="sm" variant="ghost" onClick={() => { resetDraft(); setAdding(true); }} className="h-7 text-xs">
            <Plus size={14} className="mr-1" /> Adicionar
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {showForm && (
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {editingId ? "Editar lembrete" : "Novo lembrete"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</label>
                <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Hora</label>
                <Input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Disparar por</div>
              <div className="flex flex-wrap gap-2">
                {(["system", "whatsapp", "email"] as const).map((ch) => {
                  const meta = CHANNEL_META[ch];
                  const Icon = meta.Icon;
                  const checked = draftChannels.includes(ch);
                  const waDisabled = ch === "whatsapp" && !assigneeHasWhatsapp;
                  const disabled = ch === "system" || waDisabled;
                  const title = waDisabled
                    ? `${assigneeName || "O responsável"} não possui telefone válido para WhatsApp`
                    : undefined;
                  return (
                    <label
                      key={ch}
                      title={title}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs",
                        checked && "bg-primary/10 border-primary/40",
                        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                        ch === "system" && "opacity-90"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggleChannel(ch)}
                        className="h-3.5 w-3.5"
                      />
                      <Icon size={12} /> {meta.label}
                      {ch === "system" && <span className="text-[9px] text-muted-foreground">(padrão)</span>}
                      {waDisabled && <span className="text-[9px] text-muted-foreground">(sem nº)</span>}
                    </label>
                  );
                })}
              </div>
            </div>
            <Textarea
              value={draftMsg}
              onChange={(e) => setDraftMsg(e.target.value)}
              placeholder="Mensagem (opcional, padrão: título da tarefa)"
              className="min-h-[56px] text-xs resize-none"
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelForm} className="h-7 text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => saveReminder.mutate()}
                disabled={saveReminder.isPending}
                className="h-7 text-xs"
              >
                {editingId ? "Salvar alterações" : "Salvar lembrete"}
              </Button>
            </div>
          </div>
        )}

        {activeReminders.map(renderReminder)}

        {sentReminders.length > 0 && (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => setShowSent((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSent ? "Ocultar" : "Ver"} lembretes enviados ({sentReminders.length})
            </button>
            {showSent && sentReminders.map(renderReminder)}
          </div>
        )}

        {!showForm && reminders.length === 0 && (
          <p className="text-xs text-muted-foreground font-body py-2">Nenhum lembrete.</p>
        )}
      </div>
    </div>
  );
}
