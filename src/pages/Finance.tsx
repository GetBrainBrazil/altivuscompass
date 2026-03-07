import { MetricCard } from "@/components/MetricCard";

const transactions = [
  { description: "Paris Trip – Maria Silva", type: "Sale", amount: "R$ 24.500", date: "Mar 5", status: "Received" },
  { description: "Commission – Booking.com", type: "Commission", amount: "R$ 1.850", date: "Mar 4", status: "Pending" },
  { description: "Office Rent", type: "Expense", amount: "- R$ 3.200", date: "Mar 1", status: "Paid" },
  { description: "Maldives Trip – João Oliveira", type: "Sale", amount: "R$ 48.200", date: "Feb 28", status: "Received" },
  { description: "Google Ads", type: "Marketing", amount: "- R$ 2.500", date: "Feb 28", status: "Paid" },
];

export default function Finance() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground">Finance</h1>
        <p className="text-muted-foreground font-body mt-1">Revenue, expenses and financial overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Revenue (Mar)" value="R$ 142.5K" trend={{ value: "24%", positive: true }} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
        } />
        <MetricCard title="Expenses (Mar)" value="R$ 18.2K" trend={{ value: "5%", positive: false }} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M2 7l4 4 4-4 4 6 4-2 4 4" /><path d="M2 3h20" /></svg>
        } />
        <MetricCard title="Net Profit" value="R$ 124.3K" trend={{ value: "28%", positive: true }} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h6M9 15h6" /></svg>
        } />
        <MetricCard title="Commissions" value="R$ 8.4K" subtitle="From 5 bookings" icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z" /></svg>
        } />
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-5 border-b border-border/50">
          <h2 className="font-display text-lg font-semibold">Recent Transactions</h2>
        </div>
        <div className="divide-y divide-border/30">
          {transactions.map((t, i) => (
            <div key={i} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
              <div className="flex-1">
                <p className="text-sm font-medium font-body text-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground font-body">{t.type}</p>
              </div>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${
                t.status === "Received" ? "bg-success/10 text-success" : t.status === "Pending" ? "bg-gold/10 text-gold" : "bg-muted text-muted-foreground"
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
