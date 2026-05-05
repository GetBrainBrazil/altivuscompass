import type { SectionKey } from "@/lib/ai-agent-types";

const Bar = ({ className = "" }: { className?: string }) => (
  <div className={`skeleton-shimmer ${className}`} />
);

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
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
      {/* Avatar block */}
      <div className="flex items-start gap-5">
        <div className="skeleton-shimmer h-16 w-16 !rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <Bar className="h-3" style={{ width: 120 }} />
          <Bar className="h-10" style={{ width: 200 }} />
          <Bar className="h-3" style={{ width: 140 }} />
        </div>
      </div>
      {/* Name + model */}
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
      {/* Descrição */}
      <div className="space-y-2">
        <Bar className="h-3 w-32" />
        <Bar className="h-11 w-full" />
      </div>
      {/* Status card */}
      <Bar className="h-16 w-full !rounded-lg" />
    </SectionShell>
  );
}

function GenericSkeleton({ rows = 4 }: { rows?: number }) {
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
          <Bar key={i} className="h-24 w-full !rounded-lg" />
        ))}
      </div>
      <Bar className="h-64 w-full !rounded-lg" />
    </SectionShell>
  );
}

function TestarSkeleton() {
  return (
    <SectionShell>
      <Bar className="h-[420px] w-full !rounded-lg" />
    </SectionShell>
  );
}

// Style helper since className with !rounded-full needs to override .skeleton-shimmer's 6px
// Tailwind's "!" forces important.

const Bar2 = Bar; // unused alias to silence Bar style prop typing if any
void Bar2;

// Re-typed Bar with style support
function _typesProbe() {
  return <Bar className="" />;
}
void _typesProbe;

export function SectionSkeleton({ section }: { section: SectionKey }) {
  switch (section) {
    case "identidade":
      return <IdentidadeSkeleton />;
    case "metricas":
      return <MetricasSkeleton />;
    case "testar":
      return <TestarSkeleton />;
    case "fluxos":
    case "comunicacao":
    case "coleta":
    case "regras":
    case "integracoes":
      return <GenericSkeleton rows={5} />;
    default:
      return <GenericSkeleton />;
  }
}
