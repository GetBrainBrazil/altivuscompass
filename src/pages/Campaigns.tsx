export default function Campaigns() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Campanhas</h1>
          <p className="text-muted-foreground font-body mt-1">Gerencie ofertas de viagem e campanhas de marketing.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:opacity-90 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: "NYC Promoções de Primavera", status: "Ativa", channel: "WhatsApp", recipients: 42, opens: 38, date: "1 Mar" },
          { name: "Maldivas Premium", status: "Rascunho", channel: "E-mail", recipients: 0, opens: 0, date: "5 Mar" },
          { name: "Europa Verão 2026", status: "Concluída", channel: "E-mail + WhatsApp", recipients: 128, opens: 95, date: "15 Fev" },
        ].map((c, i) => (
          <div key={i} className="glass-card rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow animate-fade-in">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold font-body text-foreground">{c.name}</h3>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${
                c.status === "Ativa" ? "bg-success/10 text-success" : c.status === "Rascunho" ? "bg-muted text-muted-foreground" : "bg-soft-blue/10 text-soft-blue"
              }`}>
                {c.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-body mb-3">{c.channel}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-body">
              <span>{c.recipients} destinatários</span>
              <span>{c.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
