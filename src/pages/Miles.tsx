const milesData = [
  { client: "Maria Silva", airline: "LATAM", program: "LATAM Pass", balance: "85.400", expires: "15 Abr 2026", status: "expiring" },
  { client: "João Oliveira", airline: "GOL", program: "Smiles", balance: "142.000", expires: "31 Dez 2026", status: "ok" },
  { client: "João Oliveira", airline: "TAP", program: "Miles&Go", balance: "23.500", expires: "20 Mar 2026", status: "expiring" },
  { client: "Roberto Santos", airline: "American Airlines", program: "AAdvantage", balance: "67.800", expires: "30 Nov 2026", status: "ok" },
  { client: "Ana Costa", airline: "Azul", program: "TudoAzul", balance: "31.200", expires: "1 Mai 2026", status: "ok" },
  { client: "Carlos Ferreira", airline: "Emirates", program: "Skywards", balance: "198.500", expires: "15 Set 2026", status: "ok" },
  { client: "Lucia Mendes", airline: "LATAM", program: "LATAM Pass", balance: "12.300", expires: "25 Mar 2026", status: "expiring" },
];

export default function Miles() {
  const expiring = milesData.filter((m) => m.status === "expiring");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground">Gestão de Milhas</h1>
        <p className="text-muted-foreground font-body mt-1">Acompanhe programas de fidelidade e saldos.</p>
      </div>

      {expiring.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive mt-0.5 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-medium font-body text-foreground">{expiring.length} programas com milhas expirando</p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">Revise e tome ação antes que as milhas expirem.</p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Cliente</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Companhia</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Programa</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Saldo</th>
              <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Expira</th>
              <th className="text-center p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {milesData.map((m, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="p-4 text-sm font-medium font-body text-foreground">{m.client}</td>
                <td className="p-4 text-sm font-body text-foreground">{m.airline}</td>
                <td className="p-4 text-sm font-body text-muted-foreground">{m.program}</td>
                <td className="p-4 text-sm font-medium font-body text-foreground text-right">{m.balance}</td>
                <td className="p-4 text-sm font-body text-muted-foreground text-right">{m.expires}</td>
                <td className="p-4 text-center">
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${
                    m.status === "expiring" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                  }`}>
                    {m.status === "expiring" ? "Expirando" : "Ativo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
