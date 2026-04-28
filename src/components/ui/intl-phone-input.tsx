import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COUNTRY_CODES, applyPhoneMask, type CountryCode } from "@/lib/phone-masks";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * International phone input.
 * - Stores value in E.164-ish format: "+<dial><digits>" (no spaces/parens).
 * - Displays the masked national number; for Brazil always "(DD) 99999-9999".
 * - Shows a country picker with flag + dial code.
 */

const DEFAULT_COUNTRY = COUNTRY_CODES.find((c) => c.code === "BR")!;

function digitsOnly(s: string) {
  return (s || "").replace(/\D/g, "");
}

function parseStored(stored?: string | null): {
  country: CountryCode;
  national: string; // digits only, no dial
} {
  const raw = (stored || "").trim();
  if (!raw) return { country: DEFAULT_COUNTRY, national: "" };

  // Try to find best matching country by dial prefix.
  const all = digitsOnly(raw);
  // Prefer leading "+" – use whatever digits come after as full int'l number.
  const intl = raw.startsWith("+") ? all : all;

  // Match longest dial prefix first.
  const sorted = [...COUNTRY_CODES].sort(
    (a, b) => b.dial.length - a.dial.length
  );
  for (const c of sorted) {
    const d = c.dial.replace("+", "");
    if (intl.startsWith(d)) {
      return { country: c, national: intl.slice(d.length) };
    }
  }
  // Fallback: assume Brazil if 10–11 digits, otherwise treat as raw national.
  if (all.length <= 11) return { country: DEFAULT_COUNTRY, national: all };
  return { country: DEFAULT_COUNTRY, national: all };
}

export interface IntlPhoneInputProps {
  /** Stored value: "+<dial><digits>" (e.g. "+5511999998888"). */
  value?: string | null;
  /** Receives the new stored value in "+<dial><digits>" form (or "" if empty). */
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

export const IntlPhoneInput = React.forwardRef<
  HTMLInputElement,
  IntlPhoneInputProps
>(({ value, onChange, placeholder, className, disabled, id, name, onBlur }, ref) => {
  const parsed = React.useMemo(() => parseStored(value), [value]);
  const [country, setCountry] = React.useState<CountryCode>(parsed.country);
  const [national, setNational] = React.useState<string>(parsed.national);
  const [open, setOpen] = React.useState(false);

  // Keep in sync if external value changes.
  React.useEffect(() => {
    setCountry(parsed.country);
    setNational(parsed.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (c: CountryCode, nat: string) => {
    const digits = digitsOnly(nat);
    const dial = c.dial.replace("+", "");
    onChange?.(digits ? `+${dial}${digits}` : "");
  };

  const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = digitsOnly(e.target.value);
    // Cap to a sensible max per country mask length
    const maxDigits = (country.mask.match(/#/g) || []).length || 15;
    const capped = next.slice(0, maxDigits);
    setNational(capped);
    emit(country, capped);
  };

  const handleSelectCountry = (c: CountryCode) => {
    setCountry(c);
    setOpen(false);
    emit(c, national);
  };

  const display = applyPhoneMask(national, country.mask);

  return (
    <div
      className={cn(
        "flex h-10 w-full items-stretch rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1.5 px-2.5 border-r border-input bg-muted/30 hover:bg-muted text-sm font-medium shrink-0"
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-muted-foreground">{country.dial}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-72" align="start">
          <Command>
            <CommandInput placeholder="Buscar país ou DDI..." />
            <CommandList>
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {COUNTRY_CODES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.code} ${c.dial}`}
                    onSelect={() => handleSelectCountry(c)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1">{c.code}</span>
                    <span className="text-muted-foreground">{c.dial}</span>
                    {country.code === c.code && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        ref={ref}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={display}
        onChange={handleNationalChange}
        placeholder={placeholder ?? country.mask.replace(/#/g, "9")}
        className="h-full border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
});
IntlPhoneInput.displayName = "IntlPhoneInput";
