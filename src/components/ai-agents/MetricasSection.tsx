import { MessageSquare, CheckCircle, Clock, UserPlus } from "lucide-react";

const STATS = [
  { id: "conv", label: "Total de conversas", value: "0", subtitle: "últimos 30 dias", Icon: MessageSquare },
  { id: "res", label: "Resolução sem humano", value: "0%", subtitle: "conversas resolvidas pela IA", Icon: CheckCircle },
  { id: "time", label: "Tempo médio de atendimento", value: "0 min", subtitle: "por conversa", Icon: Clock },
  { id: "leads", label: "Leads gerados", value: "0", subtitle: "criados automaticamente", Icon: UserPlus },
];

const FLOWS = [
  { label: "Nova Cotação", count: 0, color: "bg-emerald-500" },
  { label: "Suporte", count: 0, color: "bg-red-500" },
  { label: "Prospect Indeciso", count: 0, color: "bg-amber-500" },
  { label: "Não identificado", count: 0, color: "bg-gray-400" },
];

export function MetricasSection() {
  const max = Math.max(1, ...FLOWS.map((f) => f.count));

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Métricas
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Acompanhe o desempenho do agente nos últimos 30 dias.
        </p>
      </div>

      <div className="p-8 space-y-8">
        {/* Row 1: Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map(({ id, label, value, subtitle, Icon }) => (
            <div key={id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-gray-600">{label}</p>
                <Icon className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            </div>
          ))}
        </div>

        {/* Row 2: Breakdown by flow */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Conversas por fluxo
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {FLOWS.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-40 text-sm text-foreground shrink-0">{f.label}</div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${f.color} rounded-full transition-all`}
                    style={{ width: `${(f.count / max) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right text-sm tabular-nums text-gray-600">
                  {f.count} {f.count === 1 ? "conversa" : "conversas"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Últimas conversas */}
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
                <tr>
                  <td colSpan={5} className="text-center text-sm text-gray-500 py-10">
                    Nenhuma conversa registrada ainda.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
