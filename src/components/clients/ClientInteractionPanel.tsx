import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Paperclip, Send, Trash2, StickyNote, Phone, Mail, Calendar as CalIcon,
  MessageSquare, History, FileText, Loader2, X, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "note" | "call" | "email" | "meeting" | "other";

interface Attachment {
  path: string;
  name: string;
  size: number;
  mime: string;
}

interface InteractionRow {
  id: string;
  contact_id: string;
  user_id: string;
  user_name: string | null;
  kind: Kind;
  content: string;
  attachments: Attachment[];
  created_at: string;
}

interface AuditRow {
  id: string;
  user_name: string | null;
  action: string;
  table_name: string;
  new_data: any;
  old_data: any;
  created_at: string;
}

interface Props {
  contactId: string | null;
  clientId: string | null;
}

const KIND_OPTIONS: { value: Kind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "note", label: "Nota", icon: StickyNote },
  { value: "call", label: "Ligação", icon: Phone },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "meeting", label: "Reunião", icon: CalIcon },
  { value: "other", label: "Outro", icon: MessageSquare },
];

const kindMeta = (k: Kind) => KIND_OPTIONS.find((o) => o.value === k) || KIND_OPTIONS[0];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const relative = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return formatDateTime(iso);
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  full_name: "Nome",
  birth_date: "Nascimento",
  gender: "Sexo",
  cpf_cnpj: "CPF/CNPJ",
  rating: "Qualificação",
  travel_profile: "Perfil de viagem",
  website: "Site",
  notes: "Observações",
  is_active: "Ativo",
  email: "E-mail",
  phone: "Telefone",
  address: "Endereço",
  city: "Cidade",
  state: "Estado",
  country: "País",
  zip_code: "CEP",
};

