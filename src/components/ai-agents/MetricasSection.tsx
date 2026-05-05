import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MessageSquare, CheckCircle, Clock, UserPlus, ArrowUp, ArrowDown, X, ArrowRight, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Period = "7d" | "30d" | "90d";
type Flow = "nova_cotacao" | "suporte" | "prospect_indeciso" | "nao_identificado";
type ConvStatus = "em_andamento" | "resolvido_ia" | "transferido_humano" | "abandonado";

interface ConvRow {
  id: string;
  phone: string;
  contact_name: string | null;
  status: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_from: string | null;
  lead_id: string | null;
}

interface Msg {
  id: string;
  direction: string;
  sender: string;
  content: string | null;
  message_type: string | null;
  created_at: string;
}

interface Metrics {
  total: number;
  totalPrev: number;
  resolvedPct: number;
  avgMinutes: number;
  leads: number;
  flows: Record<Flow, number>;
  recent: Array<{
    id: string;
    date: string;
    contact: string;
    phone: string;
    flow: Flow;
    status: ConvStatus;
    durationMin: number;
    messageCount: number;
  }>;
}

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };
const PERIOD_LABEL: Record<Period, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

const FLOW_LABEL: Record<Flow, string> = {
  nova_cotacao: "Nova Cotação",
  suporte: "Suporte",
  prospect_indeciso: "Prospect Indeciso",
  nao_identificado: "Não identificado",
};
const FLOW_COLOR: Record<Flow, string> = {
  nova_cotacao: "bg-emerald-500",
  suporte: "bg-red-500",
  prospect_indeciso: "bg-amber-500",
  nao_identificado: "bg-gray-400",
};
const FLOW_BADGE: Record<Flow, string> = {
  nova_cotacao: "bg-emerald-50 text-emerald-700 border-emerald-200",
  suporte: "bg-red-50 text-red-700 border-red-200",
  prospect_indeciso: "bg-amber-50 text-amber-700 border-amber-200",
  nao_identificado: "bg-gray-50 text-gray-600 border-gray-200",
};
const STATUS_LABEL: Record<ConvStatus, string> = {
  em_andamento: "Em andamento",
  resolvido_ia: "Resolvido",
  transferido_humano: "Transferido",
  abandonado: "Abandonado",
};
const STATUS_BADGE: Record<ConvStatus, string> = {
  em_andamento: "bg-amber-50 text-amber-700 border-amber-200",
  resolvido_ia: "bg-emerald-50 text-emerald-700 border-emerald-200",
  transferido_humano: "bg-blue-50 text-blue-700 border-blue-200",
  abandonado: "bg-gray-100 text-gray-600 border-gray-200",
};

function inferFlow(text: string | null): Flow {
  const t = (text || "").toLowerCase();
  if (!t) return "nao_identificado";
  if (/(cota[çc][ãa]o|or[çc]amento|viagem|pacote|roteiro|preç|valor|reserva)/.test(t)) return "nova_cotacao";
  if (/(problema|reclama|cancel|cancelar|suporte|ajuda|erro|n[ãa]o consigo)/.test(t)) return "suporte";
  if (/(pensando|talvez|n[ãa]o sei|d[úu]vida|quem sabe|depois)/.test(t)) return "prospect_indeciso";
  return "nao_identificado";
}

function inferStatus(c: ConvRow): ConvStatus {
  if (c.status === "human") return "transferido_humano";
  const last = c.last_message_at ? new Date(c.last_message_at).getTime() : new Date(c.created_at).getTime();
  const ageMin = (Date.now() - last) / 60000;
  if (ageMin < 30) return "em_andamento";
  if (c.last_message_from === "agent") return "resolvido_ia";
  return "abandonado";
}

function durationMin(c: ConvRow): number {
  const start = new Date(c.created_at).getTime();
  const end = c.last_message_at ? new Date(c.last_message_at).getTime() : start;
  return Math.max(0, Math.round((end - start) / 60000));
}

function formatRelative(d: Date): string {
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  return `há ${h}h`;
}

