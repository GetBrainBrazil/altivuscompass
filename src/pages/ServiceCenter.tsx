import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, SendHorizontal, MessageSquare, UserRound, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "human" | "ai";

// ============= Types =============
type MessageSender = "lead" | "ai" | "agent";

interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: string; // ISO
}

type ConversationStatus = "ai" | "human";

interface Conversation {
  id: string;
  leadName: string;
  phone: string;
  status: ConversationStatus;
  messages: Message[];
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
  // +5511987654321 -> +55 (11) 98765-4321
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
        "relative w-full text-left px-3 py-3 rounded-lg border transition-colors overflow-hidden",
        "border-transparent bg-white hover:bg-muted/40",
        active && "bg-muted/60 hover:bg-muted/60",
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
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="text-xs font-medium">
            {getInitials(conversation.leadName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm truncate">{conversation.leadName}</p>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatTime(last.timestamp)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {last.sender === "lead" ? "" : "IA: "}
            {last.content}
          </p>
          <div className="mt-1.5">
            {isAi ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success border border-success/25">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                IA Atendendo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-warning/20 text-warning border border-warning/30">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                Intervenção Humana
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
    <div className={cn("flex w-full", isLead ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
          isLead
            ? "bg-white text-foreground shadow-sm rounded-bl-none"
            : "bg-[hsl(var(--navy))] text-[hsl(var(--cream))] rounded-br-none",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={cn(
            "text-[10px] mt-1.5",
            isLead ? "text-muted-foreground" : "text-[hsl(var(--cream))]/70",
          )}
        >
          {message.sender === "ai" ? "IA · " : ""}
          {formatTime(message.timestamp)}
        </p>
      </div>
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

  const counts = useMemo(
    () => ({
      all: conversations.length,
      human: conversations.filter((c) => c.status === "human").length,
      ai: conversations.filter((c) => c.status === "ai").length,
    }),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (activeTab === "human" && c.status !== "human") return false;
      if (activeTab === "ai" && c.status !== "ai") return false;
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
            <TabsList className="grid grid-cols-3 w-full h-9 bg-muted/60 p-0.5">
              <TabsTrigger value="all" className="text-xs gap-1.5">
                Todos
                <span className="text-[10px] text-muted-foreground">{counts.all}</span>
              </TabsTrigger>
              <TabsTrigger value="human" className="text-xs gap-1.5">
                Requer Atenção
                <span className="text-[10px] text-muted-foreground">{counts.human}</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1.5">
                Em triagem
                <span className="text-[10px] text-muted-foreground">{counts.ai}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
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
                  onClick={() => setSelectedId(c.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ===== Right column: chat window ===== */}
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
              <Button variant="outline" size="sm" className="gap-2">
                <UserRound className="h-4 w-4" />
                Assumir Conversa
              </Button>
            </header>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-5">
              <div className="space-y-4 max-w-3xl mx-auto">
                {selected.messages.map((m) => (
                  <ChatBubble key={m.id} message={m} />
                ))}
              </div>
            </ScrollArea>

            {/* Composer */}
            <footer className="border-t bg-white/80 backdrop-blur-sm p-4">
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
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
