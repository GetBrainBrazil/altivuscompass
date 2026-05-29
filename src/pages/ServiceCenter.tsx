import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import { NewMessageDialog } from "@/components/service-center/NewMessageDialog";
import { Plus, Info, Bot } from "lucide-react";
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

type FilterTab = "all" | "leads" | "support" | "human";

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

interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: string; // ISO
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
}

const ConversationCard = ({ conversation, active, onClick }: ConversationCardProps) => {
  const last = getLastMessage(conversation);
  const isAi = conversation.status === "ai";
  const hasUnread = (conversation.unreadCount ?? 0) > 0 && !active;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden",
        "border-gray-200 bg-white shadow-sm hover:shadow-md hover:bg-gray-50/80",
        active && "bg-gray-50 border-gray-300 shadow-md ring-1 ring-gray-200",
        hasUnread &&
          "bg-amber-50 border-amber-300 hover:bg-amber-50 ring-1 ring-amber-200 shadow-[0_0_0_1px_hsl(var(--warning)/0.15)]",
      )}
    >
      {active && (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] rounded-r",
            isAi ? "bg-success" : "bg-warning",
          )}
        />
      )}
      {hasUnread && !active && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r bg-amber-500"
        />
      )}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0 self-center">
          <AvatarFallback className="text-xs font-medium">
            {getInitials(conversation.leadName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("font-medium text-sm truncate", hasUnread && "font-semibold text-amber-950")}>
              {conversation.leadName}
            </p>
            <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1.5">
              {hasUnread && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {conversation.unreadCount! > 99 ? "99+" : conversation.unreadCount}
                </span>
              )}
              {formatTime(last.timestamp)}
            </span>
          </div>
          <p className={cn(
            "text-xs line-clamp-2 mt-1 leading-relaxed",
            hasUnread ? "text-amber-900 font-medium" : "text-muted-foreground",
          )}>
            {last.sender === "ai" ? "IA: " : last.sender === "agent" ? "Você: " : ""}
            {last.content}
          </p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {/* Nível do contato (Prospect / Lead / Cliente) */}
            <ContactLevelBadge level={conversation.level} size="xs" />
            {conversation.isNew && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase tracking-wide">
                Novo
              </span>
            )}
            {conversation.isTraveling && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300">
                <Plane className="w-2.5 h-2.5" />
                Em viagem
              </span>
            )}
            {conversation.category === "post-sale" && !conversation.isTraveling && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <LifeBuoy className="w-2.5 h-2.5" />
                Pós-venda
              </span>
            )}
            {/* Status humano/IA */}
            {isAi ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success border border-success/25">
                <span className="w-1 h-1 rounded-full bg-success" />
                IA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-warning/20 text-warning border border-warning/30">
                <span className="w-1 h-1 rounded-full bg-warning" />
                Humano
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble = ({ message }: ChatBubbleProps) => {
  const isLead = message.sender === "lead";
  const isAgent = message.sender === "agent";
  const isAi = message.sender === "ai";
  return (
    <div className={cn("flex w-full flex-col gap-1", isLead ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-3xl px-5 py-3 text-sm leading-relaxed shadow-sm",
          isLead && "bg-white text-foreground rounded-bl-md border border-border/40",
          isAi && "bg-[hsl(var(--navy))] text-[hsl(var(--cream))] rounded-br-md",
          isAgent && "bg-emerald-600 text-white rounded-br-md",
        )}
      >
        {!isLead && (
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-80",
            isAi ? "text-[hsl(var(--cream))]" : "text-emerald-50",
          )}>
            {isAi ? "🤖 IA" : "👤 Agente"}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <span className="text-[10px] text-muted-foreground px-2">
        {isAi ? "IA · " : isAgent ? "Agente · " : ""}
        {formatTime(message.timestamp)}
      </span>
    </div>
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
                onClick={() => navigate(`/crm?tab=ops`)}
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
                  navigate(`/crm?tab=ops`);
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

  const CRMButton = (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openInCRM}
        className="h-7 px-2.5 text-[11px] gap-1 shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir no CRM
      </Button>
      {missingLeadDialog}
    </>
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<"summary" | "crm">("summary");
  const [newMsgOpen, setNewMsgOpen] = useState(false);

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
      return data ?? [];
    },
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
            : m.message_type === "image"
              ? `📷 ${m.media_caption ?? "Imagem"}${m.media_url ? `\n${m.media_url}` : ""}`
              : m.message_type === "audio"
                ? `🎤 Áudio${m.media_url ? `\n${m.media_url}` : ""}`
                : m.message_type === "video"
                  ? `🎥 ${m.media_caption ?? "Vídeo"}${m.media_url ? `\n${m.media_url}` : ""}`
                  : m.message_type === "document"
                    ? `📄 ${m.media_caption ?? "Documento"}${m.media_url ? `\n${m.media_url}` : ""}`
                    : (m.content ?? m.media_url ?? "Mensagem"),
        timestamp: m.created_at,
      }));
      // Se não há nenhuma mensagem carregada, cria uma "fake" só para preview
      const fallbackMsg: Message = {
        id: `${c.id}-last`,
        sender: (c.last_message_from ?? "lead") as MessageSender,
        content: c.last_message_text ?? "",
        timestamp: c.last_message_at ?? c.updated_at ?? c.created_at,
      };
      const meta = c.contact_id ? contactMetaById.get(c.contact_id) : null;
      // Fonte da verdade: tabela contacts. wa_conversations.contact_name é apenas espelho.
      const canonicalName = (meta?.full_name && String(meta.full_name).trim()) || c.contact_name || c.phone || "Sem nome";
      const canonicalLevel: ContactLevel =
        (meta?.level as ContactLevel) ||
        (c.client_id ? "cliente" : c.lead_id ? "lead" : "prospect");
      const canonicalClientId = meta?.client_id ?? c.client_id ?? undefined;
      const canonicalLeadId = meta?.lead_id ?? c.lead_id ?? undefined;
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
        // "Novo" = primeiro contato (criado < 24h) E ainda não foi promovido a Lead/Cliente
        isNew:
          !canonicalClientId &&
          canonicalLevel === "prospect" &&
          !!c.created_at &&
          Date.now() - new Date(c.created_at).getTime() < 24 * 60 * 60 * 1000,
        leadId: canonicalLeadId,
        contactId: c.contact_id ?? undefined,
        firstContactAt: meta?.first_contact_at ?? c.created_at ?? undefined,
        lastContactAt: meta?.last_contact_at ?? c.last_message_at ?? undefined,
        isReturning: !!meta?.is_returning,
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
        body: { action: "send-text", phone: convo.phone, message: draft.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDraft("");
      qc.invalidateQueries({ queryKey: ["wa_messages", selectedId] });
      qc.invalidateQueries({ queryKey: ["wa_conversations"] });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };


  const counts = useMemo(
    () => ({
      all: conversations.length,
      leads: conversations.filter((c) => c.category === "sales").length,
      support: conversations.filter((c) => c.category === "post-sale").length,
      human: conversations.filter((c) => c.status === "human").length,
    }),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Prioridade: Cliente em viagem > Cliente > Lead > Prospect.
    // Dentro do mesmo nível, mais recente primeiro.
    const priority = (c: Conversation) => {
      if (c.level === "cliente" && c.isTraveling) return 0;
      if (c.level === "cliente") return 1;
      if (c.level === "lead") return 2;
      return 3;
    };
    return conversations
      .filter((c) => {
        if (activeTab === "leads" && c.category !== "sales") return false;
        if (activeTab === "support" && c.category !== "post-sale") return false;
        if (activeTab === "human" && c.status !== "human") return false;
        if (!q) return true;
        return (
          c.leadName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          getLastMessage(c).content.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const pa = priority(a);
        const pb = priority(b);
        if (pa !== pb) return pa - pb;
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
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
          <button
            type="button"
            onClick={() => setPendingAgentToggle(false)}
            className="h-7 px-3 text-[12px] rounded-md border border-gray-300 text-gray-600 hover:bg-white transition-colors"
          >
            Desativar IA
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPendingAgentToggle(true)}
            className="h-7 px-3 text-[12px] rounded-md bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
          >
            Ativar IA
          </button>
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
      <aside className="w-[340px] shrink-0 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">Atendimento</h1>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/ai-agents")}
                className="h-8 gap-1.5"
                title="Configurar Agente de IA e WhatsApp"
              >
                <Bot className="h-3.5 w-3.5" />
                Agente IA
              </Button>
              <Button
                size="sm"
                onClick={() => setNewMsgOpen(true)}
                className="h-8 gap-1.5 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova
              </Button>
            </div>
          </div>
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
              <TabsTrigger value="leads" className="text-[11px] gap-1">
                Leads
                <span className="text-[10px] text-muted-foreground">{counts.leads}</span>
              </TabsTrigger>
              <TabsTrigger value="support" className="text-[11px] gap-1">
                Suporte
                <span className="text-[10px] text-muted-foreground">{counts.support}</span>
              </TabsTrigger>
              <TabsTrigger value="human" className="text-[11px] gap-1">
                Humanos
                <span className="text-[10px] text-muted-foreground">{counts.human}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-3 space-y-3">
            {isLoadingConvos && filtered.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`sk-${i}`} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card/40 animate-fade-in">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-10" />
                    </div>
                    <Skeleton className="h-2.5 w-full max-w-[180px]" />
                    <Skeleton className="h-2.5 w-1/2" />
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
                  onClick={() => {
                    setSelectedId(c.id);
                    setSummaryOpen(false);
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
            <ScrollArea className="flex-1 px-6 py-5">
              <div className="space-y-4 max-w-3xl mx-auto">
                {selected.messages.map((m) => (
                  <div key={m.id} className="space-y-4">
                    <ChatBubble message={m} />
                    {selected.handoffAfterMessageId === m.id && <HandoffDivider />}
                  </div>
                ))}
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
                    <Input
                      placeholder="Digite uma mensagem..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={sending}
                      className="h-11 rounded-full px-5 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      size="icon"
                      disabled={!draft.trim() || sending}
                      onClick={handleSend}
                      className="h-11 w-11 rounded-full shrink-0"
                    >
                      <SendHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                </>
              )}
            </footer>
          </>
        )}
      </section>

      {/* ===== Right column: lead summary + CRM panel ===== */}
      {selected && summaryOpen && (
        <aside className="w-[340px] shrink-0 border-l hidden lg:flex flex-col bg-white">
          <Tabs
            value={sidePanelTab}
            onValueChange={(v) => setSidePanelTab(v as "summary" | "crm")}
            className="flex-1 flex flex-col min-h-0"
          >
            <div className="px-4 pt-3 pb-0 border-b">
              <TabsList className="grid grid-cols-2 w-full h-9 bg-muted/60 p-0.5">
                <TabsTrigger value="summary" className="text-xs gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Resumo IA
                </TabsTrigger>
                <TabsTrigger value="crm" className="text-xs gap-1.5">
                  {selected.category === "post-sale" ? (
                    <LifeBuoy className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  CRM
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="summary" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
              <LeadSummaryPanel summary={selected.summary} />
            </TabsContent>
            <TabsContent value="crm" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
              <CRMPanel conversation={selected} />
            </TabsContent>
          </Tabs>
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
      
    </div>
  );
}
