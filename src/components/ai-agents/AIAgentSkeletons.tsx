type SectionKey =
  | "identidade"
  | "fluxos"
  | "comunicacao"
  | "coleta"
  | "regras"
  | "integracoes"
  | "metricas"
  | "testar"
  | "whatsapp";

const Bar = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`skeleton-shimmer ${className}`} style={style} />
);

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden animate-fade-in">
      <div className="px-8 py-5 border-b border-border/60 space-y-2">
        <Bar className="h-3 w-32" />
        <Bar className="h-2.5 w-64" />
      </div>
      <div className="p-8 space-y-6">{children}</div>
    </section>
  );
}

function IdentidadeSkeleton() {
  return (
    <SectionShell>
      <div className="flex items-start gap-5">
        <div className="skeleton-shimmer h-16 w-16 shrink-0" style={{ borderRadius: "9999px" }} />
        <div className="flex-1 space-y-3">
          <Bar className="h-3" style={{ width: 120 }} />
          <Bar className="h-10" style={{ width: 200 }} />
          <Bar className="h-3" style={{ width: 140 }} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Bar className="h-3 w-24" />
          <Bar className="h-11 w-full" />
        </div>
        <div className="space-y-2">
          <Bar className="h-3 w-24" />
          <Bar className="h-11 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Bar className="h-3 w-32" />
        <Bar className="h-11 w-full" />
      </div>
      <Bar className="h-16 w-full" style={{ borderRadius: 8 }} />
    </SectionShell>
  );
}

function GenericSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <SectionShell>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Bar className="h-3 w-32" />
          <Bar className="h-10 w-full" />
        </div>
      ))}
    </SectionShell>
  );
}

function MetricasSkeleton() {
  return (
    <SectionShell>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-24 w-full" style={{ borderRadius: 8 }} />
        ))}
      </div>
      <Bar className="h-64 w-full" style={{ borderRadius: 8 }} />
    </SectionShell>
  );
}

function TestarSkeleton() {
  return (
    <SectionShell>
      <Bar className="h-[420px] w-full" style={{ borderRadius: 8 }} />
    </SectionShell>
  );
}

export function SectionSkeleton({ section }: { section: SectionKey }) {
  switch (section) {
    case "identidade":
      return <IdentidadeSkeleton />;
    case "metricas":
      return <MetricasSkeleton />;
    case "testar":
      return <TestarSkeleton />;
    default:
      return <GenericSkeleton rows={5} />;
  }
}
