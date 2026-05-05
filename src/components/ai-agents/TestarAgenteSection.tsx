import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Send, Download, Check, Bot, Plane, LifeBuoy, HelpCircle, CircleDashed, SmilePlus, Minus, Frown, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Agent } from "@/components/ai-agents/AgentEditDialog";
import { useWhatsAppProfile } from "@/hooks/useWhatsAppProfile";
import { useTheme } from "@/contexts/ThemeContext";

type Role = "agent" | "user";
interface Msg {
  id: string;
  role: Role;
  text: string;
  ts: Date;
}

type FlowKey = "nova_cotacao" | "suporte" | "prospect_indeciso" | "nao_identificado";
const FLOW_LABELS: Record<FlowKey, { label: string; Icon: LucideIcon; bg: string; color: string }> = {
  nova_cotacao: { label: "Nova Cotação", Icon: Plane, bg: "bg-green-50", color: "text-green-600" },
  suporte: { label: "Suporte", Icon: LifeBuoy, bg: "bg-red-50", color: "text-red-600" },
  prospect_indeciso: { label: "Prospect Indeciso", Icon: HelpCircle, bg: "bg-amber-50", color: "text-amber-600" },
  nao_identificado: { label: "Não identificado", Icon: CircleDashed, bg: "bg-gray-100", color: "text-gray-500" },
};

type Sentiment = "positivo" | "neutro" | "negativo";
const SENT_LABELS: Record<Sentiment, { Icon: LucideIcon; label: string; bg: string; color: string }> = {
  positivo: { Icon: SmilePlus, label: "Positivo", bg: "bg-green-50", color: "text-green-600" },
  neutro: { Icon: Minus, label: "Neutro", bg: "bg-gray-100", color: "text-gray-500" },
  negativo: { Icon: Frown, label: "Negativo", bg: "bg-red-50", color: "text-red-600" },
};

const PERSONAS: { value: string; label: string; firstMsg?: string }[] = [
  { value: "livre", label: "Conversa livre (contato novo)" },
  {
    value: "lead",
    label: "Lead novo — quer cotação para Paris",
    firstMsg: "Oi, quero fazer uma cotação para uma viagem para Paris",
  },
  {
    value: "suporte",
    label: "Cliente com problema — voo cancelado",
    firstMsg: "Oi, estou com um problema urgente, meu voo foi cancelado e preciso de ajuda",
  },
  {
    value: "indeciso",
    label: "Prospect indeciso — não sabe para onde ir",
    firstMsg: "Olá, estou pensando em viajar mas não sei para onde, podem me ajudar?",
  },
];

interface ExistingContact {
  id: string;
  full_name: string;
  phone: string | null;
  level: string;
  contextLabel: string;
}

const fmtTime = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const TONE_DESCRIPTIONS: Record<string, string> = {
  amigavel: "Use linguagem calorosa, próxima e acolhedora. Seja empático e gentil.",
  formal: "Use linguagem formal, cordial e profissional. Trate o cliente com respeito e elegância.",
  consultivo: "Aja como um consultor especialista. Faça perguntas estratégicas e demonstre conhecimento profundo sobre viagens.",
  direto: "Seja direto, claro e objetivo. Evite rodeios e vá ao ponto rapidamente.",
  entusiasmado: "Seja entusiasmado, inspirador e motivador. Transmita paixão por viagens.",
};

