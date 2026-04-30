import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarIcon, Minus, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 pt-2">
    <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">
      {children}
    </span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export default function LeadNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("whatsapp");

  const [destination, setDestination] = useState("");
  const [dateStart, setDateStart] = useState<Date | undefined>();
  const [dateEnd, setDateEnd] = useState<Date | undefined>();
  const [flexibleDates, setFlexibleDates] = useState(false);
  const currentYear = new Date().getFullYear();
  const [flexMonth, setFlexMonth] = useState<string>("");
  const [flexYear, setFlexYear] = useState<string>(String(currentYear));
  const [travelers, setTravelers] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const hasPeriod = flexibleDates ? !!flexMonth : !!dateStart;
  const willBeLead =
    !!destination.trim() && hasPeriod && travelers > 0;

  const incTravelers = () => setTravelers((n) => Math.min(99, n + 1));
  const decTravelers = () => setTravelers((n) => Math.max(0, n - 1));

  const handleSubmit = async () => {
    const name = fullName.trim();
    const ph = phone.trim();
    if (!name) return toast.error("Informe o nome completo.");
    if (!ph) return toast.error("Telefone é obrigatório.");

    setSaving(true);
    try {
      let travel_date_start: string | null = null;
      let travel_date_end: string | null = null;
      let flexible_dates = false;
      let flexible_dates_description: string | null = null;

      if (flexibleDates) {
        if (flexMonth && flexYear) {
          const m = String(parseInt(flexMonth, 10) + 1).padStart(2, "0");
          travel_date_start = `${flexYear}-${m}-01`;
          flexible_dates = true;
          flexible_dates_description = `${MONTHS[parseInt(flexMonth, 10)]}/${flexYear}`;
        }
      } else {
        if (dateStart) travel_date_start = format(dateStart, "yyyy-MM-dd");
        if (dateEnd) travel_date_end = format(dateEnd, "yyyy-MM-dd");
      }

      const payload: any = {
        full_name: name,
        phone: ph,
        email: email.trim() || null,
        source,
        status: "new",
        destination: destination.trim() || null,
        travel_date_start,
        travel_date_end,
        flexible_dates,
        flexible_dates_description,
        travelers_count: travelers > 0 ? travelers : null,
        preferences: notes.trim() || null,
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

  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-background sticky top-0 z-10">
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
              Preencha os dados básicos do contato.
            </p>
          </div>

          {/* Dynamic status badge */}
          <div
            className={cn(
              "shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ease-out",
              willBeLead
                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full mr-2 transition-colors duration-300",
                willBeLead ? "bg-blue-500" : "bg-slate-400",
              )}
            />
            {willBeLead ? "Será criado como Lead" : "Será criado como Prospect"}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="px-6 py-8">
        <div className="mx-auto w-full max-w-[700px]">
          <div className="rounded-xl border border-border bg-background p-6 sm:p-8 space-y-6">
            <SectionLabel>Informações do contato</SectionLabel>

            <div className="space-y-1.5">
              <Label htmlFor="lead-name">Nome completo *</Label>
              <Input
                id="lead-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Ana Souza"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Telefone *</Label>
                <Input
                  id="lead-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="opcional"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Origem do lead</Label>
              <Select value={source} onValueChange={setSource}>
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

            <SectionLabel>Interesse</SectionLabel>

            <div className="space-y-1.5">
              <Label htmlFor="lead-destination">Destino</Label>
              <Input
                id="lead-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Ex: Paris"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="m-0">Período pretendido</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Datas flexíveis
                  </span>
                  <Switch
                    checked={flexibleDates}
                    onCheckedChange={setFlexibleDates}
                  />
                </div>
              </div>

              {!flexibleDates ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateStart && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateStart
                          ? format(dateStart, "dd/MM/yyyy", { locale: ptBR })
                          : "Data início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateStart}
                        onSelect={setDateStart}
                        initialFocus
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateEnd && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateEnd
                          ? format(dateEnd, "dd/MM/yyyy", { locale: ptBR })
                          : "Data fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateEnd}
                        onSelect={setDateEnd}
                        initialFocus
                        locale={ptBR}
                        disabled={(d) => (dateStart ? d < dateStart : false)}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Select value={flexMonth} onValueChange={setFlexMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={flexYear} onValueChange={setFlexYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Número de viajantes</Label>
              <div className="inline-flex items-center rounded-md border border-input bg-background">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={decTravelers}
                  disabled={travelers <= 0}
                  className="h-10 w-10 rounded-r-none"
                  aria-label="Diminuir"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="w-14 text-center text-sm font-medium tabular-nums select-none">
                  {travelers}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={incTravelers}
                  className="h-10 w-10 rounded-l-none"
                  aria-label="Aumentar"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Observações</Label>
              <Textarea
                id="lead-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preferências, restrições, contexto..."
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="ghost"
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
