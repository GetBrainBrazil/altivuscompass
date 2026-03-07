interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

export function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <div className="glass-card rounded-xl p-3 sm:p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-2 sm:mb-4">
        <div className="p-2 sm:p-2.5 rounded-lg bg-muted">
          {icon}
        </div>
        {trend && (
          <span className={`text-[10px] sm:text-xs font-medium font-body px-2 py-1 rounded-full ${
            trend.positive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <p className="text-lg sm:text-2xl font-semibold font-display text-foreground">{value}</p>
      <p className="text-xs sm:text-sm text-muted-foreground font-body mt-1 line-clamp-2">{title}</p>
      {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground/70 font-body mt-0.5">{subtitle}</p>}
    </div>
  );
}
