import { MetricCard } from "@/components/MetricCard";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const stageLabels: Record<string, { label: string; color: string }> = {
  new: { label: "Nova Cotação", color: "bg-soft-blue/10 text-soft-blue" },
  sent: { label: "Cotação Enviada", color: "bg-gold/10 text-gold" },
  negotiation: { label: "Negociação", color: "bg-warning/10 text-warning" },
  confirmed: { label: "Confirmada", color: "bg-success/10 text-success" },
  issued: { label: "Bilhete Emitido", color: "bg-primary/10 text-primary" },
  completed: { label: "Concluída", color: "bg-muted text-muted-foreground" },
  post_sale: { label: "Pós-Venda", color: "bg-soft-blue/10 text-soft-blue" },
};

export default function Dashboard() {
  const { user } = useAuth();

  const { data: quotes = [] } = useQuery({
    queryKey: ["dashboard-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientCount = 0 } = useQuery({
    queryKey: ["dashboard-client-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("clients").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: activeQuotesCount = 0 } = useQuery({
    queryKey: ["dashboard-active-quotes"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .in("stage", ["new", "sent", "negotiation", "confirmed"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: expiringMiles = 0 } = useQuery({
    queryKey: ["dashboard-expiring-miles"],
    queryFn: async () => {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("miles_programs")
        .select("*", { count: "exact", head: true })
        .gte("expiration_date", today)
        .lte("expiration_date", thirtyDays);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: totalSales = 0 } = useQuery({
    queryKey: ["dashboard-total-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("total_value")
        .in("stage", ["confirmed", "issued", "completed"]);
      if (error) throw error;
      return (data ?? []).reduce((s, q) => s + (q.total_value ?? 0), 0);
    },
  });

  const formatCurrency = (v: number) => {
    if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}K`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">{greeting()}</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Veja o que está acontecendo na Altivus hoje.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link to="/quotes" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium font-body hover:opacity-90 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Nova Cotação
          </Link>
          <Link to="/clients" className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-border text-xs sm:text-sm font-medium font-body text-foreground hover:bg-muted transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" /></svg>
            Novo Cliente
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Cotações em Andamento" value={String(activeQuotesCount)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6" /></svg>
        } />
        <MetricCard title="Vendas Confirmadas" value={formatCurrency(totalSales)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
        } />
        <MetricCard title="Clientes Ativos" value={String(clientCount)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" /></svg>
        } />
        <MetricCard title="Milhas Expirando" value={String(expiringMiles)} trend={expiringMiles > 0 ? { value: "Alerta", positive: false } : undefined} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M22 2L2 8.5l7 3.5 3.5 7L22 2z" /></svg>
        } />
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 sm:p-5 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-display text-base sm:text-lg font-semibold">Cotações Recentes</h2>
          <Link to="/quotes" className="text-xs text-soft-blue hover:underline font-body">Ver todas</Link>
        </div>
        {quotes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body text-sm">Nenhuma cotação ainda. Crie a primeira!</div>
        ) : (
          <div className="divide-y divide-border/30">
            {quotes.map((quote: any) => {
              const stage = stageLabels[quote.stage] ?? stageLabels.new;
              return (
                <div key={quote.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground font-body truncate">{quote.clients?.full_name ?? "Sem cliente"}</p>
                    <p className="text-xs text-muted-foreground font-body">{quote.destination ?? "Sem destino"}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${stage.color}`}>{stage.label}</span>
                    <span className="text-sm font-medium text-foreground font-body sm:w-24 text-right">
                      {quote.total_value ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(quote.total_value) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
