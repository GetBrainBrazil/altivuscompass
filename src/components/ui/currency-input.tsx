import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | string | null | undefined;
  onChange?: (value: number | null) => void;
  /** Símbolo a exibir como prefixo (ex.: R$). Vazio remove o prefixo. */
  prefix?: string;
  /** Casas decimais (default 2) */
  decimals?: number;
}

const nf = (decimals: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function formatFromDigits(digits: string, decimals: number) {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return "";
  const padded = clean.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const decPart = padded.slice(padded.length - decimals);
  const intNum = Number(intPart);
  const formattedInt = new Intl.NumberFormat("pt-BR").format(intNum);
  return decimals > 0 ? `${formattedInt},${decPart}` : formattedInt;
}

function numberToDisplay(value: number | string | null | undefined, decimals: number) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "";
  return nf(decimals).format(n);
}

function displayToNumber(display: string, decimals: number): number | null {
  const digits = display.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits) / Math.pow(10, decimals);
  return Number.isFinite(n) ? n : null;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, prefix = "R$", decimals = 2, className, placeholder, ...rest }, ref) => {
    const [text, setText] = useState<string>(() => numberToDisplay(value, decimals));

    useEffect(() => {
      // Mantém sincronizado quando o valor externo muda (sem digitação local em curso)
      const current = displayToNumber(text, decimals);
      const incoming = value === null || value === undefined || value === "" ? null : Number(value);
      if ((incoming ?? null) !== (current ?? null)) {
        setText(numberToDisplay(value, decimals));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, decimals]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "");
      const formatted = formatFromDigits(digits, decimals);
      setText(formatted);
      onChange?.(displayToNumber(formatted, decimals));
    };

    return (
      <div className="relative w-full">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          inputMode="decimal"
          value={text}
          onChange={handleChange}
          placeholder={placeholder ?? (decimals > 0 ? "0,00" : "0")}
          className={cn(prefix ? "pl-9" : "", "text-right tabular-nums", className)}
          {...rest}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