export function MetricasSection() {
  const [period, setPeriod] = useState<Period>("30d");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [openConvId, setOpenConvId] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    const days = PERIOD_DAYS[period];
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const sincePrev = new Date(Date.now() - 2 * days * 86400000).toISOString();

    const { data: rows, error } = await supabase
      .from("wa_conversations")
      .select("id, phone, contact_name, status, created_at, last_message_at, last_message_text, last_message_from, lead_id")
      .gte("created_at", sincePrev)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("metrics fetch error", error);
      setLoading(false);
      return;
    }

    const all = (rows || []) as ConvRow[];
    const current = all.filter((r) => r.created_at >= since);
    const previous = all.filter((r) => r.created_at < since);

    const flows: Record<Flow, number> = {
      nova_cotacao: 0, suporte: 0, prospect_indeciso: 0, nao_identificado: 0,
    };
    let resolvedCount = 0;
    let endedCount = 0;
    let totalDuration = 0;
    let leads = 0;

    for (const c of current) {
      const f = inferFlow(c.last_message_text);
      flows[f]++;
      const s = inferStatus(c);
      if (s !== "em_andamento") {
        endedCount++;
        totalDuration += durationMin(c);
        if (s === "resolvido_ia") resolvedCount++;
      }
      if (c.lead_id) leads++;
    }

    const recent = current.slice(0, 20).map((c) => ({
      id: c.id,
      date: c.created_at,
      contact: c.contact_name || c.phone,
      flow: inferFlow(c.last_message_text),
      status: inferStatus(c),
      durationMin: durationMin(c),
    }));

    setMetrics({
      total: current.length,
      totalPrev: previous.length,
      resolvedPct: endedCount ? Math.round((resolvedCount / endedCount) * 100) : 0,
      avgMinutes: endedCount ? Math.round(totalDuration / endedCount) : 0,
      leads,
      flows,
      recent,
    });
    setUpdatedAt(new Date());
    setLoading(false);
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchMetrics();
    const id = setInterval(fetchMetrics, 60000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  // ticker for "Atualizado há X min"
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const trend = useMemo(() => {
    if (!metrics || metrics.totalPrev === 0) return null;
    const pct = Math.round(((metrics.total - metrics.totalPrev) / metrics.totalPrev) * 100);
    return pct;
  }, [metrics]);

  const totalFlows = metrics ? Object.values(metrics.flows).reduce((a, b) => a + b, 0) : 0;
  const maxFlow = metrics ? Math.max(1, ...Object.values(metrics.flows)) : 1;

  const stats = [
    {
      id: "conv",
      label: "Total de conversas",
      value: loading ? "…" : String(metrics?.total ?? 0),
      subtitle: PERIOD_LABEL[period].toLowerCase(),
      Icon: MessageSquare,
      trend,
    },
    {
      id: "res",
      label: "Resolução sem humano",
      value: loading ? "…" : `${metrics?.resolvedPct ?? 0}%`,
      subtitle: "conversas resolvidas pela IA",
      Icon: CheckCircle,
    },
    {
      id: "time",
      label: "Tempo médio de atendimento",
      value: loading ? "…" : `${metrics?.avgMinutes ?? 0} min`,
      subtitle: "por conversa",
      Icon: Clock,
    },
    {
      id: "leads",
      label: "Leads gerados",
      value: loading ? "…" : String(metrics?.leads ?? 0),
      subtitle: "criados automaticamente",
      Icon: UserPlus,
    },
  ];

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Métricas</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Acompanhe o desempenho do agente em {PERIOD_LABEL[period].toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                period === p ? "bg-white text-foreground shadow-sm font-medium" : "text-gray-500 hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ id, label, value, subtitle, Icon, trend: t }) => (
            <div key={id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-gray-600">{label}</p>
                <Icon className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
                {id === "conv" && t !== null && t !== undefined && (
                  <span
                    className={`inline-flex items-center text-xs font-medium ${
                      t >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(t)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Conversas por fluxo
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {(Object.keys(FLOW_LABEL) as Flow[]).map((f) => {
              const count = metrics?.flows[f] ?? 0;
              const pct = totalFlows ? Math.round((count / totalFlows) * 100) : 0;
              return (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-foreground shrink-0">{FLOW_LABEL[f]}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${FLOW_COLOR[f]} rounded-full transition-all`}
                      style={{ width: `${(count / maxFlow) * 100}%` }}
                    />
                  </div>
                  <div className="w-36 text-right text-sm tabular-nums text-gray-600">
                    {count} {count === 1 ? "conversa" : "conversas"} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Últimas conversas
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-2.5">Data</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-2.5">Contato</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-2.5">Fluxo</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-2.5">Status</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-2.5">Duração</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center text-sm text-gray-500 py-10">Carregando…</td></tr>
                ) : !metrics?.recent.length ? (
                  <tr><td colSpan={5} className="text-center text-sm text-gray-500 py-10">Nenhuma conversa registrada ainda.</td></tr>
                ) : (
                  metrics.recent.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setOpenConvId(r.id)}
                    >
                      <td className="px-4 py-3 text-gray-700 tabular-nums">
                        {new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-foreground">{r.contact}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded border ${FLOW_BADGE[r.flow]}`}>
                          {FLOW_LABEL[r.flow]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded border ${STATUS_BADGE[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 tabular-nums">{r.durationMin} min</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {updatedAt && (
          <p className="text-[11px] text-gray-400 text-right">Atualizado {formatRelative(updatedAt)}</p>
        )}
      </div>

      <ConversationDrawer
        conversationId={openConvId}
        onClose={() => setOpenConvId(null)}
        meta={metrics?.recent.find((r) => r.id === openConvId) || null}
      />
    </section>
  );
}

function ConversationDrawer({
  conversationId,
  onClose,
  meta,
}: {
  conversationId: string | null;
  onClose: () => void;
  meta: Metrics["recent"][number] | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    supabase
      .from("wa_messages")
      .select("id, direction, sender, content, message_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages((data || []) as Msg[]);
        setLoading(false);
      });
  }, [conversationId]);

  return (
    <Sheet open={!!conversationId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[500px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-2">
            <span className="truncate">{meta?.contact || "Conversa"}</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
          {meta && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded border ${FLOW_BADGE[meta.flow]}`}>
                {FLOW_LABEL[meta.flow]}
              </span>
              <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded border ${STATUS_BADGE[meta.status]}`}>
                {STATUS_LABEL[meta.status]}
              </span>
              <span className="text-[11px] text-gray-500">{meta.durationMin} min</span>
            </div>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {loading ? (
            <p className="text-center text-sm text-gray-500 py-10">Carregando…</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-10">Sem mensagens.</p>
          ) : (
            messages.map((m) => {
              const isCustomer = m.direction === "in" || m.sender === "lead";
              const isHuman = m.sender === "agent" && false; // human takeover detection N/A here
              const align = isCustomer ? "items-end" : "items-start";
              const bubble = isCustomer
                ? "bg-emerald-100 text-foreground"
                : isHuman
                ? "bg-blue-100 text-foreground"
                : "bg-white border border-gray-200 text-foreground";
              return (
                <div key={m.id} className={`flex flex-col ${align}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${bubble}`}>
                    {m.content || (m.message_type ? `[${m.message_type}]` : "")}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(m.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
