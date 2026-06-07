import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check as CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IntlPhoneInput } from "@/components/ui/intl-phone-input";
import { COUNTRY_CODES } from "@/lib/phone-masks";
import { isValidEmail } from "@/lib/validators";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "referral", label: "Indicação" },
  { value: "event", label: "Evento" },
  { value: "social", label: "Redes Sociais" },
  { value: "in_person", label: "Presencial" },
  { value: "other", label: "Outro" },
];

const NOTES_MAX = 500;

const initialForm = {
  full_name: "",
  phone: "", // stored as "+<dial><digits>"
  email: "",
  source: "whatsapp",
  destination: "",
  travel_period: "",
  travelers_count: "",
  notes: "",
};

function phoneDigitsForDial(stored: string): { dial: string; digits: string } {
  const raw = (stored || "").replace(/\D/g, "");
  const sorted = [...COUNTRY_CODES].sort(
    (a, b) => b.dial.length - a.dial.length,
  );
  for (const c of sorted) {
    const d = c.dial.replace("+", "");
    if (raw.startsWith(d)) return { dial: c.dial, digits: raw.slice(d.length) };
  }
  return { dial: "+55", digits: raw };
}

function validatePhone(stored: string): string | null {
  const { dial, digits } = phoneDigitsForDial(stored);
  if (!digits) return "Telefone é obrigatório.";
  if (dial === "+55") {
    if (digits.length !== 10 && digits.length !== 11)
      return "Número de telefone inválido";
  } else {
    if (digits.length < 6 || digits.length > 15)
      return "Número de telefone inválido";
  }
  return null;
}

