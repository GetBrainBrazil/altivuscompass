import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COMPANY_LABEL, type CompanyBrand } from "@/lib/company";

/**
 * Discreet badge marking which company a record belongs to.
 * By design, only renders for non-default brands (Milhas e Voos) to avoid noise.
 * Pass `alwaysShow` to render the badge for any brand (e.g. inside filters).
 */
export function CompanyBadge({
  company,
  className,
  alwaysShow = false,
}: {
  company: CompanyBrand | string | null | undefined;
  className?: string;
  alwaysShow?: boolean;
}) {
  if (!company) return null;
  if (!alwaysShow && company === "altivus") return null;
  const label = COMPANY_LABEL[company as CompanyBrand] ?? String(company);
  const isMV = company === "milhas_e_voos";
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] font-medium px-1.5 py-0 h-5 whitespace-nowrap",
        isMV
          ? "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30"
          : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
