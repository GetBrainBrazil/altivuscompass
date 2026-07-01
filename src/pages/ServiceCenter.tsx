import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search,
  SendHorizontal,
  MessageSquare,
  UserRound,
  Phone,
  PanelRightClose,
  PanelRightOpen,
  MapPin,
  Users,
  CalendarRange,
  Wallet,
  Sparkles,
  ArrowRightLeft,
  UserPlus,
  UserCheck,
  LifeBuoy,
  TrendingUp,
  ExternalLink,
  Plane,
  FileText,
  AlertTriangle,
  AlertCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import { NewMessageDialog } from "@/components/service-center/NewMessageDialog";
import { ClientSidePanel } from "@/components/service-center/ClientSidePanel";
import { MessageLinkDialog } from "@/components/service-center/MessageLinkDialog";
import { ForwardMessageDialog, type ForwardableMessage, type ForwardTarget } from "@/components/service-center/ForwardMessageDialog";
import { ImageLightbox } from "@/components/service-center/ImageLightbox";
import { Plus, Info, Bot, Check, CheckCheck, Clock, Mic, Square, Trash2, Loader2, Link2, MoreVertical, Pencil, Paperclip, Forward } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FilterTab = "all" | "clientes" | "leads" | "prospects";

/** Categoria detectada pela IA: lead de vendas (entra no funil) ou pós-venda/suporte (não entra no funil). */
type ContactCategory = "sales" | "post-sale";

/** Tipo do contato: novo no sistema ou cliente já existente no CRM. */
type ContactType = "new-lead" | "existing-client";

interface CRMLink {
  /** Cliente vinculado (existente ou rascunho criado a partir do lead). */
  clientId?: string;
  clientName?: string;
  /** Cotação relacionada (quando aplicável). */
  quoteId?: string;
  quoteTitle?: string;
  /** Operação/viagem em andamento (para casos de pós-venda). */
  tripId?: string;
  tripTitle?: string;
  /** Estágio atual no kanban do CRM. */
  stage?: string;
}

// ============= Types =============
type MessageSender = "lead" | "ai" | "agent";

type MessageStatus = "pending" | "sent" | "received" | "read" | "played" | "failed";

interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: string; // ISO
  status?: MessageStatus;
  messageType?: "text" | "image" | "audio" | "video" | "document" | "sticker";
  mediaUrl?: string;
  mediaMime?: string;
  mediaCaption?: string;
  isInternal?: boolean;
  /** Em conversas de grupo: nome do participante que enviou. */
  senderName?: string;
  /** Em conversas de grupo: telefone do participante que enviou. */
  senderPhone?: string;
}

type ConversationStatus = "ai" | "human";

interface LeadSummary {
  destination?: string;
  travelers?: string;
  duration?: string;
  budget?: string;
  notes: string[];
}

interface LastTrip {
  destination: string;
  date: string; // ISO
}

interface Conversation {
  id: string;
  leadName: string;
  phone: string;
  status: ConversationStatus;
  messages: Message[];
  summary: LeadSummary;
  /** id of the last AI message before human takeover */
  handoffAfterMessageId?: string;
  /** Categoria detectada pela IA. */
  category: ContactCategory;
  /** Se é cliente novo ou já existe no CRM. */
  contactType: ContactType;
  /** Vínculo com o CRM (cliente, cotação, viagem). */
  crm: CRMLink;
  /** Nível na hierarquia de contatos (Prospect / Lead / Cliente). */
  level: ContactLevel;
  /** Última viagem realizada (para clientes). */
  lastTrip?: LastTrip;
  /** Cliente está em viagem agora (prioridade máxima na lista). */
  isTraveling?: boolean;
  /** Conversa nova (primeiro contato, ainda não lida). */
  isNew?: boolean;
  /** IDs para deep-link no CRM. */
  leadId?: string;
  contactId?: string;
  /** Datas e flag de reativação vindas do contato no CRM. */
  firstContactAt?: string;
  lastContactAt?: string;
  isReturning?: boolean;
  /** Quantidade de mensagens recebidas não lidas (incrementado pelo webhook). */
  unreadCount?: number;
  /** Conversa é um grupo do WhatsApp. */
  isGroup?: boolean;
  /** Nome do grupo (subject). */
  groupSubject?: string;
  /** ID do grupo no WhatsApp. */
  groupId?: string;
  /** Foto de perfil do WhatsApp (capturada via webhook). */
  photoUrl?: string;
}

// Conversas reais vêm do banco (wa_conversations / wa_messages) via Realtime.

// ============= Helpers =============
const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatConversationTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Ontem";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("pt-BR", sameYear
    ? { day: "2-digit", month: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "2-digit" });
};

// Formata telefone para exibição (BR: +55 (21) 99999-9999). Para outros países,
// devolve "+<digits>" agrupado.
const formatPhoneDisplay = (raw: string): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return raw || "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const cc = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `+${cc} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+${cc} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return `+${digits}`;
};

const formatPhone = (phone: string) => {
  const m = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/);
  if (!m) return phone;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
};

const getLastMessage = (c: Conversation) => c.messages[c.messages.length - 1];

/**
 * Hook compartilhado: abre a ficha do lead no CRM (mesma rota usada quando o
 * consultor clica no card no Kanban). Verifica se o lead ainda existe no banco
 * antes de navegar; caso contrário, expõe um diálogo para criar o card.
 */