function buildSystemPrompt(agent: Agent, clientContextBlock?: string): string {
  const c: any = agent.config || {};
  const com = c.comunicacao || {};
  const col = c.coleta || {};
  const reg = c.regras || {};
  const flx = c.fluxos || {};

  const presentationName = com.presentation_name || agent.name || "Atendente Virtual";
  const toneKey = agent.tone || "amigavel";
  const toneDesc = TONE_DESCRIPTIONS[toneKey] || TONE_DESCRIPTIONS.amigavel;
  const customTone = com.custom_tone ? `\nDiretrizes extras: ${com.custom_tone}` : "";

  const languages: string[] = Array.isArray(com.languages) && com.languages.length > 0
    ? com.languages
    : ["Português"];
  const autoDetect = !!com.auto_detect_language;
  const useEmojis = com.use_emojis !== false;
  const maxLen = com.max_message_length || 600;

  const enabledList = (arr: any[], key = "label") =>
    Array.isArray(arr) ? arr.filter((x) => x?.enabled !== false).map((x) => x?.[key] || x).filter(Boolean) : [];

  const requiredFields = enabledList(col.required_fields);
  const collectionTiming = col.collection_timing || "Durante a conversa, de forma natural";

  const securityRules = enabledList(reg.security_rules);
  const escalationRules = enabledList(reg.escalation_rules);
  const maxMessages = reg.max_messages || 20;
  const timeoutMin = reg.timeout_minutes || 5;
  const timeoutMsg = reg.timeout_message || "Você ainda está aí? Posso continuar te ajudando?";
  const customRules = agent.rules || reg.custom_rules || "";

  const flowCotacao = flx.cotacao || {};
  const flowSuporte = flx.suporte || {};
  const flowProspect = flx.prospect || {};

  const cotacaoQuestions = enabledList(flowCotacao.questions);
  const suporteCategories = enabledList(flowSuporte.categories);
  const suporteData = enabledList(flowSuporte.data_to_collect);
  const prospectQuestions = enabledList(flowProspect.questions);

  return `Você é ${presentationName}, atendente virtual da Altivus Turismo.
${clientContextBlock ? `\n${clientContextBlock}\n` : ""}
## TOM DE VOZ
${toneDesc}${customTone}
${agent.personality ? `\nPersonalidade: ${agent.personality}` : ""}

## IDIOMAS
Responda em: ${languages.join(", ")}.${autoDetect ? " Detecte o idioma do cliente e responda no mesmo idioma." : ""}

## EMOJIS
${useEmojis ? "Use emojis moderadamente nas respostas." : "NÃO use emojis."}

## TAMANHO DE RESPOSTA
Mantenha respostas com no máximo ${maxLen} caracteres.

## FLUXOS DE ATENDIMENTO
Identifique o tipo de atendimento na primeira mensagem do cliente e siga o fluxo apropriado.

### Fluxo 1: Nova Cotação ${flowCotacao.active === false ? "(INATIVO)" : "(ATIVO)"}
Objetivo: Coletar informações da viagem e encaminhar para cotação.
Perguntas obrigatórias (uma por vez, naturalmente):
${cotacaoQuestions.length ? cotacaoQuestions.map((q) => `- ${q}`).join("\n") : "- Destino\n- Período\n- Número de viajantes\n- Nome\n- E-mail"}
Ao concluir: ${flowCotacao.completion_action || "encaminhar para um consultor humano"}.
${flowCotacao.closing_message ? `Mensagem de encerramento: "${flowCotacao.closing_message}"` : ""}

### Fluxo 2: Suporte / Problema ${flowSuporte.active === false ? "(INATIVO)" : "(ATIVO)"}
Objetivo: Identificar o problema e escalar rapidamente para humano.
${suporteCategories.length ? `Categorias: ${suporteCategories.join(", ")}.` : ""}
${suporteData.length ? `Informações a coletar: ${suporteData.join(", ")}.` : ""}
SLA: ${flowSuporte.sla || 15} minutos.
${flowSuporte.welcome_message ? `Acolhimento: "${flowSuporte.welcome_message}"` : ""}

### Fluxo 3: Prospect Indeciso ${flowProspect.active === false ? "(INATIVO)" : "(ATIVO)"}
Objetivo: Engajar e ajudar a decidir.
Estratégia: ${flowProspect.strategy || "Fazer perguntas qualificadoras sobre preferências de viagem"}.
${prospectQuestions.length ? `Perguntas exploratórias:\n${prospectQuestions.map((q) => `- ${q}`).join("\n")}` : ""}

## COLETA DE DADOS
${requiredFields.length ? `Dados obrigatórios: ${requiredFields.join(", ")}.` : "Colete: nome, e-mail, destino, período e viajantes."}
Momento: ${collectionTiming}.
${col.validate_email ? "Valide o formato do e-mail quando coletado." : ""}
${col.validate_phone ? "Valide o formato do telefone quando coletado." : ""}
${col.confirm_data ? "Antes de encerrar, confirme todos os dados coletados com o cliente." : ""}

## REGRAS (NUNCA VIOLE)
${securityRules.length ? securityRules.map((r) => `- ${r}`).join("\n") : "- Nunca prometa preços sem confirmar com humano\n- Não invente informações\n- Não compartilhe dados de outros clientes"}

## REGRAS DE ESCALONAMENTO
${escalationRules.length ? escalationRules.map((r) => `- ${r}`).join("\n") : "- Reclamações → humano imediato\n- Problemas urgentes → humano imediato"}

## LIMITES
- Máximo ${maxMessages} mensagens por conversa antes de sugerir humano.
- Se o cliente ficar inativo por ${timeoutMin} minutos, envie: "${timeoutMsg}"

${customRules ? `## REGRAS PERSONALIZADAS\n${customRules}\n` : ""}

## INSTRUÇÕES DE DEBUG (OBRIGATÓRIO)
Ao final de CADA resposta, inclua um bloco JSON entre tags <debug></debug> com EXATAMENTE este formato:
<debug>{"detected_flow":"nova_cotacao|suporte|prospect_indeciso|nao_identificado","collected_data":{"nome":"","email":"","destino":"","periodo":"","viajantes":""},"next_action":"descrição curta","applied_rules":["regra 1"],"sentiment":"positivo|neutro|negativo"}</debug>
O bloco <debug> NÃO será mostrado ao cliente. Preencha collected_data com tudo que você já coletou na conversa (string vazia se não coletado).`;
}

interface DebugInfo {
  detected_flow: FlowKey;
  collected_data: Record<string, string>;
  next_action: string;
  applied_rules: string[];
  sentiment: Sentiment;
}

function parseAgentResponse(raw: string): { visible: string; debug: DebugInfo | null } {
  const match = raw.match(/<debug>([\s\S]*?)<\/debug>/i);
  let debug: DebugInfo | null = null;
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      debug = {
        detected_flow: (parsed.detected_flow as FlowKey) || "nao_identificado",
        collected_data: parsed.collected_data || {},
        next_action: parsed.next_action || "",
        applied_rules: Array.isArray(parsed.applied_rules) ? parsed.applied_rules : [],
        sentiment: (parsed.sentiment as Sentiment) || "neutro",
      };
    } catch {
      // ignore
    }
  }
  const visible = raw.replace(/<debug>[\s\S]*?<\/debug>/gi, "").trim();
  return { visible, debug };
}

interface Props {
  agent: Agent;
}

export function TestarAgenteSection({ agent }: Props) {
  const wa = useWhatsAppProfile();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const useWAPhoto =
    (agent.avatarSource ?? (wa.connected && wa.photoUrl ? "whatsapp" : "custom")) === "whatsapp" &&
    wa.connected &&
    !!wa.photoUrl;
  const [persona, setPersona] = useState("livre");
  const [existingContacts, setExistingContacts] = useState<ExistingContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("none");
  const [contactContextBlock, setContactContextBlock] = useState<string>("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [flow, setFlow] = useState<FlowKey>("nao_identificado");
  const [sentiment, setSentiment] = useState<Sentiment>("neutro");
  const [data, setData] = useState<Record<string, string>>({});
  const [nextAction, setNextAction] = useState("Aguardar mensagem");
  const [rulesApplied, setRulesApplied] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcomeMessage = useMemo(() => {
    const w = agent.config?.comunicacao?.welcome_message;
    return (w && String(w).trim()) || "Olá! Como posso te ajudar hoje?";
  }, [agent.config?.comunicacao?.welcome_message]);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(agent, contactContextBlock || undefined),
    [agent, contactContextBlock],
  );

  // Load list of existing contacts to allow simulating as a returning client
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("contacts")
        .select("id, full_name, phone, level")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (cancelled || !rows) return;
      setExistingContacts(
        rows.map((r: any) => ({
          id: r.id,
          full_name: r.full_name,
          phone: r.phone,
          level: r.level,
          contextLabel: `${r.full_name}${r.level ? ` · ${r.level}` : ""}`,
        })),
      );
    })();
    return () => { cancelled = true; };
  }, []);

  // initialize / reset on welcome change
  useEffect(() => {
    setMessages([{
      id: crypto.randomUUID(),
      role: "agent",
      text: welcomeMessage,
      ts: new Date(),
    }]);
    setFlow("nao_identificado");
    setSentiment("neutro");
    setData({});
    setNextAction("Aguardar mensagem");
    setRulesApplied([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const callAI = async (history: Msg[]) => {
    const apiMessages = history.map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    }));

    const { data: resp, error } = await supabase.functions.invoke("test-agent-chat", {
      body: {
        system_prompt: systemPrompt,
        messages: apiMessages,
        model: agent.model,
      },
    });

    if (error) throw error;
    if ((resp as any)?.error) throw new Error((resp as any).error);
    return (resp as any)?.content || "";
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: trimmed, ts: new Date() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setTyping(true);

    try {
      const raw = await callAI(newHistory);
      const { visible, debug } = parseAgentResponse(raw);

      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "agent", text: visible || "(sem resposta)", ts: new Date() },
      ]);

      if (debug) {
        setFlow(debug.detected_flow);
        setSentiment(debug.sentiment);
        setNextAction(debug.next_action || "—");
        if (debug.applied_rules.length) {
          setRulesApplied((r) => Array.from(new Set([...r, ...debug.applied_rules])));
        }
        setData((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(debug.collected_data || {})) {
            if (v && String(v).trim()) next[k] = String(v);
          }
          return next;
        });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao chamar o agente IA");
    } finally {
      setTyping(false);
    }
  };

  const handlePersonaChange = (v: string) => {
    setPersona(v);
    const p = PERSONAS.find((x) => x.value === v);
    // reset conversation
    setMessages([{
      id: crypto.randomUUID(),
      role: "agent",
      text: welcomeMessage,
      ts: new Date(),
    }]);
    setFlow("nao_identificado");
    setSentiment("neutro");
    setData({});
    setNextAction("Aguardar mensagem");
    setRulesApplied([]);

    if (p?.firstMsg) {
      // auto-send after a tick so UI shows welcome first
      setTimeout(() => sendMessage(p.firstMsg!), 400);
    }
  };

  const handleReset = () => {
    setMessages([{
      id: crypto.randomUUID(),
      role: "agent",
      text: welcomeMessage,
      ts: new Date(),
    }]);
    setFlow("nao_identificado");
    setSentiment("neutro");
    setData({});
    setNextAction("Aguardar mensagem");
    setRulesApplied([]);
  };

  const handleSelectExistingContact = async (contactId: string) => {
    setSelectedContactId(contactId);
    if (contactId === "none") {
      setContactContextBlock("");
      handleReset();
      return;
    }
    setLoadingContext(true);
    try {
      const contact = existingContacts.find((c) => c.id === contactId);
      if (!contact) return;

      // Load last conversations & quotes for the contact (mirrors webhook logic, lite version)
      const phone = contact.phone || "";
      let convos: any[] = [];
      if (phone) {
        const { data } = await supabase
          .from("wa_conversations")
          .select("status, summary, collected_data, last_message_at, last_message_text")
          .eq("phone", phone)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(5);
        convos = data || [];
      }
      const { data: quoteData } = await (supabase as any)
        .from("quotes")
        .select("title, destination, stage, conclusion_type, total_value, travel_date_start, travel_date_end")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(5);
      const quotes: any[] = quoteData || [];
      const merged: Record<string, any> = {};
      for (const c of [...convos].reverse()) {
        if (c?.collected_data && typeof c.collected_data === "object") Object.assign(merged, c.collected_data);
      }
      const lastAt = convos[0]?.last_message_at;
      const days = lastAt ? Math.max(0, Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000)) : null;

      const lines: string[] = [
        "## CONTEXTO DO CLIENTE",
        "Este é um contato CONHECIDO. Trate-o pelo nome e demonstre continuidade.",
        `- Nome: ${contact.full_name}`,
        `- Tipo: ${contact.level || "—"}`,
      ];
      if (days !== null) lines.push(`- Última interação: há ${days} dia(s)`);
      if (convos.length) {
        lines.push("", "### Conversas anteriores");
        for (const c of convos.slice(0, 3)) {
          const d = c.last_message_at ? new Date(c.last_message_at).toISOString().split("T")[0] : "—";
          const s = c.summary || c.last_message_text;
          lines.push(`- ${d} — status: ${c.status || "—"}${s ? ` — ${String(s).slice(0, 220)}` : ""}`);
        }
      }
      if (quotes.length) {
        lines.push("", "### Cotações");
        for (const q of quotes) {
          const v = q.total_value ? `BRL ${q.total_value}` : "";
          lines.push(`- ${q.destination || q.title || "—"} — ${q.conclusion_type || q.stage || "—"}${v ? ` — ${v}` : ""}`);
        }
      }
      if (Object.keys(merged).length) {
        lines.push("", "### Dados já coletados anteriormente");
        for (const [k, v] of Object.entries(merged)) {
          if (v == null || v === "") continue;
          lines.push(`- ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
        }
      }
      lines.push(
        "",
        "### INSTRUÇÕES IMPORTANTES",
        "- NÃO peça informações que você já tem",
        "- Mencione naturalmente que vocês já conversaram, se aplicável",
        "- Adapte o tom: cliente conhecido ≠ prospect novo",
      );
      setContactContextBlock(lines.join("\n"));

      // Reset chat with contextual welcome
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: welcomeMessage,
          ts: new Date(),
        },
      ]);
      setFlow("nao_identificado");
      setSentiment("neutro");
      setData(merged as Record<string, string>);
      setNextAction("Aguardar mensagem");
      setRulesApplied([]);
      toast.success(`Simulando como ${contact.full_name}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao carregar contexto do contato");
    } finally {
      setLoadingContext(false);
    }
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
            Simule uma conversa real com a IA usando a configuração salva.
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
          <div className="lg:col-span-3 flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-[#2A2D3A] shadow-sm bg-white dark:bg-[#0F1117]">
            {/* WhatsApp header */}
            <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                {useWAPhoto ? (
                  <img src={wa.photoUrl!} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Bot className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{agent.config?.comunicacao?.presentation_name || agent.name || "Agente IA"}</div>
                <div className="text-[11px] flex items-center gap-1.5 opacity-90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="dark:text-green-400">Online</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-white/90 dark:text-gray-300 hover:text-white inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-white/10"
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
                background: isDark ? "#0F1117" : "#ECE5DD",
                backgroundImage: isDark
                  ? "none"
                  : "radial-gradient(circle at 20% 10%, rgba(255,255,255,0.4) 0, transparent 40%)",
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
                        ? "bg-[#DCF8C6] dark:bg-[#2563EB] text-gray-900 dark:text-white rounded-tr-none"
                        : "bg-white dark:bg-[#1E2130] text-gray-900 dark:text-gray-200 rounded-tl-none"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words pr-10">{m.text}</div>
                    <div className={cn("text-[10px] absolute right-2 bottom-1 tabular-nums", m.role === "user" ? "text-gray-500 dark:text-white/60" : "text-gray-500")}>
                      {fmtTime(m.ts)}
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#1E2130] rounded-lg rounded-tl-none px-3 py-2.5 shadow-sm flex items-center gap-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-1">digitando</span>
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 bg-[#F0F0F0] dark:bg-[#161923] border-t border-gray-200 dark:border-[#2A2D3A] flex items-center gap-2">
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
                className="h-10 bg-white dark:bg-[#1E2130] border-gray-200 dark:border-[#2A2D3A] dark:text-gray-200 dark:placeholder:text-gray-500"
                disabled={typing}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={typing}
                className="h-10 w-10 shrink-0 bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* RIGHT: Debug */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-[#2A2D3A] bg-gray-50 dark:bg-[#161923] p-4 overflow-y-auto" style={{ maxHeight: 600 }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Debug em tempo real
            </h3>

            <div className="space-y-5 font-mono text-[12px]">
              {/* Fluxo */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-sans font-semibold mb-1.5">
                  Fluxo detectado
                </div>
                {(() => {
                  const F = FLOW_LABELS[flow];
                  const isUnknown = flow === "nao_identificado";
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "bg-white gap-1.5 pl-1",
                        isDark && (isUnknown
                          ? "dark:bg-[#2A2D3A] dark:text-gray-300 dark:border-[#3A3D4A]"
                          : "dark:bg-[#1E2130] dark:text-gray-200 dark:border-[#2A2D3A]")
                      )}
                    >
                      <span className={cn("inline-flex items-center justify-center h-5 w-5 rounded-full", F.bg)}>
                        <F.Icon className={cn("h-3.5 w-3.5", F.color)} />
                      </span>
                      {F.label}
                    </Badge>
                  );
                })()}
              </div>

              {/* Dados */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-sans font-semibold mb-1.5">
                  Dados coletados
                </div>
                <div className="bg-white dark:bg-[#1E2130] rounded-md border border-gray-200 dark:border-[#2A2D3A] divide-y divide-gray-100 dark:divide-[#2A2D3A]">
                  {dataFields.map((f) => {
                    const val = data[f.key];
                    return (
                      <div key={f.key} className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-gray-600 dark:text-gray-300 font-sans text-[12px]">{f.label}</span>
                        <span className={cn("flex items-center gap-1.5", val ? "text-[hsl(220_45%_15%)] dark:text-gray-100" : "text-gray-400 dark:text-gray-600")}>
                          {val ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-500" />
                              {val}
                            </>
                          ) : (
                            <Minus className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Próxima ação */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-sans font-semibold mb-1.5">
                  Próxima ação
                </div>
                <div className="bg-white dark:bg-[#1E2130] rounded-md border border-gray-200 dark:border-[#2A2D3A] px-3 py-2 text-[hsl(220_45%_15%)] dark:text-gray-200">
                  {nextAction}
                </div>
              </div>

              {/* Regras aplicadas */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-sans font-semibold mb-1.5">
                  Regras aplicadas
                </div>
                {rulesApplied.length === 0 ? (
                  <div className="text-gray-400 dark:text-gray-500">Nenhuma regra acionada</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {rulesApplied.map((r) => (
                      <Badge key={r} variant="outline" className="bg-white dark:bg-[#1E2130] dark:text-gray-200 dark:border-[#2A2D3A] text-[11px] font-sans gap-1">
                        <ShieldAlert className="h-3.5 w-3.5 text-gray-400" />
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Sentimento */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-sans font-semibold mb-1.5">
                  Sentimento do cliente
                </div>
                {(() => {
                  const S = SENT_LABELS[sentiment];
                  return (
                    <div className="bg-white dark:bg-[#1E2130] rounded-md border border-gray-200 dark:border-[#2A2D3A] px-3 py-2 flex items-center gap-2">
                      <span className={cn("inline-flex items-center justify-center h-6 w-6 rounded-full", S.bg)}>
                        <S.Icon className={cn("h-4 w-4", S.color)} />
                      </span>
                      <span className="text-[hsl(220_45%_15%)] dark:text-gray-300 font-sans">{S.label}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