export function ClientInteractionPanel({ contactId, clientId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<Kind>("note");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Interações
  const { data: interactions = [], isLoading: loadingInter } = useQuery({
    queryKey: ["client-interactions", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_interactions" as any)
        .select("*")
        .eq("contact_id", contactId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as InteractionRow[];
    },
  });

  // Audit logs do contato e do cliente
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["client-audit", contactId, clientId],
    enabled: !!(contactId || clientId),
    queryFn: async () => {
      const ids = [contactId, clientId].filter(Boolean) as string[];
      const { data } = await supabase
        .from("audit_logs")
        .select("id,user_name,action,table_name,new_data,old_data,created_at,record_id")
        .in("record_id", ids)
        .in("table_name", ["contacts", "clients"])
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  // Timeline unificada
  const timeline = useMemo(() => {
    const items: Array<
      | { type: "interaction"; row: InteractionRow; at: number }
      | { type: "audit"; row: AuditRow; at: number }
    > = [];
    for (const r of interactions) items.push({ type: "interaction", row: r, at: new Date(r.created_at).getTime() });
    for (const r of auditLogs) items.push({ type: "audit", row: r, at: new Date(r.created_at).getTime() });
    return items.sort((a, b) => b.at - a.at);
  }, [interactions, auditLogs]);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const uploadAttachments = async (): Promise<Attachment[]> => {
    if (!files.length || !contactId) return [];
    const uploaded: Attachment[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop() || "bin";
      const path = `client-interactions/${contactId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("task-attachments")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (error) throw error;
      uploaded.push({ path, name: f.name, size: f.size, mime: f.type || "application/octet-stream" });
    }
    return uploaded;
  };

  const submit = async () => {
    if (!contactId) {
      toast({ title: "Contato não vinculado ainda", description: "Salve o cliente antes de registrar interações.", variant: "destructive" });
      return;
    }
    if (!content.trim() && files.length === 0) return;
    if (!user) return;
    setSubmitting(true);
    try {
      const attachments = await uploadAttachments();
      const userName = (user.user_metadata as any)?.full_name || user.email || "Usuário";
      const insertData = {
        contact_id: contactId,
        user_id: user.id,
        user_name: userName,
        kind,
        content: content.trim(),
        attachments,
      };
      const { data, error } = await supabase
        .from("client_interactions" as any)
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      const row = data as any;
      await logAuditEvent({
        action: "create",
        tableName: "client_interactions",
        recordId: row.id,
        recordLabel: `${kindMeta(kind).label} — ${contactId}`,
        newData: { kind, content: content.trim(), attachments: attachments.length },
      });
      setContent("");
      setFiles([]);
      setKind("note");
      qc.invalidateQueries({ queryKey: ["client-interactions", contactId] });
      toast({ title: "Interação registrada" });
    } catch (err: any) {
      toast({ title: "Falha ao registrar", description: err?.message ?? "Erro desconhecido", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const removeInteraction = async (row: InteractionRow) => {
    if (!confirm("Excluir esta interação?")) return;
    const { error } = await supabase
      .from("client_interactions" as any)
      .delete()
      .eq("id", row.id);
    if (error) {
      toast({ title: "Falha ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    await logAuditEvent({
      action: "delete",
      tableName: "client_interactions",
      recordId: row.id,
      oldData: { kind: row.kind, content: row.content },
    });
    qc.invalidateQueries({ queryKey: ["client-interactions", contactId] });
  };

  const openAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(att.path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (!contactId) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-sm text-muted-foreground font-body">
        Salve o cliente para começar a registrar interações.
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:sticky lg:top-4">
      {/* Composer */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-display font-semibold text-foreground">Interação</h3>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="inline-flex items-center gap-2"><Icon className="h-3.5 w-3.5" />{o.label}</span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Descreva a interação com o cliente..."
          rows={3}
          className="resize-y min-h-[80px] text-sm"
        />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-body">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs font-body"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexar
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onPickFiles} />
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs font-body"
            onClick={submit}
            disabled={submitting || (!content.trim() && files.length === 0)}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Registrar
          </Button>
        </div>
      </div>

      {/* Histórico */}
      <div className="glass-card rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold text-foreground">Histórico</h3>
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-2">
          {loadingInter && (
            <div className="text-xs text-muted-foreground font-body py-4 text-center">Carregando...</div>
          )}
          {!loadingInter && timeline.length === 0 && (
            <div className="text-xs text-muted-foreground font-body py-6 text-center">
              Nenhuma atividade registrada ainda.
            </div>
          )}
          {timeline.map((item) =>
            item.type === "interaction" ? (
              <InteractionItem
                key={`i-${item.row.id}`}
                row={item.row}
                currentUserId={user?.id ?? null}
                onDelete={() => removeInteraction(item.row)}
                onOpenAttachment={openAttachment}
              />
            ) : (
              <AuditItem key={`a-${item.row.id}`} row={item.row} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function InteractionItem({
  row, currentUserId, onDelete, onOpenAttachment,
}: {
  row: InteractionRow;
  currentUserId: string | null;
  onDelete: () => void;
  onOpenAttachment: (a: Attachment) => void;
}) {
  const meta = kindMeta(row.kind);
  const Icon = meta.icon;
  const canDelete = currentUserId && currentUserId === row.user_id;
  return (
    <div className="rounded-lg border border-border bg-card/40 p-2.5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-body">
            <span className="font-medium text-foreground">{row.user_name || "Usuário"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{meta.label}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-auto text-muted-foreground">{relative(row.created_at)}</span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{formatDateTime(row.created_at)}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {row.content && (
            <p className="mt-1 text-xs text-foreground whitespace-pre-wrap break-words font-body">
              {row.content}
            </p>
          )}
          {row.attachments && row.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {row.attachments.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenAttachment(a)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-body hover:bg-muted"
                >
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <Download className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive shrink-0"
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AuditItem({ row }: { row: AuditRow }) {
  const fields = useMemo(() => {
    const nd = (row.new_data && typeof row.new_data === "object") ? row.new_data : {};
    return Object.keys(nd)
      .filter((k) => k !== "_label")
      .map((k) => AUDIT_FIELD_LABELS[k] || k);
  }, [row.new_data]);

  const actionLabel = row.action === "CREATE" ? "Criou" : row.action === "DELETE" ? "Excluiu" : "Atualizou";
  const target = row.table_name === "clients" ? "cliente" : "contato";

  return (
    <div className={cn("rounded-lg border border-dashed border-border/70 bg-muted/20 p-2.5")}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <History className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-body">
            <span className="font-medium text-foreground">{row.user_name || "Sistema"}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{actionLabel} {target}</span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="ml-auto text-muted-foreground">{relative(row.created_at)}</span>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{formatDateTime(row.created_at)}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {fields.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground font-body">
              Campos: {fields.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
