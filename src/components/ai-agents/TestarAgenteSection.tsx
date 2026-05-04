import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Send, Download, Check, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Role = "agent" | "user";
interface Msg {
  id: string;
  role: Role;
  text: string;
  ts: Date;
}

type FlowKey = "cotacao" | "suporte" | "indeciso" | "none";
const FLOW_LABELS: Record<FlowKey, { label: string; dot: string }> = {
  cotacao: { label: "Nova Cotação", dot: "🟢" },
  suporte: { label: "Suporte", dot: "🔴" },
  indeciso: { label: "Prospect Indeciso", dot: "🟡" },
  none: { label: "Não identificado", dot: "⚪" },
};

type Sentiment = "pos" | "neu" | "neg";
const SENT_LABELS: Record<Sentiment, { emoji: string; label: string }> = {
  pos: { emoji: "😊", label: "Positivo" },
  neu: { emoji: "😐", label: "Neutro" },
  neg: { emoji: "😤", label: "Negativo" },
};

const PERSONAS: { value: string; label: string; firstMsg?: string; flow?: FlowKey }[] = [
  { value: "livre", label: "Conversa livre" },
  {
    value: "lead",
    label: "Lead novo — quer cotação para Paris",
    firstMsg: "Olá! Gostaria de uma cotação de viagem para Paris em julho, para 2 pessoas.",
    flow: "cotacao",
  },
  {
    value: "suporte",
    label: "Cliente com problema — voo cancelado",
    firstMsg: "Meu voo foi cancelado e preciso de ajuda urgente!",
    flow: "suporte",
  },
  {
    value: "indeciso",
    label: "Prospect indeciso — não sabe para onde ir",
    firstMsg: "Oi, queria viajar mas não sei para onde. Pode me ajudar?",
    flow: "indeciso",
  },
];

const fmtTime = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const detectFlow = (text: string): FlowKey => {
  const t = text.toLowerCase();
  if (/(cota[çc][aã]o|or[çc]amento|viagem para|pre[çc]o|pacote)/.test(t)) return "cotacao";
  if (/(problema|cancelad|reclama|n[aã]o consigo|urgente|ajuda)/.test(t)) return "suporte";
  if (/(n[aã]o sei|indeciso|sugest|talvez|pensando)/.test(t)) return "indeciso";
  return "none";
};

const detectSentiment = (text: string): Sentiment => {
  const t = text.toLowerCase();
  if (/(p[ée]ssimo|raiva|absurd|horr[íi]vel|cancelad|problema|urgente|reclama)/.test(t)) return "neg";
  if (/([óo]timo|adorei|maravilh|obrigad|feliz|perfeito|legal)/.test(t)) return "pos";
  return "neu";
};

const extractData = (text: string, current: Record<string, string>) => {
  const next = { ...current };
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch && !next.email) next.email = emailMatch[0];
  const nameMatch = text.match(/(?:meu nome [ée]|sou o|sou a|me chamo)\s+([A-Z][a-zà-ú]+(?:\s+[A-Z][a-zà-ú]+)?)/i);
  if (nameMatch && !next.nome) next.nome = nameMatch[1];
  const dest = text.match(/\b(Paris|Roma|Londres|Nova York|T[óo]quio|Lisboa|Madrid|Bali|Cancun|Dubai|Orlando|Buenos Aires)\b/i);
  if (dest && !next.destino) next.destino = dest[1];
  const period = text.match(/\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i);
  if (period && !next.periodo) next.periodo = period[1];
  const pax = text.match(/(\d+)\s*(pessoa|pessoas|adultos?|viajantes?|pax)/i);
  if (pax && !next.viajantes) next.viajantes = pax[1];
  return next;
};

const generateAgentReply = (flow: FlowKey, data: Record<string, string>): { text: string; nextAction: string; rules: string[] } => {
  const rules: string[] = [];
  if (flow === "cotacao") {
    if (!data.destino) return { text: "Que ótimo! Para começarmos sua cotação, qual destino você tem em mente?", nextAction: "Perguntar destino", rules };
    if (!data.periodo) return { text: `Perfeito, ${data.destino}! Em qual período você pretende viajar?`, nextAction: "Solicitar período", rules };
    if (!data.viajantes) return { text: "Quantas pessoas vão viajar?", nextAction: "Solicitar nº de viajantes", rules };
    if (!data.nome) return { text: "Para finalizar, poderia me informar seu nome completo?", nextAction: "Coletar nome", rules };
    if (!data.email) return { text: "E qual o melhor e-mail para envio da proposta?", nextAction: "Coletar e-mail", rules };
    rules.push("Não compartilhar preços");
    return { text: "Ótimo! Já tenho todas as informações. Vou encaminhar para um consultor preparar sua proposta personalizada. 😊", nextAction: "Encaminhar para CRM", rules };
  }
  if (flow === "suporte") {
    rules.push("Não confirmar reservas");
    return { text: "Sinto muito pelo ocorrido. Vou transferir você imediatamente para nossa equipe de suporte humano que poderá resolver isso. Um momento, por favor.", nextAction: "Transferir para humano", rules };
  }
  if (flow === "indeciso") {
    return { text: "Sem problemas! Posso te ajudar a descobrir o destino ideal. Você prefere praia, cidade, natureza ou aventura?", nextAction: "Qualificar preferências", rules };
  }
  return { text: "Olá! Como posso te ajudar hoje? 😊", nextAction: "Aguardar mensagem", rules };
};

