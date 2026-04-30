import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

const initialForm = {
  full_name: "",
  phone: "",
  email: "",
  source: "whatsapp",
  destination: "",
  travel_period: "",
  travelers_count: "",
  notes: "",
};

export default function LeadNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof typeof initialForm>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const willBeLead =
    !!form.destination.trim() &&
    !!form.travel_period.trim() &&
    !!form.travelers_count.trim();

  const handleSubmit = async () => {
    const name = form.full_name.trim();
    const phone = form.phone.trim();
    if (!name) {
      toast.error("Informe o nome completo.");
      return;
    }
    if (!phone) {
      toast.error("Telefone é obrigatório.");
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
        full_name: name,
        phone,
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
      navigate("/crm?tab=sales");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-0px)] bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/crm?tab=sales")}
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
      <main className="px-6 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {/* Identificação */}
          <section className="rounded-xl border border-border bg-background p-5 sm:p-6 space-y-4">
            <header className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Identificação
              </h2>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Obrigatório
              </span>
            </header>

            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Nome completo *</Label>
              <Input
                id="lead-name"
                value={form.full_name}
                onChange={(e) => setField("full_name", e.target.value)}
                placeholder="Ex: Ana Souza"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Telefone *</Label>
                <Input
                  id="lead-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="opcional"
                />
              </div>
            </div>

            <div className="space-y-1.5">
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
          </section>

          {/* Interesse */}
          <section className="rounded-xl border border-border bg-background p-5 sm:p-6 space-y-4">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Interesse
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opcional. Preenchendo destino, período e número de viajantes,
                  o contato é promovido automaticamente a Lead.
                </p>
              </div>
              <span
                className={
                  willBeLead
                    ? "shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success"
                    : "shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                }
              >
                {willBeLead ? "Será criado como Lead" : "Será criado como Prospect"}
              </span>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-destination">Destino</Label>
                <Input
                  id="lead-destination"
                  value={form.destination}
                  onChange={(e) => setField("destination", e.target.value)}
                  placeholder="Ex: Paris"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-period">Período pretendido</Label>
                <Input
                  id="lead-period"
                  value={form.travel_period}
                  onChange={(e) => setField("travel_period", e.target.value)}
                  placeholder="Ex: 2025-07 ou Jul/2025 (flexível)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Observações</Label>
              <Textarea
                id="lead-notes"
                rows={4}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Preferências, restrições, contexto..."
              />
            </div>
          </section>

          {/* Footer actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/crm?tab=sales")}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Criando..." : "Criar lead"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
