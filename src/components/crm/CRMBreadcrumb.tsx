import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export type CRMBreadcrumbItem = {
  label: string;
  to?: string;
};

type Props = {
  items: CRMBreadcrumbItem[];
  className?: string;
};

export function CRMBreadcrumb({ items, className }: Props) {
  const navigate = useNavigate();

  return (
    <nav aria-label="breadcrumb" className={cn("text-sm text-slate-500", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {isLast || !item.to ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    isLast ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-500",
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(item.to!)}
                  className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  {item.label}
                </button>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-slate-400">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
