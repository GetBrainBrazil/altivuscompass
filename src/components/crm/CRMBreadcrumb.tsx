import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type CRMBreadcrumbItem = {
  label: string;
  to?: string;
};

type Props = {
  items: CRMBreadcrumbItem[];
  className?: string;
  showBack?: boolean;
};

export function CRMBreadcrumb({ items, className, showBack = true }: Props) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showBack && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
      <nav aria-label="breadcrumb" className="text-sm text-slate-500 leading-7">
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
    </div>
  );
}
