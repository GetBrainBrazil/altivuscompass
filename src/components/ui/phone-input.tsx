import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Formats raw digits into the Brazilian mobile/landline mask.
 * - 11 digits → (XX) XXXXX-XXXX (mobile)
 * - 10 digits → (XX) XXXX-XXXX (landline)
 * - Partial inputs are formatted progressively.
 * - Strips any country prefix "55" if pasted with 12-13 digits.
 */
export function formatBrazilPhone(rawDigits: string): string {
  let d = (rawDigits || "").replace(/\D/g, "");
  // Drop leading "55" country code if user pasted full E.164-ish number.
  if (d.length > 11 && d.startsWith("55")) {
    d = d.slice(2);
  }
  // Cap at 11 digits (max BR mobile).
  d = d.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    // Landline: (XX) XXXX-XXXX
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  // Mobile: (XX) XXXXX-XXXX
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Returns only digits, dropping a leading "55" country prefix if present and length suggests so. */
export function stripBrazilPhone(value: string): string {
  let d = (value || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Raw digits (no mask) — what gets stored. Accepts already-masked values too (cleaned automatically). */
  value: string;
  /** Receives ONLY digits (no mask). */
  onChange: (digits: string) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className, placeholder, ...props }, ref) => {
    const display = formatBrazilPhone(value ?? "");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(stripBrazilPhone(e.target.value));
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text");
      onChange(stripBrazilPhone(pasted));
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={display}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder ?? "(11) 99999-9999"}
        className={cn(className)}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";
