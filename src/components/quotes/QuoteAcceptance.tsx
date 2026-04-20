import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneInput } from "@/components/ui/phone-input";
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  title?: string | null;
  description?: string | null;
  unit_price?: number | null;
  quantity?: number | null;
  option_group?: string | null;
  option_label?: string | null;
  option_order?: number | null;
  is_recommended?: boolean | null;
  is_selected?: boolean | null;
};

interface QuoteAcceptanceProps {
  quoteId: string;
  stage: string;
  quoteValidity: string | null;
  termsConditions: string | null;
  items: Item[];
}

const formatCurrency = (v: number | null | undefined) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const formatCpf = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function QuoteAcceptance({
  quoteId,
  stage,
  quoteValidity,
  termsConditions,
  items,
}: QuoteAcceptanceProps) {
  // 1. Compute states
  const today = new Date().toISOString().slice(0, 10);
  const isExpired = !!(quoteValidity && quoteValidity < today);
  const isAccepted = stage === "confirmed" || stage === "completed";

  // Group items by option_group (only groups with 2+ items require choice)
  const optionGroups = useMemo(() => {
    const groups: Record<string, Item[]> = {};
    for (const it of items) {
      const g = (it.option_group ?? "").trim();
      if (!g) continue;
      if (!groups[g]) groups[g] = [];
      groups[g].push(it);
    }
    return Object.entries(groups)
      .filter(([, arr]) => arr.length > 1)
      .map(([name, arr]) => ({
        name,
        items: arr.sort(
          (a, b) => (a.option_order ?? 0) - (b.option_order ?? 0),
        ),
      }));
  }, [items]);

  // Default selections: recommended item, or first item of each group
  const initialSelections = useMemo(() => {
    const sel: Record<string, string> = {};
    for (const g of optionGroups) {
      const recommended = g.items.find((i) => i.is_recommended);
      sel[g.name] = (recommended ?? g.items[0]).id;
    }
    return sel;
  }, [optionGroups]);

  const [selections, setSelections] = useState<Record<string, string>>(
    initialSelections,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const cpfDigits = cpf.replace(/\D/g, "");
  const phoneDigits = phone.replace(/\D/g, "");
  const emailValid = EMAIL_RE.test(email.trim());
  const allOptionsChosen = optionGroups.every((g) => !!selections[g.name]);

  const canSubmit =
    !submitting &&
    name.trim().length >= 3 &&
    emailValid &&
    phoneDigits.length >= 10 &&
    cpfDigits.length === 11 &&
    accepted &&
    allOptionsChosen;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const selected_item_ids = Object.values(selections);

      const res = await fetch(`${supabaseUrl}/functions/v1/accept-quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          quote_id: quoteId,
          accepter_name: name.trim(),
          accepter_email: email.trim(),
          accepter_phone: phoneDigits,
          accepter_cpf: cpfDigits,
          terms_accepted: true,
          selected_item_ids,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.error || "Erro ao aceitar a proposta");
      }
      setDone(true);
      toast.success("Proposta aceita com sucesso!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  // ===== Render: success state =====
  if (done) {
    return (
      <section className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-sm rounded-xl p-6 sm:p-8 print:hidden">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 font-display">
              Proposta aceita com sucesso!
            </h2>
            <p className="text-sm text-gray-600 font-body">
              O consultor foi avisado e vai entrar em contato em breve.
            </p>
          </div>
          <div className="text-left bg-white/70 rounded-lg p-4 space-y-2 border border-green-100">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide font-body">
              Próximos passos
            </p>
            <ul className="text-sm text-gray-700 font-body space-y-1.5">
              <li className="flex gap-2">
                <span className="text-green-600">1.</span>
                <span>Em breve o consultor vai mandar mensagem no WhatsApp</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">2.</span>
                <span>Ele(a) vai enviar o contrato para assinatura</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">3.</span>
                <span>E o link de pagamento</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600">4.</span>
                <span>Após o pagamento, começa a emissão dos bilhetes</span>
              </li>
            </ul>
          </div>
          <p className="text-xs text-gray-500 font-body pt-2">
            Dúvidas? Entre em contato direto pelo WhatsApp.
          </p>
        </div>
      </section>
    );
  }

  // ===== Render: expired =====
  if (isExpired) {
    const formattedDate = quoteValidity
      ? new Date(quoteValidity + "T00:00:00").toLocaleDateString("pt-BR")
      : "";
    return (
      <section className="bg-red-50 border border-red-200 rounded-xl p-5 sm:p-6 print:hidden">
        <div className="flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-red-900 font-body">
              Esta proposta expirou
            </h2>
            <p className="text-sm text-red-800 font-body">
              A validade era até <strong>{formattedDate}</strong>. Por favor,
              entre em contato com seu consultor para receber uma nova proposta
              atualizada.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ===== Render: already accepted =====
  if (isAccepted) {
    return (
      <section className="bg-green-50 border border-green-200 rounded-xl p-5 sm:p-6 print:hidden">
        <div className="flex gap-3 items-start">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-green-900 font-body">
              Esta proposta já foi aceita
            </h2>
            <p className="text-sm text-green-800 font-body">
              Seu consultor está cuidando dos próximos passos. Em caso de
              dúvidas, entre em contato pelo WhatsApp.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ===== Render: active form =====
  return (
    <section className="bg-white border-2 border-primary/30 shadow-md rounded-xl p-5 sm:p-7 print:hidden">
      <div className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 font-display">
              Aceitar proposta
            </h2>
          </div>
          <p className="text-sm text-gray-500 font-body">
            Preencha seus dados para confirmar e iniciar o processo de
            contratação.
          </p>
        </div>

        {/* Option groups */}
        {optionGroups.length > 0 && (
          <div className="space-y-4">
            {optionGroups.map((group) => (
              <div key={group.name} className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900 font-body">
                  Escolha uma opção · {group.name}
                </Label>
                <RadioGroup
                  value={selections[group.name]}
                  onValueChange={(v) =>
                    setSelections((s) => ({ ...s, [group.name]: v }))
                  }
                  className="space-y-2"
                >
                  {group.items.map((item) => {
                    const total =
                      (item.unit_price ?? 0) * (item.quantity ?? 1);
                    const isRec = !!item.is_recommended;
                    const isChecked = selections[group.name] === item.id;
                    return (
                      <label
                        key={item.id}
                        htmlFor={`opt-${item.id}`}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          isChecked
                            ? "border-primary bg-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <RadioGroupItem
                          value={item.id}
                          id={`opt-${item.id}`}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 font-body">
                              {item.option_label || item.title || "Opção"}
                            </span>
                            {isRec && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                Recomendado
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-gray-500 font-body line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-gray-900 font-body">
                            {formatCurrency(total)}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="acc-name" className="text-xs font-body">
              Nome completo *
            </Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acc-email" className="text-xs font-body">
              E-mail *
            </Label>
            <Input
              id="acc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              maxLength={254}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="acc-phone" className="text-xs font-body">
              Telefone / WhatsApp *
            </Label>
            <PhoneInput
              id="acc-phone"
              value={phone}
              onChange={setPhone}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="acc-cpf" className="text-xs font-body">
              CPF *
            </Label>
            <Input
              id="acc-cpf"
              value={formatCpf(cpf)}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-2">
          <Checkbox
            id="acc-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="acc-terms"
            className="text-sm text-gray-700 font-body cursor-pointer leading-relaxed"
          >
            Li e concordo com os termos e condições desta proposta
            {termsConditions && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTerms(true);
                  }}
                  className="text-primary underline hover:no-underline font-medium"
                >
                  Ver termos
                </button>
              </>
            )}
          </Label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="lg"
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            "Aceitar proposta"
          )}
        </Button>
      </div>

      {/* Terms dialog */}
      {termsConditions && (
        <Dialog open={showTerms} onOpenChange={setShowTerms}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Termos e condições</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-gray-700 font-body whitespace-pre-line leading-relaxed">
              {termsConditions}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
