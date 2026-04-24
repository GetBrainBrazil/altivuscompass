import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  MessagesSquare,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AIConfigPanel from "@/components/service-center/AIConfigPanel";

type MainView = "chats" | "ai-config";

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
}

// ============= Mock Data =============
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    leadName: "Mariana Costa",
    phone: "+5511987654321",
    status: "ai",
    messages: [
      { id: "m1", sender: "lead", content: "Oi! Estou pensando em viajar para a Europa em julho.", timestamp: "2025-04-23T09:12:00" },
      { id: "m2", sender: "ai", content: "Olá, Mariana! Que ótimo, julho é uma época incrível na Europa. 🌍 Você já tem alguma cidade ou país em mente?", timestamp: "2025-04-23T09:12:30" },
      { id: "m3", sender: "lead", content: "Penso em Itália e França. Seriam uns 12 dias.", timestamp: "2025-04-23T09:14:00" },
      { id: "m4", sender: "ai", content: "Perfeito! Para 12 dias entre Itália e França, conseguimos um roteiro bem confortável. Vai viajar com mais alguém?", timestamp: "2025-04-23T09:14:25" },
      { id: "m5", sender: "lead", content: "Sim, com meu marido. Queremos algo romântico, com bons hotéis.", timestamp: "2025-04-23T09:16:10" },
      { id: "m6", sender: "ai", content: "Anotado! Casal, foco em conforto e experiências românticas. Posso sugerir Roma, Florença, Paris e talvez uma escapada à Provence. Qual é o orçamento aproximado por pessoa?", timestamp: "2025-04-23T09:16:45" },
    ],
    summary: {
      destination: "Itália e França (Roma, Florença, Paris)",
      travelers: "Casal (2 adultos)",
      duration: "12 dias — julho/2025",
      budget: "A confirmar",
      notes: [
        "Perfil romântico, foco em conforto.",
        "Demonstrou interesse em hotéis de categoria superior.",
        "Lead aguardando sugestão de faixa de orçamento.",
      ],
    },
    category: "sales",
    contactType: "new-lead",
    crm: { stage: "Novos Leads (IA)" },
  },
  {
    id: "c2",
    leadName: "Rafael Almeida",
    phone: "+5521991234567",
    status: "human",
    messages: [
      { id: "m1", sender: "lead", content: "Bom dia, gostaria de uma cotação para Maldivas em setembro.", timestamp: "2025-04-22T08:30:00" },
      { id: "m2", sender: "ai", content: "Bom dia, Rafael! Maldivas em setembro é uma escolha excelente — clima ainda bom e preços melhores. Quantas pessoas e quantas noites?", timestamp: "2025-04-22T08:30:40" },
      { id: "m3", sender: "lead", content: "Casal, 7 noites, queremos resort com bangalô sobre a água.", timestamp: "2025-04-22T08:33:00" },
      { id: "m4", sender: "ai", content: "Maravilha! Tenho ótimas opções como o Soneva Jani, Conrad Rangali e Anantara Kihavah. Posso encaminhar ao consultor especializado para fechar valores?", timestamp: "2025-04-22T08:33:35" },
      { id: "m5", sender: "lead", content: "Sim, por favor. Quero falar com alguém para fechar logo.", timestamp: "2025-04-22T08:35:00" },
    ],
    handoffAfterMessageId: "m4",
    summary: {
      destination: "Maldivas",
      travelers: "Casal (2 adultos)",
      duration: "7 noites — setembro/2025",
      budget: "Premium (resort 5★, bangalô sobre a água)",
      notes: [
        "Cliente com alta intenção de compra (\"fechar logo\").",
        "Resorts de interesse: Soneva Jani, Conrad Rangali, Anantara Kihavah.",
        "Solicitou explicitamente atendimento humano.",
      ],
    },
    category: "sales",
    contactType: "existing-client",
    crm: {
      clientId: "cli-rafael",
      clientName: "Rafael Almeida",
      quoteId: "q-2025-0142",
      quoteTitle: "Maldivas — 7 noites (Set/2025)",
      stage: "Cotação",
    },
  },
  {
    id: "c3",
    leadName: "Juliana Pereira",
    phone: "+5531988887777",
    status: "ai",
    messages: [
      { id: "m1", sender: "lead", content: "Olá, vocês fazem pacotes para Disney?", timestamp: "2025-04-23T14:02:00" },
      { id: "m2", sender: "ai", content: "Olá, Juliana! Sim, somos especialistas em Disney e Orlando. ✨ Vai viajar em família? Quantos adultos e crianças?", timestamp: "2025-04-23T14:02:20" },
      { id: "m3", sender: "lead", content: "Eu, meu marido e duas crianças (8 e 11 anos).", timestamp: "2025-04-23T14:04:00" },
      { id: "m4", sender: "ai", content: "Perfeito! Para essa idade, costumo recomendar pelo menos 10 dias para curtir bem os parques. Você prefere hotel dentro da Disney ou fora?", timestamp: "2025-04-23T14:04:30" },
      { id: "m5", sender: "lead", content: "Dentro da Disney mesmo, para aproveitar os benefícios.", timestamp: "2025-04-23T14:06:00" },
      { id: "m6", sender: "ai", content: "Ótima escolha! Tenho boas opções nas categorias Value, Moderate e Deluxe. Qual seria a faixa de orçamento ideal?", timestamp: "2025-04-23T14:06:25" },
    ],
    summary: {
      destination: "Orlando — Disney",
      travelers: "Família (2 adultos + 2 crianças, 8 e 11 anos)",
      duration: "10 dias (sugerido pela IA)",
      budget: "A confirmar",
      notes: [
        "Preferência por hospedagem dentro dos parques Disney.",
        "Categoria do hotel ainda não definida (Value/Moderate/Deluxe).",
        "Lead em fase inicial de descoberta.",
      ],
    },
    category: "sales",
    contactType: "new-lead",
    crm: { stage: "Novos Leads (IA)" },
  },
  {
    id: "c4",
    leadName: "Carlos Mendes",
    phone: "+5511999998888",
    status: "ai",
    messages: [
      { id: "m1", sender: "lead", content: "Oi, tudo bem?", timestamp: "2025-04-23T16:00:00" },
      { id: "m2", sender: "ai", content: "Olá! Tudo bem, obrigado. Como posso ajudar você hoje?", timestamp: "2025-04-23T16:00:30" },
    ],
    summary: {
      notes: [
        "Conversa em estágio inicial.",
        "Aguardando mais informações do lead.",
      ],
    },
    category: "sales",
    contactType: "new-lead",
    crm: { stage: "Triagem inicial" },
  },
  {
    id: "c5",
    leadName: "Patrícia Nogueira",
    phone: "+5511944443333",
    status: "human",
    messages: [
      { id: "m1", sender: "lead", content: "Socorro! Estou no aeroporto de Cancún e meu voo de volta foi cancelado. O que faço?", timestamp: "2025-04-23T18:42:00" },
      { id: "m2", sender: "ai", content: "Olá, Patrícia! Lamento muito pelo ocorrido. Identifiquei sua reserva conosco (Pacote Cancún Nov/2025). Já estou acionando o consultor responsável agora mesmo. Por favor, me envie uma foto do painel de voos ou do comunicado da cia aérea.", timestamp: "2025-04-23T18:42:30" },
      { id: "m3", sender: "lead", content: "Mandei a foto. A LATAM falou em remarcar só amanhã à noite.", timestamp: "2025-04-23T18:45:00" },
      { id: "m4", sender: "ai", content: "Recebido. Acionei o atendimento humano com prioridade alta — você será contatada em instantes pela Beatriz, sua consultora.", timestamp: "2025-04-23T18:45:40" },
    ],
    handoffAfterMessageId: "m4",
    summary: {
      destination: "Cancún, México (em viagem)",
      travelers: "Casal (2 adultos)",
      duration: "Pacote Nov/2025 — em curso",
      budget: "Pacote já fechado (R$ 15.000)",
      notes: [
        "Cliente em viagem com voo de volta cancelado.",
        "Solicita reacomodação ou hotel adicional em Cancún.",
        "Caso urgente — pós-venda crítico.",
      ],
    },
    category: "post-sale",
    contactType: "existing-client",
    crm: {
      clientId: "cli-patricia",
      clientName: "Patrícia Nogueira",
      tripId: "trip-cancun-2025",
      tripTitle: "Cancún — Resort All-Inclusive (Nov/2025)",
      stage: "Suporte Ativo",
    },
  },
];

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