export function TestarAgenteSection() {
  const [persona, setPersona] = useState("livre");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [flow, setFlow] = useState<FlowKey>("none");
  const [sentiment, setSentiment] = useState<Sentiment>("neu");
  const [data, setData] = useState<Record<string, string>>({});
  const [nextAction, setNextAction] = useState("Aguardar mensagem");
  const [rulesApplied, setRulesApplied] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Welcome message on first load
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setTimeout(() => {
      setMessages([{
        id: crypto.randomUUID(),
        role: "agent",
        text: "Olá! 👋 Bem-vindo(a). Sou o atendente virtual. Como posso te ajudar hoje?",
        ts: new Date(),
      }]);
    }, 200);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed, ts: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    const newFlow = flow === "none" ? detectFlow(trimmed) : flow;
    setFlow(newFlow);
    setSentiment(detectSentiment(trimmed));
    const newData = extractData(trimmed, data);
    setData(newData);

    setTyping(true);
    setTimeout(() => {
      const reply = generateAgentReply(newFlow, newData);
      setNextAction(reply.nextAction);
      if (reply.rules.length) {
        setRulesApplied((r) => Array.from(new Set([...r, ...reply.rules])));
      }
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "agent", text: reply.text, ts: new Date() }]);
      setTyping(false);
    }, 1200 + Math.random() * 600);
  };

  const handlePersonaChange = (v: string) => {
    setPersona(v);
    const p = PERSONAS.find((x) => x.value === v);
    if (p?.firstMsg) {
      setInput(p.firstMsg);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setFlow("none");
    setSentiment("neu");
    setData({});
    setNextAction("Aguardar mensagem");
    setRulesApplied([]);
    initialized.current = false;
    setTimeout(() => {
      initialized.current = true;
      setMessages([{
        id: crypto.randomUUID(),
        role: "agent",
        text: "Olá! 👋 Bem-vindo(a). Sou o atendente virtual. Como posso te ajudar hoje?",
        ts: new Date(),
      }]);
    }, 100);
  };

  const handleExport = () => {
    const text = messages
      .map((m) => `[${fmtTime(m.ts)}] ${m.role === "agent" ? "Agente" : "Cliente"}: ${m.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversa-teste-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dataFields = useMemo(
    () => [
      { key: "nome", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "destino", label: "Destino" },
      { key: "periodo", label: "Período" },
      { key: "viajantes", label: "Viajantes" },
    ],
    []
  );

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Testar Agente
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Simule uma conversa para validar personalidade e regras antes de ativar.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={persona} onValueChange={handlePersonaChange}>
            <SelectTrigger className="h-9 w-full sm:w-[280px]">
              <SelectValue placeholder="Simular como…" />
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[600px]">
          {/* LEFT: Chat */}
          <div className="lg:col-span-3 flex flex-col rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
            {/* WhatsApp header */}
            <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">Agente IA</div>
                <div className="text-[11px] flex items-center gap-1.5 opacity-90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Online
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-white/90 hover:text-white inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resetar
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
              style={{
                background: "#ECE5DD",
                backgroundImage:
                  "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.4) 0, transparent 40%)",
                minHeight: 380,
                maxHeight: 520,
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] px-3 py-2 rounded-lg shadow-sm relative text-sm",
                      m.role === "user"
                        ? "bg-[#DCF8C6] text-gray-900 rounded-tr-none"
                        : "bg-white text-gray-900 rounded-tl-none"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words pr-10">{m.text}</div>
                    <div className="text-[10px] text-gray-500 absolute right-2 bottom-1 tabular-nums">
                      {fmtTime(m.ts)}
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-lg rounded-tl-none px-3 py-2.5 shadow-sm flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 bg-[#F0F0F0] border-t border-gray-200 flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Digite uma mensagem..."
                className="h-10 bg-white border-gray-200"
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                className="h-10 w-10 shrink-0 bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] text-white"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* RIGHT: Debug */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 overflow-y-auto" style={{ maxHeight: 600 }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Debug em tempo real
            </h3>

            <div className="space-y-5 font-mono text-[12px]">
              {/* Fluxo */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-sans font-semibold mb-1.5">
                  Fluxo detectado
                </div>
                <Badge variant="outline" className="bg-white">
                  <span className="mr-1">{FLOW_LABELS[flow].dot}</span>
                  {FLOW_LABELS[flow].label}
                </Badge>
              </div>

              {/* Dados */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-sans font-semibold mb-1.5">
                  Dados coletados
                </div>
                <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
                  {dataFields.map((f) => {
                    const val = data[f.key];
                    return (
                      <div key={f.key} className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-gray-600 font-sans text-[12px]">{f.label}</span>
                        <span className={cn("flex items-center gap-1.5", val ? "text-[hsl(220_45%_15%)]" : "text-gray-400")}>
                          {val && <Check className="h-3 w-3 text-emerald-600" />}
                          {val || "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Próxima ação */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-sans font-semibold mb-1.5">
                  Próxima ação
                </div>
                <div className="bg-white rounded-md border border-gray-200 px-3 py-2 text-[hsl(220_45%_15%)]">
                  {nextAction}
                </div>
              </div>

              {/* Regras aplicadas */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-sans font-semibold mb-1.5">
                  Regras aplicadas
                </div>
                {rulesApplied.length === 0 ? (
                  <div className="text-gray-400">Nenhuma regra acionada</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {rulesApplied.map((r) => (
                      <Badge key={r} variant="outline" className="bg-white text-[11px] font-sans">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Sentimento */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-sans font-semibold mb-1.5">
                  Sentimento do cliente
                </div>
                <div className="bg-white rounded-md border border-gray-200 px-3 py-2 flex items-center gap-2">
                  <span className="text-lg">{SENT_LABELS[sentiment].emoji}</span>
                  <span className="text-[hsl(220_45%_15%)] font-sans">{SENT_LABELS[sentiment].label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
