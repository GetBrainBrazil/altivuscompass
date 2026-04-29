import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageCircle,
  Phone,
  SendHorizontal,
  Bot,
  UserRound,
  ExternalLink,
  X,
  ListChecks,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LeadQuickNote, type QuickNoteFormSnapshot, type QuickNoteSuggestion } from "@/components/crm/LeadQuickNote";
import { LeadTasksTab } from "@/components/crm/LeadTasksTab";

type Sender = "lead" | "ai" | "agent";
type Status = "ai" | "human";

interface Props {
  onClose: () => void;
  contactName: string;
  phone: string | null;
  contactId?: string | null;
  leadId?: string | null;
  formSnapshot?: QuickNoteFormSnapshot;
  onApplyNoteSuggestion?: (s: QuickNoteSuggestion) => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatPhoneDisplay = (phone: string) => {
  const m = phone.match(/^\+?(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return phone;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export function LeadWhatsAppColumn({ onClose, contactName, phone, contactId, leadId, formSnapshot, onApplyNoteSuggestion }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Consultor");
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");

  // Nome do usuário atual (para exibir abaixo do balão de agente)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      setCurrentUserName(data?.full_name || data?.email || "Consultor");
    })();
    return () => { cancelled = true; };
  }, []);

  const { data: conversation, isLoading: loadingConv } = useQuery({
    queryKey: ["lead-wa-conversation", contactId, phone],
    enabled: !!contactId || !!phone,
    queryFn: async () => {
      if (contactId) {
        const { data } = await supabase
          .from("wa_conversations")
          .select("*")
          .eq("contact_id", contactId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        if (data) return data;
      }
      const tail = onlyDigits(phone || "").slice(-9);
      if (!tail) return null;
      const { data } = await supabase
        .from("wa_conversations")
        .select("*")
        .ilike("phone", `%${tail}%`)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(5);
      const found = (data || []).find((c: any) =>
        onlyDigits(c.phone || "").endsWith(tail),
      );
      return found ?? null;
    },
  });

  const conversationId = (conversation as any)?.id ?? null;
  const status: Status = ((conversation as any)?.status === "human" ? "human" : "ai") as Status;

  const { data: messages = [] } = useQuery({
    queryKey: ["lead-wa-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`lead-wa-col-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["lead-wa-messages", conversationId] });
          qc.invalidateQueries({ queryKey: ["lead-wa-conversation", contactId, phone] });
          qc.invalidateQueries({ queryKey: ["lead-wa-unread", contactId, phone] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wa_conversations", filter: `id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["lead-wa-conversation", contactId, phone] });
          qc.invalidateQueries({ queryKey: ["lead-wa-unread", contactId, phone] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, contactId, phone, qc]);

  // Marca como lida
  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      await supabase.from("wa_conversations").update({ unread_count: 0 }).eq("id", conversationId);
      qc.invalidateQueries({ queryKey: ["lead-wa-unread", contactId, phone] });
    })();
  }, [conversationId, contactId, phone, qc]);

  const normalizedMessages = useMemo(
    () =>
      (messages as any[]).map((m) => ({
        id: m.id,
        sender: (m.sender ?? "lead") as Sender,
        content:
          m.message_type === "text"
            ? (m.content ?? "")
            : m.message_type === "image"
              ? `📷 ${m.media_caption ?? "Imagem"}`
              : m.message_type === "audio"
                ? `🎤 Áudio`
                : m.message_type === "video"
                  ? `🎥 ${m.media_caption ?? "Vídeo"}`
                  : m.message_type === "document"
                    ? `📄 ${m.media_caption ?? "Documento"}`
                    : (m.content ?? "Mensagem"),
        timestamp: m.created_at,
      })),
    [messages],
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [normalizedMessages.length]);

  const canType = status === "human";

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    const targetPhone = (conversation as any)?.phone || phone;
    if (!targetPhone) {
      toast.error("Telefone do contato não encontrado.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { action: "send-text", phone: targetPhone, message: draft.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDraft("");
      qc.invalidateQueries({ queryKey: ["lead-wa-messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["lead-wa-conversation", contactId, phone] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const openWhatsAppExternal = () => {
    if (!phone) return;
    const digits = onlyDigits(phone);
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  };

  const statusBadge = () => {
    if (!conversation) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border">
          Sem conversa
        </span>
      );
    }
    if (status === "ai") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success border border-success/25">
          <Bot className="h-3 w-3" /> IA conduzindo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-warning/20 text-warning border border-warning/30">
        <UserRound className="h-3 w-3" /> Atendimento humano
      </span>
    );
  };

  return (
    <aside className="flex flex-col h-full bg-background border-l border-border animate-slide-in-right">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
            {getInitials(contactName || "?")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-foreground">
            {contactName || "Contato"}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {phone && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatPhoneDisplay(phone)}
              </span>
            )}
            {statusBadge()}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -mr-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Fechar conversa"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs: Conversa / Tarefas */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-0 border-b border-border bg-background">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-t-md text-xs font-medium border-b-2 transition-colors",
            activeTab === "chat"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" /> Conversa
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-t-md text-xs font-medium border-b-2 transition-colors",
            activeTab === "tasks"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <ListChecks className="h-3.5 w-3.5" /> Tarefas
        </button>
      </div>

      {activeTab === "tasks" ? (
        <LeadTasksTab contactId={contactId} contactName={contactName} />
      ) : (
        <>
      {/* Nota rápida — fixa abaixo do header */}
      {leadId && onApplyNoteSuggestion && (
        <LeadQuickNote
          leadId={leadId}
          form={formSnapshot ?? {}}
          onApplySuggestion={onApplyNoteSuggestion}
        />
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-900/40">
        {loadingConv ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Carregando conversa...
          </div>
        ) : !conversation ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Nenhuma conversa encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Este contato ainda não tem histórico de WhatsApp.
              </p>
            </div>
            {phone && (
              <Button size="sm" onClick={openWhatsAppExternal} className="mt-2">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Iniciar conversa
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="flex flex-col gap-3 p-4">
              {normalizedMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Sem mensagens nesta conversa.
                </p>
              )}
              {normalizedMessages.map((m) => {
                const isLead = m.sender === "lead";
                const isAi = m.sender === "ai";
                const isAgent = m.sender === "agent";
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex w-full flex-col gap-0.5",
                      isLead ? "items-start" : "items-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                        isLead && "bg-white text-foreground rounded-bl-md border border-border/40",
                        isAi && "bg-[hsl(var(--navy))] text-[hsl(var(--cream))] rounded-br-md",
                        isAgent && "bg-emerald-600 text-white rounded-br-md",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2">
                      {isAgent && (
                        <span className="text-[10px] text-muted-foreground">
                          {currentUserName}
                        </span>
                      )}
                      {isAi && (
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          <Bot className="h-2.5 w-2.5" /> IA
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {!isLead && "·"} {formatTime(m.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-border p-3 bg-background">
        <Button
          type="button"
          className="w-full h-11"
          onClick={() => {
            const target = conversationId
              ? `/service-center?conversation=${conversationId}`
              : "/service-center";
            window.open(target, "_blank", "noopener,noreferrer");
          }}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Ir para a Central de Atendimento
          <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-80" />
        </Button>
      </div>
        </>
      )}
    </aside>
  );
}
