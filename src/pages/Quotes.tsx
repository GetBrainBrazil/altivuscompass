const stages = [
  { id: "new", label: "New Quote", color: "bg-soft-blue" },
  { id: "sent", label: "Quote Sent", color: "bg-gold" },
  { id: "negotiation", label: "Negotiation", color: "bg-warning" },
  { id: "confirmed", label: "Confirmed", color: "bg-success" },
  { id: "issued", label: "Ticket Issued", color: "bg-primary" },
  { id: "completed", label: "Completed", color: "bg-muted-foreground" },
];

const mockQuotes = [
  { id: 1, stage: "new", client: "Roberto Santos", destination: "Tokyo, Japan", value: "R$ 32.100", dates: "Apr 15 – Apr 28", passengers: 2 },
  { id: 2, stage: "new", client: "Patricia Lima", destination: "Bali, Indonesia", value: "R$ 18.400", dates: "May 3 – May 15", passengers: 1 },
  { id: 3, stage: "sent", client: "João Oliveira", destination: "Maldives", value: "R$ 48.200", dates: "Jun 1 – Jun 10", passengers: 2 },
  { id: 4, stage: "sent", client: "Fernanda Rocha", destination: "Swiss Alps", value: "R$ 35.600", dates: "Jul 10 – Jul 20", passengers: 3 },
  { id: 5, stage: "negotiation", client: "Maria Silva", destination: "Paris, France", value: "R$ 24.500", dates: "Apr 20 – Apr 30", passengers: 2 },
  { id: 6, stage: "confirmed", client: "Ana Costa", destination: "New York, USA", value: "R$ 15.800", dates: "Mar 25 – Apr 2", passengers: 1 },
  { id: 7, stage: "confirmed", client: "Lucia Mendes", destination: "Santorini, Greece", value: "R$ 28.900", dates: "Mar 15 – Mar 22", passengers: 2 },
  { id: 8, stage: "issued", client: "Carlos Ferreira", destination: "Dubai, UAE", value: "R$ 42.000", dates: "Mar 22 – Mar 30", passengers: 4 },
];

export default function Quotes() {
  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Quotes Pipeline</h1>
          <p className="text-muted-foreground font-body mt-1">{mockQuotes.length} active quotes</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:opacity-90 transition-opacity">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Quote
        </button>
      </div>

      {/* Pipeline */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageQuotes = mockQuotes.filter((q) => q.stage === stage.id);
          return (
            <div key={stage.id} className="min-w-[280px] flex-shrink-0">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-xs font-medium text-foreground font-body">{stage.label}</span>
                <span className="text-xs text-muted-foreground font-body ml-auto">{stageQuotes.length}</span>
              </div>
              <div className="space-y-3">
                {stageQuotes.map((quote) => (
                  <div key={quote.id} className="glass-card rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow animate-fade-in">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium font-body text-foreground">{quote.destination}</p>
                      <span className="text-xs font-semibold text-foreground font-body">{quote.value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body mb-3">{quote.client}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-body">
                      <span>{quote.dates}</span>
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="8" r="3" />
                          <path d="M7 18c0-2.8 2.2-5 5-5s5 2.2 5 5" />
                        </svg>
                        {quote.passengers}
                      </span>
                    </div>
                  </div>
                ))}
                {stageQuotes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
                    <p className="text-xs text-muted-foreground font-body">No quotes</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
