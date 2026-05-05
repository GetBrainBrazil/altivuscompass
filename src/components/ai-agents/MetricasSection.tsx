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

function formatDuration(min: number): { text: string; muted: boolean } {
  if (min <= 0) return { text: "< 1 min", muted: true };
  if (min < 60) return { text: `${min} min`, muted: false };
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { text: m ? `${h}h ${m}min` : `${h}h`, muted: false };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_ICON: Record<ConvStatus, typeof CheckCircle> = {
  resolvido_ia: CheckCircle,
  transferido_humano: ArrowRight,
  abandonado: XCircle,
  em_andamento: Clock,
};

export function MetricasSection() {
  const [period, setPeriod] = useState<Period>("30d");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [openConvId, setOpenConvId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(() => {
    const v = Number(localStorage.getItem("metricas:page"));
    return v > 0 ? v : 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const v = Number(localStorage.getItem("metricas:pageSize"));
    return [10, 25, 50].includes(v) ? v : 10;
  });
  const [pageLoading, setPageLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem("metricas:page", String(page)); }, [page]);
  useEffect(() => { localStorage.setItem("metricas:pageSize", String(pageSize)); }, [pageSize]);

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

    const recentRows = current.slice(0, 100);
    const ids = recentRows.map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: msgs } = await supabase
        .from("wa_messages")
        .select("conversation_id")
        .in("conversation_id", ids);
      for (const m of (msgs || []) as { conversation_id: string }[]) {
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      }
    }

    const recent = recentRows.map((c) => ({
      id: c.id,
      date: c.created_at,
      contact: c.contact_name || c.phone,
      phone: c.phone,
      flow: inferFlow(c.last_message_text),
      status: inferStatus(c),
      durationMin: durationMin(c),
      messageCount: counts[c.id] || 0,
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

        <div ref={tableRef}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Últimas conversas
          </h3>
          {(() => {
            const all = metrics?.recent ?? [];
            const total = all.length;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));
            const safePage = Math.min(page, pageCount);
            const start = (safePage - 1) * pageSize;
            const rows = all.slice(start, start + pageSize);
            const isEmpty = !loading && total === 0;

            const goTo = (p: number) => {
              setPageLoading(true);
              setPage(p);
              tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              setTimeout(() => setPageLoading(false), 200);
            };

            const buildPages = (): (number | "…")[] => {
              if (pageCount <= 5) return Array.from({ length: pageCount }, (_, i) => i + 1);
              const arr: (number | "…")[] = [1];
              const startP = Math.max(2, safePage - 1);
              const endP = Math.min(pageCount - 1, safePage + 1);
              if (startP > 2) arr.push("…");
              for (let i = startP; i <= endP; i++) arr.push(i);
              if (endP < pageCount - 1) arr.push("…");
              arr.push(pageCount);
              return arr;
            };

            return (
              <>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {isEmpty ? (
                    <div className="flex flex-col items-center justify-center text-center py-[60px] px-4">
                      <MessageSquare className="h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-base text-gray-400">Nenhuma conversa registrada ainda</p>
                      <p className="text-[13px] text-gray-400 mt-1">As conversas aparecerão aqui quando o agente começar a atender.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="border-b border-gray-200">
                          {["Data","Contato","Fluxo","Status","Duração","Mensagens"].map((h) => (
                            <th key={h} className="text-left text-[11px] font-semibold uppercase text-gray-500 px-4 py-3" style={{ letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={pageLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                        {loading ? (
                          <tr><td colSpan={6} className="text-center text-sm text-gray-500 py-10">Carregando…</td></tr>
                        ) : (
                          rows.map((r) => {
                            const d = new Date(r.date);
                            const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                            const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                            const dur = formatDuration(r.durationMin);
                            const StatusIcon = STATUS_ICON[r.status];
                            const hasName = r.contact && r.contact !== r.phone;
                            return (
                              <tr
                                key={r.id}
                                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors duration-150"
                                onClick={() => setOpenConvId(r.id)}
                              >
                                <td className="px-4 py-[14px] tabular-nums">
                                  <div className="text-[14px] text-gray-700">{dateStr}</div>
                                  <div className="text-[12px] text-gray-400">{timeStr}</div>
                                </td>
                                <td className="px-4 py-[14px]">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center shrink-0">
                                      {initials(r.contact)}
                                    </div>
                                    <div className="min-w-0">
                                      {hasName ? (
                                        <>
                                          <div className="text-[14px] font-semibold text-gray-800 truncate">{r.contact}</div>
                                          <div className="text-[12px] text-gray-400 truncate">{r.phone}</div>
                                        </>
                                      ) : (
                                        <div className="text-[14px] text-gray-800 truncate">{r.phone}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-[14px]">
                                  <span className={`inline-flex items-center text-[12px] font-medium px-2.5 py-0.5 rounded-full border ${FLOW_BADGE[r.flow]}`}>
                                    {FLOW_LABEL[r.flow]}
                                  </span>
                                </td>
                                <td className="px-4 py-[14px]">
                                  <span className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[r.status]}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {STATUS_LABEL[r.status]}
                                  </span>
                                </td>
                                <td className={`px-4 py-[14px] tabular-nums ${dur.muted ? "text-gray-400" : "text-gray-700"}`}>{dur.text}</td>
                                <td className="px-4 py-[14px]">
                                  <span className="inline-flex items-center gap-1 text-[12px] text-gray-500 tabular-nums">
                                    <MessageSquare className="h-3 w-3" />
                                    {r.messageCount}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {!isEmpty && !loading && (
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-[13px] text-gray-500">
                      Mostrando {start + 1}-{Math.min(start + pageSize, total)} de {total} conversas
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="h-8 text-[12px] border border-gray-200 rounded-md px-2 bg-white text-gray-600"
                      >
                        {[10, 25, 50].map((s) => <option key={s} value={s}>{s} por página</option>)}
                      </select>
                      <button
                        onClick={() => safePage > 1 && goTo(safePage - 1)}
                        disabled={safePage === 1}
                        className={`text-[13px] px-2 h-8 rounded-md ${safePage === 1 ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"}`}
                      >
                        Anterior
                      </button>
                      {buildPages().map((p, i) =>
                        p === "…" ? (
                          <span key={`e${i}`} className="text-[13px] text-gray-400 px-1">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => goTo(p)}
                            className={`h-8 w-8 text-[13px] rounded-md tabular-nums ${
                              p === safePage
                                ? "bg-[#1B2A4A] text-white"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                      <button
                        onClick={() => safePage < pageCount && goTo(safePage + 1)}
                        disabled={safePage === pageCount}
                        className={`text-[13px] px-2 h-8 rounded-md ${safePage === pageCount ? "text-gray-300 cursor-not-allowed" : "text-gray-600 hover:bg-gray-100"}`}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
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
