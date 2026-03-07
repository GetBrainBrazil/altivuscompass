import { MetricCard } from "@/components/MetricCard";
import { Link } from "react-router-dom";

const recentQuotes = [
  { id: 1, client: "Maria Silva", destination: "Paris, France", status: "Negotiation", value: "R$ 24.500", date: "Mar 5" },
  { id: 2, client: "João Oliveira", destination: "Maldives", status: "Quote Sent", value: "R$ 48.200", date: "Mar 4" },
  { id: 3, client: "Ana Costa", destination: "New York, USA", status: "Confirmed", value: "R$ 15.800", date: "Mar 3" },
  { id: 4, client: "Roberto Santos", destination: "Tokyo, Japan", status: "New Quote", value: "R$ 32.100", date: "Mar 2" },
];

const statusColors: Record<string, string> = {
  "New Quote": "bg-soft-blue/10 text-soft-blue",
  "Quote Sent": "bg-gold/10 text-gold",
  "Negotiation": "bg-warning/10 text-warning",
  "Confirmed": "bg-success/10 text-success",
};

const upcomingTrips = [
  { client: "Lucia Mendes", destination: "Santorini", date: "Mar 15", passengers: 2 },
  { client: "Carlos Ferreira", destination: "Dubai", date: "Mar 22", passengers: 4 },
  { client: "Patricia Lima", destination: "London", date: "Apr 1", passengers: 1 },
];

export default function Dashboard() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Good morning</h1>
          <p className="text-muted-foreground font-body mt-1">Here's what's happening at Altivus today.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/quotes" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:opacity-90 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Quote
          </Link>
          <Link to="/clients" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium font-body text-foreground hover:bg-muted transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" />
            </svg>
            Add Client
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Quotes in Progress"
          value="12"
          subtitle="4 awaiting response"
          trend={{ value: "18%", positive: true }}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
              <path d="M14 2v6h6" />
            </svg>
          }
        />
        <MetricCard
          title="Sales This Month"
          value="R$ 142.5K"
          subtitle="8 trips confirmed"
          trend={{ value: "24%", positive: true }}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success">
              <path d="M2 17l4-4 4 4 4-6 4 2 4-4" />
              <path d="M2 21h20" />
            </svg>
          }
        />
        <MetricCard
          title="Active Clients"
          value="247"
          subtitle="12 new this month"
          trend={{ value: "8%", positive: true }}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 20c0-4 3.5-7 7-7s7 3 7 7" />
            </svg>
          }
        />
        <MetricCard
          title="Expiring Miles"
          value="3"
          subtitle="Next 30 days"
          trend={{ value: "Alert", positive: false }}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive">
              <path d="M22 2L2 8.5l7 3.5 3.5 7L22 2z" />
            </svg>
          }
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Quotes */}
        <div className="lg:col-span-2 glass-card rounded-xl">
          <div className="p-5 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent Quotes</h2>
            <Link to="/quotes" className="text-xs text-soft-blue hover:underline font-body">View all</Link>
          </div>
          <div className="divide-y divide-border/30">
            {recentQuotes.map((quote) => (
              <div key={quote.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground font-body truncate">{quote.client}</p>
                  <p className="text-xs text-muted-foreground font-body">{quote.destination}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${statusColors[quote.status] || 'bg-muted text-muted-foreground'}`}>
                  {quote.status}
                </span>
                <span className="text-sm font-medium text-foreground font-body w-24 text-right">{quote.value}</span>
                <span className="text-xs text-muted-foreground font-body w-12 text-right">{quote.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Trips */}
        <div className="glass-card rounded-xl">
          <div className="p-5 border-b border-border/50">
            <h2 className="font-display text-lg font-semibold">Upcoming Trips</h2>
          </div>
          <div className="p-4 space-y-3">
            {upcomingTrips.map((trip, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/40 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium font-body text-foreground">{trip.destination}</p>
                  <span className="text-xs text-muted-foreground font-body">{trip.date}</span>
                </div>
                <p className="text-xs text-muted-foreground font-body">{trip.client} · {trip.passengers} passenger{trip.passengers > 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
