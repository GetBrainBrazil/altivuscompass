import { Skeleton } from "@/components/ui/skeleton";

/** Kanban-style loading: N columns, each with a few card skeletons. */
export function KanbanSkeleton({ columns = 4, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-4">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="w-full sm:min-w-[280px] sm:flex-shrink-0">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-6 ml-auto" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: cardsPerColumn }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-3 sm:p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16 ml-2" />
                </div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Table-style loading: a header row + N body rows of skeletons. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/40 p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4 w-full max-w-[160px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple stacked list of card skeletons (mobile-first). */
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="border rounded-lg p-3 bg-card space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