// ============= Subcomponents =============
interface ConversationCardProps {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}

const ConversationCard = ({ conversation, active, onClick }: ConversationCardProps) => {
  const last = getLastMessage(conversation);
  const isAi = conversation.status === "ai";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden",
        "border-gray-200 bg-white shadow-sm hover:shadow-md hover:bg-gray-50/80",
        active && "bg-gray-50 border-gray-300 shadow-md ring-1 ring-gray-200",
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
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0 self-center">
          <AvatarFallback className="text-xs font-medium">
            {getInitials(conversation.leadName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm truncate">{conversation.leadName}</p>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatTime(last.timestamp)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
            {last.sender === "lead" ? "" : "IA: "}
            {last.content}
          </p>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {/* Categoria CRM detectada pela IA */}
            {conversation.category === "post-sale" ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <LifeBuoy className="w-2.5 h-2.5" />
                Pós-venda
              </span>
            ) : conversation.contactType === "existing-client" ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <UserCheck className="w-2.5 h-2.5" />
                Cliente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                <UserPlus className="w-2.5 h-2.5" />
                Lead novo
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
  return (
    <div className={cn("flex w-full flex-col gap-1", isLead ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-3xl px-5 py-3 text-sm leading-relaxed",
          isLead
            ? "bg-white text-foreground shadow-sm rounded-bl-md border border-border/40"
            : "bg-[hsl(var(--navy))] text-[hsl(var(--cream))] rounded-br-md",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <span className="text-[10px] text-muted-foreground px-2">
        {message.sender === "ai" ? "IA · " : message.sender === "agent" ? "Agente · " : ""}
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
  const { category, contactType, crm } = conversation;
  const isPostSale = category === "post-sale";
  const isExisting = contactType === "existing-client";

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
              onClick={() => navigate(isPostSale ? "/crm?tab=ops" : "/crm?tab=sales")}
            >
              {isPostSale ? <LifeBuoy className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Abrir no CRM ({isPostSale ? "Operações" : "Vendas"})
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

// ============= Main Page =============
export default function ServiceCenter() {
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [draft, setDraft] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<"summary" | "crm">("summary");
  const [mainView, setMainView] = useState<MainView>("chats");

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
    return conversations.filter((c) => {
      if (activeTab === "leads" && c.category !== "sales") return false;
      if (activeTab === "support" && c.category !== "post-sale") return false;
      if (activeTab === "human" && c.status !== "human") return false;
      if (!q) return true;
      return (
        c.leadName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        getLastMessage(c).content.toLowerCase().includes(q)
      );
    });
  }, [conversations, search, activeTab]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* ===== Left column: conversation list ===== */}
      <aside className="w-[340px] shrink-0 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h1 className="text-lg font-semibold">Atendimento</h1>
          <Tabs value={mainView} onValueChange={(v) => setMainView(v as MainView)}>
            <TabsList className="grid grid-cols-2 w-full h-9 bg-muted/60 p-0.5">
              <TabsTrigger value="chats" className="text-xs gap-1.5">
                <MessagesSquare className="h-3.5 w-3.5" />
                Chats Ativos
              </TabsTrigger>
              <TabsTrigger value="ai-config" className="text-xs gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Configurações da IA
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {mainView === "chats" && (
            <>
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
                    Humano
                    <span className="text-[10px] text-muted-foreground">{counts.human}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          )}
        </div>

        {mainView === "chats" ? (
          <ScrollArea className="flex-1">
            <div className="px-4 py-3 space-y-3">
              {filtered.length === 0 ? (
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
        ) : (
          <div className="flex-1 px-4 py-6">
            <div className="rounded-xl border border-dashed bg-muted/30 p-5 text-center space-y-2">
              <div className="h-10 w-10 mx-auto rounded-full bg-white shadow-sm flex items-center justify-center">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs font-medium">Modo configuração</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Você está editando o comportamento do agente. Volte para "Chats Ativos" para retomar o atendimento.
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* ===== Center column: chat window OR AI config ===== */}
      {mainView === "ai-config" ? (
        <section className="flex-1 min-w-0">
          <AIConfigPanel />
        </section>
      ) : (
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
                <Button
                  size="sm"
                  className="gap-2 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90 shadow-sm"
                >
                  <UserRound className="h-4 w-4" />
                  Assumir Conversa
                </Button>
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
              {selected.status === "ai" ? (
                <div className="max-w-3xl mx-auto flex items-center justify-center gap-2 rounded-full border border-dashed border-muted-foreground/30 bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
                  <UserRound className="h-4 w-4 shrink-0" />
                  <span>
                    Assuma esta conversa para poder enviar mensagens.
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 max-w-3xl mx-auto">
                    <Input
                      placeholder="Digite uma mensagem..."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-11 rounded-full px-5 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <Button
                      size="icon"
                      disabled={!draft.trim()}
                      className="h-11 w-11 rounded-full shrink-0"
                    >
                      <SendHorizontal className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-3">
                    Visualização preliminar — envio de mensagens será habilitado em breve.
                  </p>
                </>
              )}
            </footer>
          </>
        )}
      </section>
      )}

      {/* ===== Right column: lead summary + CRM panel ===== */}
      {mainView === "chats" && selected && summaryOpen && (
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
  );
}
