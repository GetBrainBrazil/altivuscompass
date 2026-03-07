import { MetricCard } from "@/components/MetricCard";

const transactions = [
  { description: "Viagem Paris – Maria Silva", type: "Venda", amount: "R$ 24.500", date: "5 Mar", status: "Recebido" },
  { description: "Comissão – Booking.com", type: "Comissão", amount: "R$ 1.850", date: "4 Mar", status: "Pendente" },
  { description: "Aluguel do Escritório", type: "Despesa", amount: "- R$ 3.200", date: "1 Mar", status: "Pago" },
  { description: "Viagem Maldivas – João Oliveira", type: "Venda", amount: "R$ 48.200", date: "28 Fev", status: "Recebido" },
  { description: "Google Ads", type: "Marketing", amount: "- R$ 2.500", date: "28 Fev", status: "Pago" },
];

export default function Finance() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground font-body mt-1">Receita, despesas e visão financeira geral.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Receita (Mar)" value="R$ 142,5K" trend={{ value: "24%", positive: true }} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
        } />
        <MetricCard title="Despesas (Mar)" value="R$ 18,2K" trend={{ value: "5%", positive: false }} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M2 7l4 4 4-4 4 6 4-2 4 4" /><path d="M2 3h20" /></svg>
        } />
        <MetricCard title="Lucro Líquido" value="R$ 124,3K" trend={{ value: "28%", positive: true }} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h6M9 15h6" /></svg>
        } />
        <MetricCard title="Comissões" value="R$ 8,4K" subtitle="De 5 reservas" icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z" /></svg>
        } />
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-5 border-b border-border/50">
          <h2 className="font-display text-lg font-semibold">Transações Recentes</h2>
        </div>
        <div className="divide-y divide-border/30">
          {transactions.map((t, i) => (
            <div key={i} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-medium font-body text-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground font-body">{t.type}</p>
              </div>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${
                t.status === "Recebido" ? "bg-success/10 text-success" : t.status === "Pendente" ? "bg-gold/10 text-gold" : "bg-muted text-muted-foreground"
              }`}>{t.status}</span>
              <span className={`text-sm font-medium font-body w-28 text-right ${t.amount.startsWith('-') ? 'text-destructive' : 'text-foreground'}`}>{t.amount}</span>
              <span className="text-xs text-muted-foreground font-body w-16 text-right">{t.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
