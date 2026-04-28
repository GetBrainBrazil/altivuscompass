import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Sender = "lead" | "ai" | "agent";
type Status = "ai" | "human";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  phone: string | null;
  contactId?: string | null;
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

export function LeadWhatsAppPanel({
  open,
  onOpenChange,
  contactName,
  phone,
  contactId,
}: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Busca a conversa pelo contact_id ou pelo sufixo do telefone
  const { data: conversation, isLoading: loadingConv } = useQuery({
    queryKey: ["lead-wa-conversation", contactId, phone],
    enabled: open && (!!contactId || !!phone),
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
    if (!open || !conversationId) return;
    const channel = supabase
      .channel(`lead-wa-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["lead-wa-messages", conversationId] });
          qc.invalidateQueries({ queryKey: ["lead-wa-conversation", contactId, phone] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "wa_conversations", filter: `id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["lead-wa-conversation", contactId, phone] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, conversationId, contactId, phone, qc]);

  // Marca como lida ao abrir
  useEffect(() => {
    if (!open || !conversationId) return;
    (async () => {
      await supabase.from("wa_conversations").update({ unread_count: 0 }).eq("id", conversationId);
    })();
  }, [open, conversationId]);

  // Auto scroll
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
  }, [normalizedMessages.length, open]);

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col w-full sm:max-w-none sm:w-[35vw] sm:min-w-[420px] gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border space-y-3 text-left">
          <div className="flex items-center gap-3 pr-8">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                {getInitials(contactName || "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold truncate">
                {contactName || "Contato"}
              </SheetTitle>
              {phone && (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {formatPhoneDisplay(phone)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge()}
          </div>
        </SheetHeader>

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
                        "flex w-full flex-col gap-1",
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
                        {!isLead && (
                          <p
                            className={cn(
                              "text-[9px] font-semibold uppercase tracking-wider mb-0.5 opacity-80",
                              isAi ? "text-[hsl(var(--cream))]" : "text-emerald-50",
                            )}
                          >
                            {isAi ? "🤖 IA" : "👤 Agente"}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground px-2">
                        {formatTime(m.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Composer */}
        {conversation && (
          <div className="border-t border-border p-3 bg-background">
            {canType ? (
              <div className="flex items-end gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={sending}
                  className="h-10"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="h-10 w-10 shrink-0"
                >
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center">
                A IA está conduzindo este atendimento. Assuma o atendimento na Central para responder.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