function useOpenLeadInCRM() {
  const navigate = useNavigate();
  const [missingDialog, setMissingDialog] = useState<null | {
    phone: string;
    name: string;
    contactId?: string;
  }>(null);
  const [creating, setCreating] = useState(false);

  const goToLead = (leadId: string, displayName?: string, phone?: string) => {
    try {
      sessionStorage.setItem(
        `crm:lead:lead-${leadId}`,
        JSON.stringify({
          id: `lead-${leadId}`,
          clientName: displayName || phone || "Lead",
          phone,
          isAILead: true,
        }),
      );
    } catch { /* ignore */ }
    navigate(`/crm/lead/lead-${leadId}?stage=new-leads`);
  };

  /**
   * Tenta abrir a ficha do lead. Se o vínculo não existir (ou tiver sido
   * removido no banco), abre o dialog para criar o card retroativamente.
   */
  const openLead = async (params: {
    leadId?: string;
    contactId?: string;
    name: string;
    phone: string;
  }) => {
    const { leadId, contactId, name, phone } = params;

    // Caminho normal: temos leadId — confirma no banco antes de navegar
    if (leadId) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone")
        .eq("id", leadId)
        .maybeSingle();
      if (!error && data) {
        goToLead(data.id, data.full_name || name, data.phone || phone);
        return;
      }
    }

    // Sem leadId ou registro inexistente: pede confirmação para criar
    setMissingDialog({ phone, name, contactId });
  };

  const createCardAndOpen = async () => {
    if (!missingDialog) return;
    setCreating(true);
    try {
      // Verifica novamente por sufixo do telefone (race com webhook)
      const tail = (missingDialog.phone || "").replace(/\D/g, "").slice(-9);
      if (tail) {
        const { data: existing } = await supabase
          .from("leads")
          .select("id, full_name, phone")
          .ilike("phone", `%${tail}%`)
          .order("created_at", { ascending: false })
          .limit(5);
        const found = (existing || []).find((l) =>
          (l.phone || "").replace(/\D/g, "").endsWith(tail),
        );
        if (found) {
          goToLead(found.id, found.full_name || missingDialog.name, found.phone || missingDialog.phone);
          setMissingDialog(null);
          return;
        }
      }

      const { data: created, error } = await supabase
        .from("leads")
        .insert({
          full_name: missingDialog.name || missingDialog.phone,
          phone: missingDialog.phone || null,
          source: "whatsapp",
          status: "new",
        })
        .select("id, full_name, phone")
        .single();
      if (error) throw error;
      // Vincula ao contact se houver
      if (missingDialog.contactId) {
        await supabase
          .from("contacts")
          .update({ lead_id: created.id })
          .eq("id", missingDialog.contactId);
      }
      toast.success("Card criado no Funil de Vendas.");
      goToLead(created.id, created.full_name || missingDialog.name, created.phone || missingDialog.phone);
      setMissingDialog(null);
    } catch (err) {
      console.error("[useOpenLeadInCRM] create error:", err);
      toast.error("Não foi possível criar o card. Tente novamente.");
    } finally {
      setCreating(false);
    }
  };

  const dialog = (
    <AlertDialog
      open={!!missingDialog}
      onOpenChange={(o) => { if (!o && !creating) setMissingDialog(null); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Card não encontrado no Funil</AlertDialogTitle>
          <AlertDialogDescription>
            Não localizamos o card deste contato no Kanban do Funil de Vendas.
            Deseja criar o card agora e abrir a ficha do lead?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={creating}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={createCardAndOpen} disabled={creating}>
            {creating ? "Criando..." : "Criar card e abrir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { openLead, dialog };
}

// ============= Subcomponents =============
interface ConversationCardProps {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  aiGloballyPaused?: boolean;
}

const ConversationCard = ({ conversation, active, onClick, aiGloballyPaused = false }: ConversationCardProps) => {
  const last = getLastMessage(conversation);
  const isAi = conversation.status === "ai" && !aiGloballyPaused;
  const hasUnread = (conversation.unreadCount ?? 0) > 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left border-b border-border/30 transition-colors duration-150",
        "hover:bg-muted/20",
        active && "bg-muted/40",
        hasUnread && "bg-amber-50/30 hover:bg-amber-50/50",
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="relative shrink-0 self-center">
          <Avatar className="h-11 w-11">
            {conversation.photoUrl && <AvatarImage src={conversation.photoUrl} alt={conversation.leadName} />}
            <AvatarFallback className="text-xs font-medium bg-muted text-muted-foreground">
              {getInitials(conversation.leadName)}
            </AvatarFallback>
          </Avatar>
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-background" />
          )}
          {active && (
            <span
              aria-hidden
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                isAi ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
          )}
        </div>
        <div className="min-w-0 flex-1 self-center">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm truncate", hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
              {conversation.leadName}
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
              {formatConversationTime(last.timestamp)}
            </span>
          </div>
          <p className={cn(
            "text-xs line-clamp-1 mt-0.5 leading-snug",
            hasUnread ? "text-foreground font-medium" : "text-muted-foreground",
          )}>
            {last.sender === "ai" ? "IA: " : last.sender === "agent" ? "Você: " : ""}
            {last.content}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {conversation.isGroup && (
              <span className="text-[10px] font-medium text-violet-600">
                👥 Grupo
              </span>
            )}
            {!conversation.isGroup && (
              <span className={cn(
                "text-[10px] font-medium",
                conversation.level === "cliente" ? "text-amber-600" :
                conversation.level === "lead" ? "text-sky-600" : "text-slate-500",
              )}>
                {conversation.level === "cliente" ? "Cliente" : conversation.level === "lead" ? "Lead" : "Prospect"}
              </span>
            )}
            {conversation.isNew && (
              <span className="text-[10px] font-medium text-emerald-600">Novo</span>
            )}
            {conversation.isTraveling && (
              <span className="text-[10px] font-medium text-amber-600">Em viagem</span>
            )}
            {conversation.category === "post-sale" && !conversation.isTraveling && (
              <span className="text-[10px] font-medium text-rose-500">Pós-venda</span>
            )}
            <span className={cn(
              "text-[10px] font-medium",
              isAi ? "text-emerald-600" : "text-amber-600",
            )}>
              {isAi ? "IA" : "Humano"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

interface ChatBubbleProps {
  message: Message;
  agentLabel?: string;
  linkedQuotes?: { id: string; title: string | null; destination: string | null }[];
  onLinkClick?: () => void;
  onOpenQuote?: (id: string) => void;
  onImageClick?: (url: string, caption?: string | null) => void;
  onForward?: () => void;
}

const AGENT_LABEL_RE = /^\*([^\n*]{1,60})\*\n?/;
const extractAgentLabel = (text?: string | null): { label: string | null; rest: string } => {
  const t = (text ?? "").toString();
  const m = t.match(AGENT_LABEL_RE);
  if (m) return { label: m[1].trim(), rest: t.slice(m[0].length) };
  return { label: null, rest: t };
};

const ChatBubble = ({ message, agentLabel, linkedQuotes, onLinkClick, onOpenQuote, onImageClick, onForward }: ChatBubbleProps) => {
  const isLead = message.sender === "lead";
  const isAgent = message.sender === "agent";
  const isAi = message.sender === "ai";
  const mt = message.messageType ?? "text";
  const isMedia = mt !== "text" && !!message.mediaUrl;

  // For agent messages, prefer the label persisted inline (`*Nome*\n...`)
  // so historic messages keep the original sender mesmo se o nickname mudar.
  // Mensagens enviadas direto pelo app WhatsApp (espelhadas via webhook) trazem
  // sender_name preenchido (ex.: "WhatsApp") — usamos isso quando não há label inline.
  const parsedText = isAgent && mt === "text" ? extractAgentLabel(message.content) : { label: null, rest: message.content ?? "" };
  const parsedCaption = isAgent && isMedia ? extractAgentLabel(message.mediaCaption) : { label: null, rest: message.mediaCaption ?? "" };
  const persistedLabel = parsedText.label || parsedCaption.label;
  const externalSenderName = isAgent ? (message.senderName || null) : null;
  // Sem label inline + sem nome externo conhecido → assumimos envio direto pelo WhatsApp
  const sentViaWhatsApp = isAgent && !persistedLabel && (!externalSenderName || externalSenderName === "WhatsApp" || externalSenderName === "Altivus Turismo");
  const displayLabel = isAgent
    ? (persistedLabel || (sentViaWhatsApp ? "Altivus Turismo" : (externalSenderName || agentLabel || "Agente")))
    : (agentLabel || "Agente");
  const displayContent = isAgent && mt === "text" ? parsedText.rest : message.content;
  const displayCaption = isAgent && isMedia ? parsedCaption.rest : message.mediaCaption;

  return (
    <div className={cn("flex w-full flex-col gap-1", isLead ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-3xl text-sm leading-relaxed shadow-sm overflow-hidden",
          !isMedia && "px-5 py-3",
          isMedia && "p-2",
          isLead && "bg-white text-foreground rounded-bl-md border border-border/40",
          isAi && "bg-[hsl(var(--navy))] text-[hsl(var(--cream))] rounded-br-md",
          isAgent && "bg-emerald-600 text-white rounded-br-md",
        )}
      >
        {isLead && message.senderName && (
          <p className={cn(
            "text-[11px] font-semibold mb-1 text-violet-700",
            isMedia && "px-3 pt-1",
          )}>
            {message.senderName}
          </p>
        )}
        {!isLead && (
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-80",
            isMedia && "px-3 pt-1",
            isAi ? "text-[hsl(var(--cream))]" : "text-emerald-50",
          )}>
            {isAi ? "🤖 IA" : sentViaWhatsApp ? `📱 WhatsApp` : `👤 ${displayLabel}`}
          </p>
        )}
        {mt === "audio" && message.mediaUrl ? (
          <audio
            controls
            src={message.mediaUrl}
            className="w-full max-w-[240px]"
            preload="metadata"
          />
        ) : mt === "image" && message.mediaUrl ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onImageClick?.(message.mediaUrl!, message.mediaCaption)}
              className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl overflow-hidden"
              title="Ampliar imagem"
            >
              <img
                src={message.mediaUrl}
                alt={message.mediaCaption || "Imagem"}
                className="rounded-2xl max-h-[280px] w-auto object-cover cursor-zoom-in"
                loading="lazy"
              />
            </button>
            {displayCaption && (
              <p className={cn("whitespace-pre-wrap [overflow-wrap:anywhere] px-3 pb-1", isLead ? "" : "")}>
                {displayCaption}
              </p>
            )}
          </div>
        ) : mt === "video" && message.mediaUrl ? (
          <div className="space-y-1">
            <video controls src={message.mediaUrl} className="rounded-2xl max-h-[280px] w-auto" preload="metadata" />
            {displayCaption && (
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere] px-3 pb-1">{displayCaption}</p>
            )}
          </div>
        ) : mt === "document" && message.mediaUrl ? (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl underline-offset-2 hover:underline",
              isLead ? "text-foreground" : "text-current"
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayCaption || "Documento"}</span>
          </a>
        ) : mt === "sticker" && message.mediaUrl ? (
          <img src={message.mediaUrl} alt="sticker" className="h-32 w-32 object-contain" />
        ) : (
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{displayContent}</p>
        )}
      </div>
      <div className={cn("flex items-center gap-1.5 px-2 flex-wrap", isLead ? "" : "justify-end")}>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {isAi ? "IA · " : isAgent ? (sentViaWhatsApp ? "WhatsApp · " : `${displayLabel} · `) : ""}
          {formatTime(message.timestamp)}
          {!isLead && message.status && <MessageStatusTicks status={message.status} />}
        </span>
        {linkedQuotes && linkedQuotes.length > 0 && linkedQuotes.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onOpenQuote?.(q.id)}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] hover:bg-blue-100"
            title="Abrir cotação vinculada"
          >
            <Link2 className="h-2.5 w-2.5" />
            {q.title || q.destination || "Cotação"}
          </button>
        ))}
        {(onLinkClick || onForward) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted/60"
                title="Mais ações"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isLead ? "start" : "end"}>
              {onForward && (
                <DropdownMenuItem onClick={onForward}>
                  <Forward className="h-3.5 w-3.5 mr-2" />
                  Encaminhar…
                </DropdownMenuItem>
              )}
              {onLinkClick && (
                <DropdownMenuItem onClick={onLinkClick}>
                  <Link2 className="h-3.5 w-3.5 mr-2" />
                  Vincular a cotação…
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

/**
 * Nota interna — visível APENAS para a equipe. Nunca é enviada ao cliente.
 * Usada para o resumo automático de handoff gerado pela IA.
 */
const InternalNote = ({ message }: { message: Message }) => {
  // Renderiza markdown leve: **negrito** e listas com "- "
  const lines = (message.content || "").split("\n");
  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-300/70 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          <span>🔒 Nota interna · Visível apenas para a equipe</span>
        </div>
        <div className="space-y-1 leading-relaxed">
          {lines.map((line, i) => {
            const html = line
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
              .replace(/\*(.+?)\*/g, "<em>$1</em>")
              .replace(/_(.+?)_/g, "<em>$1</em>");
            return (
              <p
                key={i}
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
              />
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-amber-700/80">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};



const MessageStatusTicks = ({ status }: { status: MessageStatus }) => {
  const label =
    status === "pending" ? "Enviando..." :
    status === "sent" ? "Enviada" :
    status === "received" ? "Entregue" :
    status === "read" ? "Lida" :
    status === "played" ? "Reproduzida" :
    status === "failed" ? "Falha no envio" : "";
  const cls = "h-3 w-3";
  const node =
    status === "pending" ? <Clock className={cls} /> :
    status === "sent" ? <Check className={cls} /> :
    status === "received" ? <CheckCheck className={cls} /> :
    status === "read" || status === "played" ? <CheckCheck className={cn(cls, "text-sky-500")} /> :
    status === "failed" ? <span className="text-destructive font-bold">!</span> :
    null;
  return (
    <span title={label} aria-label={label} className="inline-flex items-center">
      {node}
    </span>
  );
};

const HandoffDivider = () => (
  <div className="flex items-center gap-3 py-2" role="separator" aria-label="Transferido para atendimento humano">
    <div className="flex-1 h-px bg-border" />
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
      <ArrowRightLeft className="h-3 w-3" />
      Transferido para Atendimento Humano
    </div>
    <div className="flex-1 h-px bg-border" />
  </div>
);

const isSameDay = (a?: string, b?: string) => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const formatDateSeparator = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d.toISOString(), today.toISOString())) return "Hoje";
  if (isSameDay(d.toISOString(), yesterday.toISOString())) return "Ontem";
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const day = d.toLocaleDateString("pt-BR", { day: "numeric" });
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${weekday}, ${day} de ${month}`;
};

const DateSeparator = ({ timestamp }: { timestamp: string }) => (
  <div className="flex justify-center py-2" role="separator">
    <span className="px-3 py-1 rounded-full bg-muted/60 text-[11px] font-medium text-muted-foreground capitalize shadow-sm">
      {formatDateSeparator(timestamp)}
    </span>
  </div>
);



// ============= Lead Summary Panel =============
interface SummaryFieldProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
}

const SummaryField = ({ icon: Icon, label, value }: SummaryFieldProps) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
      <Icon className="h-3 w-3" />
      {label}
    </div>
    <p className="text-sm text-foreground pl-[18px]">
      {value || <span className="text-muted-foreground italic">Não informado</span>}
    </p>
  </div>
);

interface LeadSummaryPanelProps {
  summary: LeadSummary;
}

const LeadSummaryPanel = ({ summary }: LeadSummaryPanelProps) => (
  <div className="h-full flex flex-col bg-white">
    <div className="px-5 py-4 border-b">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[hsl(var(--navy))]" />
        <h2 className="text-sm font-semibold">Resumo do Lead</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Dados extraídos automaticamente pela IA.
      </p>
    </div>

    <ScrollArea className="flex-1">
      <div className="p-5 space-y-5">
        <SummaryField icon={MapPin} label="Destino de Interesse" value={summary.destination} />
        <SummaryField icon={Users} label="Número de Pessoas" value={summary.travelers} />
        <SummaryField icon={CalendarRange} label="Duração da Viagem" value={summary.duration} />
        <SummaryField icon={Wallet} label="Orçamento Estimado" value={summary.budget} />

        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            <Sparkles className="h-3 w-3" />
            Anotações da IA
          </div>
          {summary.notes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem anotações.</p>
          ) : (
            <ul className="space-y-2">
              {summary.notes.map((note, i) => (
                <li
                  key={i}
                  className="text-xs leading-relaxed text-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/40"
                >
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ScrollArea>
  </div>
);

// ============= CRM Panel =============
const CRMPanel = ({ conversation }: { conversation: Conversation }) => {
  const navigate = useNavigate();
  const { category, contactType, crm, leadId, contactId, leadName, phone, level } = conversation;
  const isPostSale = category === "post-sale";
  const isExisting = contactType === "existing-client";
  const { openLead, dialog: missingLeadDialog } = useOpenLeadInCRM();

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          {isPostSale ? (
            <LifeBuoy className="h-4 w-4 text-rose-600" />
          ) : (
            <TrendingUp className="h-4 w-4 text-[hsl(var(--navy))]" />
          )}
          <h2 className="text-sm font-semibold">Vínculo no CRM</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {isPostSale
            ? "Ticket de pós-venda — não entra no funil de vendas."
            : "Lead vinculado ao funil de vendas."}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          {/* Classificação automática */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              Classificação automática
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border",
                  isPostSale
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-purple-50 text-purple-700 border-purple-200",
                )}
              >
                {isPostSale ? <LifeBuoy className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {isPostSale ? "Pós-venda / Suporte" : "Funil de vendas"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border",
                  isExisting
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200",
                )}
              >
                {isExisting ? <UserCheck className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                {isExisting ? "Cliente existente" : "Novo lead"}
              </span>
            </div>
          </div>

          {/* Cliente vinculado */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <UserRound className="h-3 w-3" />
              Cliente
            </div>
            {crm.clientName ? (
              <button
                type="button"
                onClick={() => crm.clientId && navigate(`/clients`)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-left hover:bg-accent/40 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{crm.clientName}</p>
                  <p className="text-[11px] text-muted-foreground">Cadastro completo</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            ) : (
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  Contato ainda não cadastrado.
                </p>
                <Button size="sm" variant="outline" className="w-full gap-1.5 h-8 text-xs">
                  <UserPlus className="h-3 w-3" />
                  Criar cliente no CRM
                </Button>
              </div>
            )}
          </div>

          {/* Cotação vinculada */}
          {crm.quoteTitle && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <FileText className="h-3 w-3" />
                Cotação
              </div>
              <button
                type="button"
                onClick={() => navigate(`/quotes`)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-left hover:bg-accent/40 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{crm.quoteTitle}</p>
                  <p className="text-[11px] text-muted-foreground">#{crm.quoteId}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            </div>
          )}

          {/* Viagem em curso (pós-venda) */}
          {crm.tripTitle && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <Plane className="h-3 w-3" />
                Operação / Viagem
              </div>
              <button
                type="button"
                onClick={() => navigate(`/crm/ops?tab=ops`)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-left hover:bg-accent/40 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{crm.tripTitle}</p>
                  <p className="text-[11px] text-muted-foreground">Em acompanhamento</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </button>
            </div>
          )}

          {/* Estágio atual */}
          {crm.stage && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <Sparkles className="h-3 w-3" />
                Estágio atual
              </div>
              <div className={cn(
                "rounded-lg border p-3 text-sm font-medium",
                isPostSale ? "bg-rose-50/50 border-rose-200 text-rose-900" : "bg-blue-50/50 border-blue-200 text-blue-900",
              )}>
                {crm.stage}
              </div>
            </div>
          )}

          {/* Ação principal */}
          <div className="pt-2 border-t">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="w-full gap-2 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90"
              onClick={() => {
                if (isPostSale) {
                  navigate(`/crm/ops?tab=ops`);
                  return;
                }
                if (level === "cliente" && contactId) {
                  navigate(`/clients?contact=${contactId}`);
                  return;
                }
                openLead({ leadId, contactId, name: leadName, phone });
              }}
            >
              {isPostSale ? <LifeBuoy className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Abrir no CRM ({isPostSale ? "Operações" : "Vendas"})
            </Button>
          </div>
        </div>
      </ScrollArea>
      {missingLeadDialog}
    </div>
  );
};

// ============= Contact Banner (top of chat) =============
const formatDateBR = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

const ContactBanner = ({ conversation }: { conversation: Conversation }) => {
  const navigate = useNavigate();
  const {
    level, lastTrip, isTraveling, leadName, leadId, contactId, isNew, phone,
    firstContactAt, lastContactAt, isReturning,
  } = conversation;
  const { openLead, dialog: missingLeadDialog } = useOpenLeadInCRM();

  const openInCRM = () => {
    if (level === "cliente" && contactId) {
      navigate(`/clients?contact=${contactId}`);
      return;
    }
    openLead({ leadId, contactId, name: leadName, phone });
  };

  // "Abrir no CRM" removido da faixa do topo a pedido — acesso ainda disponível
  // pela ficha lateral (botão "Abrir ficha completa" / "Abrir no CRM (Vendas)").
  const CRMButton: React.ReactNode = (
    <>{missingLeadDialog}</>
  );

  const ContactDates = (firstContactAt || lastContactAt) ? (
    <p className="text-[11px] text-muted-foreground/90 mt-0.5">
      {firstContactAt && <>1º contato: <span className="font-medium">{formatDateBR(firstContactAt)}</span></>}
      {firstContactAt && lastContactAt && " · "}
      {lastContactAt && <>Último: <span className="font-medium">{formatDateBR(lastContactAt)}</span></>}
    </p>
  ) : null;

  const ReturningBadge = isReturning && level !== "cliente" ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-300 uppercase tracking-wide">
      Retornou
    </span>
  ) : null;

  if (level === "cliente") {
    return (
      <div
        className={cn(
          "px-6 py-3 border-b flex items-center gap-3",
          isTraveling
            ? "bg-gradient-to-r from-amber-50 via-amber-50 to-amber-100/60 border-amber-200"
            : "bg-gradient-to-r from-amber-50/80 to-amber-50/30 border-amber-200/70",
        )}
      >
        <ContactLevelBadge level="cliente" size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 truncate">
            {leadName}
            {isTraveling && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                <Plane className="h-3 w-3" /> Em viagem agora
              </span>
            )}
          </p>
          {lastTrip ? (
            <p className="text-xs text-amber-800/80 mt-0.5">
              Última viagem: <span className="font-medium">{lastTrip.destination}</span> · {formatDateBR(lastTrip.date)}
            </p>
          ) : (
            <p className="text-xs text-amber-800/70 mt-0.5 italic">Sem viagens registradas ainda.</p>
          )}
          {ContactDates}
        </div>
        {CRMButton}
      </div>
    );
  }

  if (level === "prospect") {
    return (
      <div className="px-6 py-2.5 border-b bg-slate-50 flex items-start gap-3">
        <ContactLevelBadge level="prospect" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isNew && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase tracking-wide">
                Novo
              </span>
            )}
            {ReturningBadge}
            <p className="text-xs text-slate-700">
              {isReturning
                ? "Contato antigo voltou — card movido para Novos Contatos."
                : "Novo contato — Prospect criado automaticamente."}
            </p>
          </div>
          {ContactDates}
        </div>
        {CRMButton}
      </div>
    );
  }

  // lead
  return (
    <div className="px-6 py-2.5 border-b bg-sky-50/60 flex items-start gap-3">
      <ContactLevelBadge level="lead" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {ReturningBadge}
          <p className="text-xs text-sky-900">
            {isReturning ? "Lead retornou após mais de 30 dias." : "Lead qualificado — IA continuará a conversa de qualificação."}
          </p>
        </div>
        {ContactDates}
      </div>
      {CRMButton}
    </div>
  );
};

// ============= Main Page =============
export default function ServiceCenter() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = sessionStorage.getItem("sc:summaryOpen");
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { sessionStorage.setItem("sc:summaryOpen", summaryOpen ? "1" : "0"); } catch {}
  }, [summaryOpen]);

  const [sidePanelTab, setSidePanelTab] = useState<"summary" | "crm">("summary");
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [linkDialogMessages, setLinkDialogMessages] = useState<string[]>([]);
  const [forwardMessage, setForwardMessage] = useState<ForwardableMessage | null>(null);

  // Apelido/nome do atendente logado (para exibir nas mensagens enviadas)
  const { data: myProfile } = useQuery({
    queryKey: ["my-agent-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, nickname, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as { user_id: string; nickname?: string | null; full_name?: string | null } | null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const myAgentLabel = (myProfile?.nickname?.trim() || myProfile?.full_name?.trim() || "Agente");
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  useEffect(() => { setNicknameDraft(myProfile?.nickname ?? ""); }, [myProfile?.nickname]);
  const saveNickname = async () => {
    if (!myProfile?.user_id) return;
    setSavingNickname(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ nickname: nicknameDraft.trim() || null })
        .eq("user_id", myProfile.user_id);
      if (error) throw error;
      toast.success("Apelido atualizado");
      qc.invalidateQueries({ queryKey: ["my-agent-profile"] });
      setNicknameOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar apelido");
    } finally {
      setSavingNickname(false);
    }
  };

  // ===== Status do Agente IA (fonte da verdade: ai_agent_status.active) =====
  const AGENT_ID = "1";
  const { data: agentStatus } = useQuery({
    queryKey: ["ai-agent-status", AGENT_ID],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ai_agent_status")
        .select("active")
        .eq("agent_id", AGENT_ID)
        .maybeSingle();
      return data as { active: boolean } | null;
    },
    refetchInterval: 30000,
  });
  const agentActive = agentStatus?.active !== false; // default true
  const aiGloballyPaused = !agentActive;

  // Realtime: escuta mudanças de ai_agent_status feitas em outras telas
  useEffect(() => {
    const channel = supabase
      .channel("ai_agent_status_sc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_agent_status", filter: `agent_id=eq.${AGENT_ID}` },
        () => qc.invalidateQueries({ queryKey: ["ai-agent-status", AGENT_ID] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const [pendingAgentToggle, setPendingAgentToggle] = useState<boolean | null>(null);
  const [agentToggleSaving, setAgentToggleSaving] = useState(false);

  const confirmAgentToggle = async () => {
    if (pendingAgentToggle === null) return;
    const next = pendingAgentToggle;
    setAgentToggleSaving(true);
    const { error } = await (supabase as any)
      .from("ai_agent_status")
      .upsert(
        { agent_id: AGENT_ID, active: next, updated_at: new Date().toISOString() },
        { onConflict: "agent_id" },
      );
    setAgentToggleSaving(false);
    if (error) {
      toast.error("Falha ao atualizar: " + error.message);
      return;
    }
    toast.success(next ? "Agente ativado com sucesso" : "Agente desativado");
    qc.invalidateQueries({ queryKey: ["ai-agent-status", AGENT_ID] });
    setPendingAgentToggle(null);
  };

  // ===== Carrega conversas reais do WhatsApp (Z-API) =====
  const { data: convoRows = [], isLoading: isLoadingConvos } = useQuery({
    queryKey: ["wa_conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      // Filtra "LIDs" do WhatsApp (identificadores internos que não são
      // números reais — costumam terminar em @lid ou ser puramente numéricos
      // com 14+ dígitos sem prefixo de país válido). A Central deve refletir
      // apenas os números reais ativos na instância.
      const isLidPhone = (p: string | null | undefined) => {
        if (!p) return false;
        if (p.includes("@lid")) return true;
        const digits = p.replace(/\D/g, "");
        // Telefones reais (E.164) têm no máx. 15 dígitos, mas em prática
        // BR/EU ficam entre 10 e 13. LIDs do WhatsApp são 14-15 dígitos.
        return /^\d+$/.test(p) && digits.length >= 14;
      };
      return (data ?? []).filter((c: any) => !(isLidPhone(c.phone) && !c.is_group));
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // ===== Carrega contatos linkados (datas e flag retornou) =====
  const contactIds = useMemo(
    () => Array.from(new Set(convoRows.map((c: any) => c.contact_id).filter(Boolean))),
    [convoRows],
  );
  // Fonte da verdade: tabela contacts. Inclui nome, level, vínculos e datas.
  const { data: contactsMeta = [] } = useQuery({
    queryKey: ["wa_contacts_meta", contactIds.join(",")],
    enabled: contactIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contacts")
        .select("id, full_name, phone, level, lead_id, client_id, first_contact_at, last_contact_at, is_returning")
        .in("id", contactIds);
      return data ?? [];
    },
  });
  const contactMetaById = useMemo(() => {
    const m = new Map<string, any>();
    (contactsMeta as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [contactsMeta]);

  // ===== Carrega mensagens da conversa selecionada =====
  const { data: msgRows = [] } = useQuery({
    queryKey: ["wa_messages", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_messages")
        .select("*")
        .eq("conversation_id", selectedId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: selectedId ? 3000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // ===== Realtime: novas mensagens / conversas / contatos / leads atualizados =====
  useEffect(() => {
    const channel = supabase
      .channel("service-center-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_conversations" },
        () => qc.invalidateQueries({ queryKey: ["wa_conversations"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_messages" },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["wa_conversations"] });
          const convId = payload?.new?.conversation_id ?? payload?.old?.conversation_id;
          if (convId) qc.invalidateQueries({ queryKey: ["wa_messages", convId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contacts" },
        () => {
          qc.invalidateQueries({ queryKey: ["wa_contacts_meta"] });
          qc.invalidateQueries({ queryKey: ["wa_conversations"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          qc.invalidateQueries({ queryKey: ["wa_contacts_meta"] });
          qc.invalidateQueries({ queryKey: ["wa_conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Marca conversa como lida ao abrir
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      await supabase
        .from("wa_conversations")
        .update({ unread_count: 0 })
        .eq("id", selectedId);
    })();
  }, [selectedId]);

  // ===== Mapeia para a estrutura visual existente =====
  const conversations: Conversation[] = useMemo(() => {
    return convoRows.map((c: any) => {
      const msgs: Message[] = (selectedId === c.id ? msgRows : []).map((m: any) => ({
        id: m.id,
        sender: (m.sender ?? "lead") as MessageSender,
        content:
          m.message_type === "text"
            ? (m.content ?? "")
            : (m.media_caption ?? ""),
        timestamp: m.created_at,
        status: (m.status ?? undefined) as MessageStatus | undefined,
        messageType: m.message_type ?? "text",
        mediaUrl: m.media_url ?? undefined,
        mediaMime: m.media_mime ?? undefined,
        mediaCaption: m.media_caption ?? undefined,
        isInternal: !!m.is_internal,
        senderName: m.sender_name ?? undefined,
        senderPhone: m.sender_phone ?? undefined,
      }));
      // Se não há nenhuma mensagem carregada, cria uma "fake" só para preview
      const fallbackMsg: Message = {
        id: `${c.id}-last`,
        sender: (c.last_message_from ?? "lead") as MessageSender,
        content: c.last_message_text ?? "",
        timestamp: c.last_message_at ?? c.updated_at ?? c.created_at,
      };
      const isGroup = !!c.is_group;
      const meta = c.contact_id ? contactMetaById.get(c.contact_id) : null;
      const rawName = isGroup
        ? (c.group_subject || c.contact_name || "Grupo")
        : ((meta?.full_name && String(meta.full_name).trim()) || (c.contact_name && String(c.contact_name).trim()) || "");
      const isAgencyName = /altivus/i.test(rawName);
      const looksLikePhone = /^\+?\d[\d\s\-()]{4,}$/.test(rawName);
      const isPlaceholderName = !isGroup && (!rawName || rawName.toLowerCase() === "sem nome" || isAgencyName || looksLikePhone);
      const canonicalName = isGroup
        ? rawName
        : (isPlaceholderName ? (c.phone ? formatPhoneDisplay(c.phone) : "Sem nome") : rawName);
      const canonicalClientId = meta?.client_id ?? c.client_id ?? undefined;
      const canonicalLeadId = meta?.lead_id ?? c.lead_id ?? undefined;
      // Prioriza vínculo real (client_id/lead_id) sobre o snapshot de level,
      // que pode estar defasado se o contato foi promovido depois.
      const canonicalLevel: ContactLevel = canonicalClientId
        ? "cliente"
        : canonicalLeadId
          ? "lead"
          : ((meta?.level as ContactLevel) || "prospect");
      return {
        id: c.id,
        leadName: canonicalName,
        phone: c.phone,
        status: (c.status === "human" ? "human" : "ai") as ConversationStatus,
        messages: msgs.length > 0 ? msgs : [fallbackMsg],
        summary: { notes: [] },
        category: "sales" as ContactCategory,
        contactType: (canonicalClientId ? "existing-client" : "new-lead") as ContactType,
        crm: {
          clientId: canonicalClientId,
          clientName: canonicalName,
        },
        level: canonicalLevel,
        isNew:
          !isGroup &&
          !canonicalClientId &&
          canonicalLevel === "prospect" &&
          !!c.created_at &&
          Date.now() - new Date(c.created_at).getTime() < 24 * 60 * 60 * 1000,
        leadId: canonicalLeadId,
        contactId: c.contact_id ?? undefined,
        firstContactAt: meta?.first_contact_at ?? c.created_at ?? undefined,
        lastContactAt: meta?.last_contact_at ?? c.last_message_at ?? undefined,
        isReturning: !!meta?.is_returning,
        unreadCount: Number(c.unread_count ?? 0),
        isGroup,
        groupSubject: c.group_subject ?? undefined,
        groupId: c.group_id ?? undefined,
        photoUrl: c.profile_photo_url ?? undefined,
      };
    });
  }, [convoRows, msgRows, selectedId, contactMetaById]);

  // Deep link: ?phone=55119xxxx → seleciona a conversa correspondente (sufixo dos últimos 9 dígitos)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (!phoneParam || convoRows.length === 0) return;
    const tail = phoneParam.replace(/\D/g, "").slice(-9);
    if (!tail) return;
    const match = (convoRows as any[]).find((c) => (c.phone || "").replace(/\D/g, "").endsWith(tail));
    if (match) {
      setSelectedId(match.id);
      const next = new URLSearchParams(searchParams);
      next.delete("phone");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, convoRows, setSearchParams]);

  // Deep link: ?conversation=<id> → seleciona diretamente
  useEffect(() => {
    const convParam = searchParams.get("conversation");
    if (!convParam || convoRows.length === 0) return;
    const match = (convoRows as any[]).find((c) => c.id === convParam);
    if (match) {
      setSelectedId(match.id);
      const next = new URLSearchParams(searchParams);
      next.delete("conversation");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, convoRows, setSearchParams]);

  // Deep link: ?leadId=<uuid> → seleciona a conversa do lead
  useEffect(() => {
    const leadIdParam = searchParams.get("leadId");
    if (!leadIdParam || conversations.length === 0) return;
    const match = conversations.find((c) => c.leadId === leadIdParam);
    if (match) {
      setSelectedId(match.id);
      const next = new URLSearchParams(searchParams);
      next.delete("leadId");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, conversations, setSearchParams]);


  // Ref para auto-scroll no chat
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const handleSend = async () => {
    if (!selectedId || !draft.trim() || sending) return;
    const convo = convoRows.find((c: any) => c.id === selectedId);
    if (!convo?.phone) {
      toast.error("Telefone da conversa não encontrado.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          action: "send-text",
          phone: convo.phone,
          message: draft.trim(),
          is_group: !!convo.is_group,
          group_id: convo.group_id ?? undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDraft("");
      scrollToBottom();
      qc.invalidateQueries({ queryKey: ["wa_messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["wa_conversations"] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  // ===== Audio recording / sending =====
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const cancelRecordingRef = useRef(false);

  const stopRecordingStream = () => {
    try {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    } catch {}
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const uploadAndSendAudio = async (blob: Blob) => {
    if (!selectedId) return;
    const convo = convoRows.find((c: any) => c.id === selectedId);
    if (!convo?.phone) {
      toast.error("Telefone da conversa não encontrado.");
      return;
    }
    setSendingAudio(true);
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `wa-audio/${convo.phone}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("quote-images")
        .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("quote-images").getPublicUrl(path);
      const audioUrl = pub.publicUrl;
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          action: "send-audio",
          phone: convo.phone,
          audio_url: audioUrl,
          is_group: !!convo.is_group,
          group_id: convo.group_id ?? undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      scrollToBottom();
      qc.invalidateQueries({ queryKey: ["wa_messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["wa_conversations"] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar áudio");
    } finally {
      setSendingAudio(false);
    }
  };

  const startRecording = async () => {
    if (recording || sendingAudio) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Gravação de áudio não suportada neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stopRecordingStream();
        setRecording(false);
        setRecordSeconds(0);
        if (cancelRecordingRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 800) {
          toast.error("Áudio muito curto.");
          return;
        }
        await uploadAndSendAudio(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 120) {
            try { rec.stop(); } catch {}
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    cancelRecordingRef.current = false;
    try { mediaRecorderRef.current?.stop(); } catch {}
  };

  // ===== Image lightbox =====
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string | null } | null>(null);

  // ===== File attachments (image / document) =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sendingAttachment, setSendingAttachment] = useState(false);

  const handleAttachClick = () => {
    if (sending || sendingAudio || sendingAttachment || recording) return;
    fileInputRef.current?.click();
  };

  const handleAttachmentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedId) return;
    const convo = convoRows.find((c: any) => c.id === selectedId);
    if (!convo?.phone) {
      toast.error("Telefone da conversa não encontrado.");
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast.error("Envie imagens ou PDF.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo acima de 20MB.");
      return;
    }
    setSendingAttachment(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const folder = isImage ? "wa-images" : "wa-docs";
      const path = `${folder}/${convo.phone}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("quote-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("quote-images").getPublicUrl(path);
      const url = pub.publicUrl;
      const caption = draft.trim();
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: isImage
          ? {
              action: "send-image",
              phone: convo.phone,
              image_url: url,
              message: caption || undefined,
              is_group: !!convo.is_group,
              group_id: convo.group_id ?? undefined,
            }
          : {
              action: "send-document",
              phone: convo.phone,
              document_url: url,
              document_name: file.name,
              message: caption || undefined,
              is_group: !!convo.is_group,
              group_id: convo.group_id ?? undefined,
            },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDraft("");
      scrollToBottom();
      qc.invalidateQueries({ queryKey: ["wa_messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["wa_conversations"] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar anexo");
    } finally {
      setSendingAttachment(false);
    }
  };

  const cancelRecording = () => {
    if (!recording) return;
    cancelRecordingRef.current = true;
    try { mediaRecorderRef.current?.stop(); } catch {}
  };





  const counts = useMemo(
    () => ({
      all: conversations.length,
      clientes: conversations.filter((c) => c.level === "cliente").length,
      leads: conversations.filter((c) => c.level === "lead").length,
      prospects: conversations.filter((c) => c.level === "prospect").length,
    }),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Ordenação puramente cronológica: mais recente no topo, independente do nível.
    return conversations
      .filter((c) => {
        if (activeTab === "clientes" && c.level !== "cliente") return false;
        if (activeTab === "leads" && c.level !== "lead") return false;
        if (activeTab === "prospects" && c.level !== "prospect") return false;
        if (!q) return true;
        return (
          c.leadName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          getLastMessage(c).content.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        return (
          new Date(getLastMessage(b).timestamp).getTime() -
          new Date(getLastMessage(a).timestamp).getTime()
        );
      });
  }, [conversations, search, activeTab]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  // Vínculos de mensagens a cotações (busca em lote por conversa)
  const messageIds = useMemo(() => (selected?.messages ?? []).map((m) => m.id), [selected]);
  const { data: messageLinks = [] } = useQuery({
    queryKey: ["wa-message-links", selectedId, messageIds.length],
    enabled: !!selectedId && messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_message_links" as any)
        .select("message_id, quote_id, quotes:quote_id (id, title, destination)")
        .in("message_id", messageIds);
      return (data ?? []) as any[];
    },
  });
  const linksByMessage = useMemo(() => {
    const map = new Map<string, { id: string; title: string | null; destination: string | null }[]>();
    for (const l of messageLinks as any[]) {
      if (!l.quotes) continue;
      const arr = map.get(l.message_id) ?? [];
      arr.push(l.quotes);
      map.set(l.message_id, arr);
    }
    return map;
  }, [messageLinks]);


  // Auto-scroll to latest message on new messages or when switching conversations
  useEffect(() => {
    if (selected) {
      setTimeout(scrollToBottom, 50);
    }
  }, [selected?.messages.length, selectedId]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-3 sm:-m-4 md:-m-6 lg:-m-8 overflow-hidden bg-background">
      {/* ===== Banner global de status da IA (sincronizado com Agentes IA) ===== */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-2 border-b",
          agentActive
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {agentActive ? (
            <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-green-500 animate-pulse" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <span
            className={cn(
              "font-medium text-[13px]",
              agentActive ? "text-green-700" : "text-amber-700",
            )}
          >
            {agentActive
              ? "IA ativa — respondendo automaticamente"
              : "Modo manual — respostas automáticas desativadas"}
          </span>
        </div>
        {agentActive ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingAgentToggle(false)}
              className="h-7 px-3 text-[12px] rounded-md border border-gray-300 text-gray-600 hover:bg-white transition-colors"
            >
              Desativar IA
            </button>
            <button
              type="button"
              onClick={() => navigate("/ai-agents")}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-white hover:text-gray-700 transition-colors"
              title="Configurar Agente de IA e WhatsApp"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingAgentToggle(true)}
              className="h-7 px-3 text-[12px] rounded-md bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
            >
              Ativar IA
            </button>
            <button
              type="button"
              onClick={() => navigate("/ai-agents")}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-white hover:text-gray-700 transition-colors"
              title="Configurar Agente de IA e WhatsApp"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingAgentToggle !== null}
        onOpenChange={(open) => { if (!open) setPendingAgentToggle(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingAgentToggle ? (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              {pendingAgentToggle ? "Ativar Agente IA" : "Desativar Agente IA"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {pendingAgentToggle
                    ? "Ao ativar o agente, a IA começará a responder automaticamente todas as mensagens recebidas no WhatsApp usando as configurações salvas."
                    : "Ao desativar o agente, a IA deixará de responder mensagens no WhatsApp. Apenas atendentes humanos poderão responder na Central de Atendimento."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingAgentToggle
                    ? "Certifique-se de que as configurações estão corretas antes de ativar."
                    : "Mensagens recebidas continuarão sendo registradas."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={agentToggleSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmAgentToggle(); }}
              disabled={agentToggleSaving}
              className={cn(
                pendingAgentToggle
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
              )}
            >
              {pendingAgentToggle ? "Ativar Agente" : "Desativar Agente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <div className="flex flex-1 overflow-hidden">
      {/* ===== Left column: conversation list ===== */}
      <aside className="w-[380px] xl:w-[420px] 2xl:w-[460px] max-w-[44vw] shrink-0 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold truncate">Atendimento</h1>
            <Button
              size="sm"
              onClick={() => setNewMsgOpen(true)}
              className="h-8 gap-1.5 shrink-0 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova
            </Button>
          </div>
          <Popover open={nicknameOpen} onOpenChange={setNicknameOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start gap-1.5 px-2 -mt-1 text-xs text-muted-foreground hover:text-foreground"
                title="Editar apelido exibido nas mensagens"
              >
                <Pencil className="h-3 w-3 shrink-0" />
                <span className="truncate">{myAgentLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3 space-y-2">
              <p className="text-xs font-medium">Seu apelido</p>
              <p className="text-[11px] text-muted-foreground">
                Exibido nas mensagens que você envia. Se vazio, usamos seu nome completo.
              </p>
              <Input
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder={myProfile?.full_name ?? "Seu apelido"}
                maxLength={40}
                onKeyDown={(e) => { if (e.key === "Enter") saveNickname(); }}
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setNicknameOpen(false)} disabled={savingNickname}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveNickname} disabled={savingNickname}>
                  {savingNickname ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
            <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/60 p-0.5">
              <TabsTrigger value="all" className="text-[11px] gap-1">
                Todos
                <span className="text-[10px] text-muted-foreground">{counts.all}</span>
              </TabsTrigger>
              <TabsTrigger value="clientes" className="text-[11px] gap-1">
                Clientes
                <span className="text-[10px] text-muted-foreground">{counts.clientes}</span>
              </TabsTrigger>
              <TabsTrigger value="leads" className="text-[11px] gap-1">
                Leads
                <span className="text-[10px] text-muted-foreground">{counts.leads}</span>
              </TabsTrigger>
              <TabsTrigger value="prospects" className="text-[11px] gap-1">
                Prospects
                <span className="text-[10px] text-muted-foreground">{counts.prospects}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="min-w-0">
            {isLoadingConvos && filtered.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`sk-${i}`} className="flex items-start gap-3 px-4 py-3 border-b border-border/20 animate-fade-in">
                  <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5 min-w-0 self-center">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-10" />
                    </div>
                    <Skeleton className="h-2.5 w-full max-w-[200px]" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">
                Nenhuma conversa encontrada.
              </p>
            ) : (
              filtered.map((c) => (
                <ConversationCard
                  key={c.id}
                  conversation={c}
                  active={c.id === selectedId}
                  aiGloballyPaused={aiGloballyPaused}
                  onClick={() => {
                    setSelectedId(c.id);
                  }}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ===== Center column: chat window ===== */}
      <section className="flex-1 flex flex-col min-w-0 bg-muted/30">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
              <MessageSquare className="h-7 w-7 text-muted-foreground/70" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Selecione uma conversa para visualizar o histórico.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <header className="px-6 py-3 border-b bg-white/80 backdrop-blur-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10">
                  {selected.photoUrl && <AvatarImage src={selected.photoUrl} alt={selected.leadName} />}
                  <AvatarFallback className="text-xs font-medium bg-secondary text-secondary-foreground">
                    {getInitials(selected.leadName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{selected.leadName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhone(selected.phone)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!aiGloballyPaused && (
                  <Button
                    size="sm"
                    className={cn(
                      "gap-2 shadow-sm",
                      selected.status === "human"
                        ? "bg-success text-white hover:bg-success/90"
                        : "bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90",
                    )}
                    onClick={async () => {
                      if (!selectedId) return;
                      const newStatus = selected.status === "human" ? "ai" : "human";
                      const { error } = await supabase
                        .from("wa_conversations")
                        .update({ status: newStatus })
                        .eq("id", selectedId);
                      if (error) {
                        toast.error("Falha ao atualizar status: " + error.message);
                        return;
                      }
                      toast.success(
                        newStatus === "human"
                          ? "Conversa assumida — IA pausada para este contato."
                          : "IA reativada para este contato.",
                      );
                      qc.invalidateQueries({ queryKey: ["wa_conversations"] });
                    }}
                  >
                    <UserRound className="h-4 w-4" />
                    {selected.status === "human" ? "Devolver para IA" : "Assumir Conversa"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSummaryOpen((o) => !o)}
                  aria-label={summaryOpen ? "Recolher resumo" : "Expandir resumo"}
                >
                  {summaryOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </header>

            {/* Contact level banner (Cliente/Lead/Prospect) */}
            <ContactBanner conversation={selected} />

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-5 min-w-0">
              <div className="space-y-4 max-w-3xl mx-auto min-w-0">
                {selected.messages.map((m, idx) => {
                  const prev = idx > 0 ? selected.messages[idx - 1] : null;
                  const showDate =
                    !prev || !isSameDay(prev.timestamp, m.timestamp);
                  return (
                    <div key={m.id} className="space-y-4">
                      {showDate && <DateSeparator timestamp={m.timestamp} />}
                      {m.isInternal ? (
                        <InternalNote message={m} />
                      ) : (
                        <ChatBubble
                          message={m}
                          agentLabel={myAgentLabel}
                          linkedQuotes={linksByMessage.get(m.id)}
                          onLinkClick={() => setLinkDialogMessages([m.id])}
                          onOpenQuote={(qid) => navigate(`/quotes?id=${qid}`)}
                          onImageClick={(url, caption) => setLightbox({ url, caption })}
                          onForward={() => setForwardMessage({
                            id: m.id,
                            messageType: m.messageType,
                            content: m.content,
                            mediaUrl: m.mediaUrl ?? null,
                            mediaCaption: m.mediaCaption ?? null,
                          })}
                        />
                      )}
                      {selected.handoffAfterMessageId === m.id && <HandoffDivider />}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />

              </div>
            </ScrollArea>

            {/* Composer */}
            <footer className="border-t bg-white/80 backdrop-blur-sm p-4">
              {selected.status === "ai" && !aiGloballyPaused ? (
                <div className="max-w-3xl mx-auto space-y-3">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Atendimento automático ativo</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Assuma a conversa para responder manualmente"
                      disabled
                      className="h-11 rounded-full px-5 bg-muted/40 border-0 placeholder:text-muted-foreground/70"
                    />
                    <Button
                      size="icon"
                      disabled
                      className="h-11 w-11 rounded-full shrink-0"
                    >
                      <SendHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 max-w-3xl mx-auto">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleAttachmentSelected}
                    />
                    {!recording && (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleAttachClick}
                        disabled={sending || sendingAudio || sendingAttachment}
                        className="h-11 w-11 rounded-full shrink-0"
                        title="Anexar imagem ou PDF"
                      >
                        {sendingAttachment ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                      </Button>
                    )}
                    {recording ? (
                      <div className="flex-1 flex items-center gap-3 h-11 rounded-full px-5 bg-red-50 border border-red-200">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                        </span>
                        <span className="text-sm text-red-700 font-medium tabular-nums">
                          Gravando… {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
                        </span>
                        <span className="ml-auto text-[11px] text-red-600/80">Máx 2:00</span>
                      </div>
                    ) : (
                      <Textarea
                        placeholder={sendingAudio ? "Enviando áudio…" : sendingAttachment ? "Enviando anexo…" : "Digite uma mensagem... (Shift+Enter para nova linha)"}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        disabled={sending || sendingAudio || sendingAttachment}
                        rows={1}
                        className="min-h-11 max-h-40 rounded-2xl px-5 py-2.5 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring resize-none leading-6"
                      />

                    )}

                    {recording ? (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={cancelRecording}
                          className="h-11 w-11 rounded-full shrink-0 text-destructive hover:text-destructive"
                          title="Cancelar"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          onClick={stopRecording}
                          className="h-11 w-11 rounded-full shrink-0 bg-red-600 hover:bg-red-700 text-white"
                          title="Parar e enviar"
                        >
                          <Square className="h-4 w-4 fill-current" />
                        </Button>
                      </>
                    ) : draft.trim() ? (
                      <Button
                        size="icon"
                        disabled={sending || sendingAudio}
                        onClick={handleSend}
                        className="h-11 w-11 rounded-full shrink-0"
                        title="Enviar mensagem"
                      >
                        <SendHorizontal className="h-5 w-5" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        disabled={sending || sendingAudio}
                        onClick={startRecording}
                        className="h-11 w-11 rounded-full shrink-0"
                        title="Gravar áudio"
                      >
                        {sendingAudio ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </footer>
          </>
        )}
      </section>

      {/* ===== Right column: lead summary + CRM panel ===== */}
      {selected && summaryOpen && (
        <aside className="w-[300px] xl:w-[360px] 2xl:w-[400px] shrink-0 border-l hidden lg:flex flex-col bg-white min-w-0">
          <ClientSidePanel
            level={selected.level}
            contactId={selected.contactId}
            leadId={selected.leadId}
            clientId={selected.crm.clientId}
            contactName={selected.leadName}
            phone={selected.phone}
            summary={selected.summary}
          />
        </aside>
      )}

      </div>

      <NewMessageDialog
        open={newMsgOpen}
        onOpenChange={setNewMsgOpen}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["wa_conversations"] });
        }}
      />

      <MessageLinkDialog
        open={linkDialogMessages.length > 0}
        onOpenChange={(o) => { if (!o) setLinkDialogMessages([]); }}
        messageIds={linkDialogMessages}
        clientId={selected?.crm.clientId ?? null}
        leadId={selected?.leadId ?? null}
      />

      <ForwardMessageDialog
        open={!!forwardMessage}
        onOpenChange={(o) => { if (!o) setForwardMessage(null); }}
        message={forwardMessage}
        excludeId={selected?.id}
        targets={conversations.map<ForwardTarget>((c) => ({
          id: c.id,
          name: c.isGroup ? (c.groupSubject || c.leadName) : c.leadName,
          phone: c.phone,
          isGroup: c.isGroup,
          groupId: c.groupId,
          photoUrl: c.photoUrl,
        }))}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["wa_conversations"] });
          if (selectedId) qc.invalidateQueries({ queryKey: ["wa_messages", selectedId] });
        }}
      />

      <ImageLightbox
        open={!!lightbox}
        onOpenChange={(o) => { if (!o) setLightbox(null); }}
        url={lightbox?.url ?? null}
        caption={lightbox?.caption ?? null}
      />
    </div>
  );
}
