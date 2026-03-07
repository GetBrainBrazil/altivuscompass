import { useState } from "react";

const travelProfiles: Record<string, { label: string; color: string }> = {
  economic: { label: "Econômico", color: "bg-soft-blue/10 text-soft-blue" },
  opportunity: { label: "Oportunidade", color: "bg-gold/10 text-gold" },
  sophisticated: { label: "Sofisticado", color: "bg-primary/10 text-primary" },
};

const mockClients = [
  { id: 1, name: "Maria Silva", email: "maria@email.com", phone: "+55 21 99999-0001", city: "Rio de Janeiro", state: "RJ", profile: "sophisticated", airports: ["GIG", "SDU"], passportStatus: "Válido", milesPrograms: 2 },
  { id: 2, name: "João Oliveira", email: "joao@email.com", phone: "+55 11 99999-0002", city: "São Paulo", state: "SP", profile: "opportunity", airports: ["GRU", "VCP"], passportStatus: "Válido", milesPrograms: 3 },
  { id: 3, name: "Ana Costa", email: "ana@email.com", phone: "+55 21 99999-0003", city: "Rio de Janeiro", state: "RJ", profile: "economic", airports: ["GIG"], passportStatus: "Vencido", milesPrograms: 1 },
  { id: 4, name: "Roberto Santos", email: "roberto@email.com", phone: "+55 11 99999-0004", city: "São Paulo", state: "SP", profile: "sophisticated", airports: ["GRU"], passportStatus: "Válido", milesPrograms: 4 },
  { id: 5, name: "Lucia Mendes", email: "lucia@email.com", phone: "+55 31 99999-0005", city: "Belo Horizonte", state: "MG", profile: "opportunity", airports: ["CNF"], passportStatus: "Válido", milesPrograms: 1 },
  { id: 6, name: "Carlos Ferreira", email: "carlos@email.com", phone: "+55 41 99999-0006", city: "Curitiba", state: "PR", profile: "sophisticated", airports: ["CWB"], passportStatus: "Válido", milesPrograms: 2 },
];

export default function Clients() {
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState<string>("all");

  const filtered = mockClients.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase());
    const matchesProfile = profileFilter === "all" || c.profile === profileFilter;
    return matchesSearch && matchesProfile;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Clientes</h1>
          <p className="text-muted-foreground font-body mt-1">{mockClients.length} clientes cadastrados</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:opacity-90 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Cliente
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          {["all", "economic", "opportunity", "sophisticated"].map((p) => (
            <button
              key={p}
              onClick={() => setProfileFilter(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-body transition-colors ${
                profileFilter === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "Todos" : travelProfiles[p].label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Cliente</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Localização</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Perfil</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Aeroportos</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Passaporte</th>
              <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Milhas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((client) => (
              <tr key={client.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="p-4">
                  <div>
                    <p className="text-sm font-medium font-body text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground font-body">{client.email}</p>
                  </div>
                </td>
                <td className="p-4">
                  <p className="text-sm font-body text-foreground">{client.city}</p>
                  <p className="text-xs text-muted-foreground font-body">{client.state}</p>
                </td>
                <td className="p-4">
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${travelProfiles[client.profile].color}`}>
                    {travelProfiles[client.profile].label}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-1">
                    {client.airports.map((a) => (
                      <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground font-body">
                        {a}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`text-xs font-body ${client.passportStatus === 'Válido' ? 'text-success' : 'text-destructive'}`}>
                    {client.passportStatus}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-sm font-body text-foreground">{client.milesPrograms} programa{client.milesPrograms > 1 ? 's' : ''}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