export default function LeadNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [emailDebounced, setEmailDebounced] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof typeof initialForm>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Debounce email
  useEffect(() => {
    const t = setTimeout(() => setEmailDebounced(form.email), 500);
    return () => clearTimeout(t);
  }, [form.email]);

  const nameError = useMemo(() => {
    const n = form.full_name.trim();
    if (!n) return "Nome é obrigatório.";
    if (n.length < 2) return "Mínimo de 2 caracteres.";
    return null;
  }, [form.full_name]);

  const phoneError = useMemo(() => validatePhone(form.phone), [form.phone]);

  const emailLiveError = useMemo(() => {
    if (!emailDebounced.trim()) return null;
    return isValidEmail(emailDebounced) ? null : "E-mail inválido";
  }, [emailDebounced]);

  const emailSubmitError = useMemo(() => {
    if (!form.email.trim()) return null;
    return isValidEmail(form.email) ? null : "E-mail inválido";
  }, [form.email]);

  const showEmailValid =
    !!form.email.trim() && !emailLiveError && isValidEmail(form.email);

  const willBeLead =
    !!form.destination.trim() &&
    !!form.travel_period.trim() &&
    !!form.travelers_count.trim();

  const handleSubmit = async () => {
    setTouched({ full_name: true, phone: true, email: true });

    if (nameError) {
      nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nameRef.current?.focus();
      toast.error(nameError);
      return;
    }
    if (phoneError) {
      phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(phoneError);
      return;
    }
    if (emailSubmitError) {
      emailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      emailRef.current?.focus();
      toast.error(emailSubmitError);
      return;
    }

    setSaving(true);
    try {
      let travel_date_start: string | null = null;
      let flexible_dates = false;
      let flexible_dates_description: string | null = null;
      const period = form.travel_period.trim();
      if (period) {
        const isoMatch = period.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
        const brMatch = period.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (isoMatch) {
          travel_date_start = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3] ?? "01"}`;
        } else if (brMatch) {
          travel_date_start = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
        } else {
          flexible_dates = true;
          flexible_dates_description = period;
        }
      }
      const travelersNum = form.travelers_count
        ? parseInt(form.travelers_count, 10)
        : null;

      const payload: any = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        source: form.source,
        status: "new",
        destination: form.destination.trim() || null,
        travel_date_start,
        flexible_dates,
        flexible_dates_description,
        travelers_count:
          travelersNum && !Number.isNaN(travelersNum) ? travelersNum : null,
        preferences: form.notes.trim() || null,
      };

      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;

      toast.success(
        willBeLead
          ? "Lead criado e adicionado ao funil."
          : "Prospect criado em Novos Leads.",
      );
      navigate("/crm/sales?tab=sales");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar lead.");
    } finally {
      setSaving(false);
    }
  };

  const showNameError = touched.full_name && nameError;
  const showPhoneError = touched.phone && phoneError;
  const showEmailError = emailLiveError; // live, regardless of touched

  return (
    <div className="min-h-[calc(100vh-0px)] bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/crm/sales?tab=sales")}
            aria-label="Voltar ao CRM"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Novo lead
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Preencha os dados básicos. Se incluir destino, período e número de
              viajantes, o contato é criado já como Lead. Caso contrário, fica
              como Prospect em "Novos Leads".
            </p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="px-8 py-6">
        <div className="w-full space-y-5 [&_input]:h-8 [&_input]:text-xs [&_input]:py-1.5 [&_button[role=combobox]]:h-8 [&_button[role=combobox]]:text-xs [&_textarea]:text-xs [&_label]:text-[11px] [&_label]:font-normal [&_label]:text-slate-500 [&_label]:normal-case">
          {/* Identificação */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
                Identificação
              </h2>
              <div className="flex-1 h-px bg-border" />
              <span
                className={
                  willBeLead
                    ? "shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success"
                    : "shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                }
              >
                {willBeLead ? "Será criado como Lead" : "Será criado como Prospect"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lead-name">Nome completo *</Label>
                <Input
                  id="lead-name"
                  ref={nameRef}
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, full_name: true }))}
                  placeholder="Ex: Ana Souza"
                  autoFocus
                  className={cn(
                    "transition-colors duration-150",
                    showNameError && "border-red-500 focus-visible:ring-red-500",
                  )}
                />
                {showNameError && (
                  <p className="text-[12px] text-red-500 mt-1">{nameError}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-phone">Telefone *</Label>
                <div ref={phoneRef}>
                  <IntlPhoneInput
                    id="lead-phone"
                    value={form.phone}
                    onChange={(v) => setField("phone", v)}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    className={cn(
                      "h-8 transition-colors duration-150",
                      showPhoneError &&
                        "border-red-500 focus-within:ring-red-500",
                    )}
                  />
                </div>
                {showPhoneError && (
                  <p className="text-[12px] text-red-500 mt-1">{phoneError}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-email">E-mail</Label>
                <div className="relative">
                  <Input
                    id="lead-email"
                    ref={emailRef}
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    placeholder="opcional"
                    className={cn(
                      "transition-colors duration-150 pr-8",
                      showEmailError &&
                        "border-red-500 focus-visible:ring-red-500",
                    )}
                  />
                  {showEmailValid && (
                    <CheckIcon
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 pointer-events-none"
                      aria-label="E-mail válido"
                    />
                  )}
                </div>
                {showEmailError && (
                  <p className="text-[12px] text-red-500 mt-1">
                    {emailLiveError}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-source">Origem do lead</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setField("source", v)}
                >
                  <SelectTrigger id="lead-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Interesse */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
                Interesse
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="lead-destination">Destino</Label>
                <Input
                  id="lead-destination"
                  value={form.destination}
                  onChange={(e) => setField("destination", e.target.value)}
                  placeholder="Ex: Paris"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-period">Período pretendido</Label>
                <Input
                  id="lead-period"
                  value={form.travel_period}
                  onChange={(e) => setField("travel_period", e.target.value)}
                  placeholder="Ex: 2025-07 ou Jul/2025 (flexível)"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lead-travelers">Número de viajantes</Label>
                <Input
                  id="lead-travelers"
                  type="number"
                  min={1}
                  value={form.travelers_count}
                  onChange={(e) => setField("travelers_count", e.target.value)}
                  placeholder="Ex: 2"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="lead-notes">Observações</Label>
                <div className="relative">
                  <Textarea
                    id="lead-notes"
                    value={form.notes}
                    maxLength={NOTES_MAX}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder="Preferências, restrições, contexto..."
                    style={{ resize: "vertical" }}
                    className="min-h-[120px] py-2 pr-2 pb-6"
                  />
                  <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] text-gray-400">
                    {form.notes.length} / {NOTES_MAX}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Footer actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/crm/sales?tab=sales")}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? "Criando..." : "Criar lead"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
