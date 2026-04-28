import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Check,
  MapPin,
  Calendar as CalendarIcon,
  MessageCircle,
  ExternalLink,
  CircleDot,
  FileText,
  UserCheck,
  Clock,
  FileBox,
  StickyNote,
  Flame,
  Snowflake,
  Sun,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { KanbanCardData } from "@/components/crm/KanbanCard";
import { IntlPhoneInput } from "@/components/ui/intl-phone-input";
import { supabase } from "@/integrations/supabase/client";
import { LeadTimeline } from "@/components/crm/LeadTimeline";

const FUNNEL_STAGES = [
  { id: "new-leads", title: "Novos Leads" },
  { id: "qualifying", title: "Em Qualificação" },
  { id: "quote", title: "Cotação" },
  { id: "proposal-sent", title: "Proposta Enviada" },
  { id: "closed", title: "Fechado" },
];

const TRIP_PROFILES = [
  { value: "economico", label: "Econômico" },
  { value: "conforto", label: "Conforto" },
  { value: "premium", label: "Premium" },
];

const TEMPERATURES = [
  { value: "hot", label: "Quente", icon: Flame, activeClass: "bg-rose-500/15 text-rose-600 border-rose-500/40" },
  { value: "warm", label: "Morno", icon: Sun, activeClass: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  { value: "cold", label: "Frio", icon: Snowflake, activeClass: "bg-sky-500/15 text-sky-600 border-sky-500/40" },
] as const;

const SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "manual", label: "Manual" },
  { value: "outro", label: "Outro" },
];

function readCard(id: string): KanbanCardData | null {
  try {
    const raw = sessionStorage.getItem(`crm:lead:${id}`);
    if (raw) return JSON.parse(raw) as KanbanCardData;
  } catch {
    /* ignore */
  }
  return null;
}

type ContactLevel = "prospect" | "lead" | "cliente";

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stageId = params.get("stage") ?? "new-leads";
  const [card, setCard] = useState<KanbanCardData | null>(() =>
    id ? readCard(id) : null
  );

  const leadId = id?.startsWith("lead-") ? id.slice("lead-".length) : null;

  type FormState = {
    full_name: string;
    phone: string;
    email: string;
    source: string;
    destination: string;
    travel_date_label: string;
    budget_estimate: string;
    travelers_count: string;
    trip_profile: string;
    assigned_user_id: string;
    lead_temperature: string;
    preferences: string;
  };
  const [form, setForm] = useState<FormState>({
    full_name: "",
    phone: "",
    email: "",
    source: "",
    destination: "",
    travel_date_label: "",
    budget_estimate: "",
    travelers_count: "",
    trip_profile: "",
    assigned_user_id: "",
    lead_temperature: "",
    preferences: "",
  });
  const [saving, setSaving] = useState(false);
  const [contactLevel, setContactLevel] = useState<ContactLevel>("lead");
  const [contactId, setContactId] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string; avatarUrl?: string | null }>>([]);
  const [quotesCount, setQuotesCount] = useState(0);
  const [conversationsCount, setConversationsCount] = useState(0);

  useEffect(() => {
    if (!card && id) setCard(readCard(id));
  }, [id, card]);

  // Carrega lista de usuários (responsáveis)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .order("full_name", { ascending: true });
      if (cancelled || !data) return;
      setUsers(
        data
          .filter((u) => u.user_id)
          .map((u) => ({
            id: u.user_id as string,
            name: u.full_name || u.email || "Usuário",
          }))
      );
    })();
    return () => { cancelled = true; };
  }, []);

  // Carrega dados do lead do banco e popula form
  useEffect(() => {
    let cancelled = false;
    if (!leadId) return;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("phone, full_name, email, source, destination, travel_date_start, travel_date_end, budget_estimate, travelers_count, preferences, trip_profile, assigned_user_id, lead_temperature")
        .eq("id", leadId)
        .maybeSingle();
      if (cancelled || !data) return;
      const dateLabel = data.travel_date_start
        ? data.travel_date_end && data.travel_date_end !== data.travel_date_start
          ? `${data.travel_date_start} a ${data.travel_date_end}`
          : data.travel_date_start
        : "";
      setForm((prev) => ({
        ...prev,
        full_name: data.full_name ?? prev.full_name,
        phone: data.phone ?? prev.phone,
        email: (data as any).email ?? prev.email,
        source: (data as any).source ?? prev.source,
        destination: data.destination ?? prev.destination,
        travel_date_label: dateLabel || prev.travel_date_label,
        budget_estimate: data.budget_estimate?.toString() ?? prev.budget_estimate,
        travelers_count: data.travelers_count?.toString() ?? prev.travelers_count,
        preferences: data.preferences ?? prev.preferences,
        trip_profile: (data as any).trip_profile ?? prev.trip_profile,
        assigned_user_id: (data as any).assigned_user_id ?? prev.assigned_user_id,
        lead_temperature: (data as any).lead_temperature ?? prev.lead_temperature,
      }));
      setCard((prev) => ({
        id: id!,
        clientName: data.full_name || prev?.clientName || "",
        destination: data.destination ?? prev?.destination,
        ...prev,
        phone: data.phone ?? prev?.phone,
      }));

      // Quotes count
      const { count: qc } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", leadId);
      if (!cancelled) setQuotesCount(qc ?? 0);

      // Contact level + conversations
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, level, phone")
        .eq("lead_id", leadId)
        .maybeSingle();
      if (cancelled) return;
      if (contact) {
        setContactLevel((contact.level as ContactLevel) ?? "lead");
        setContactId(contact.id);
        if (contact.phone) {
          const { count: cc } = await supabase
            .from("wa_conversations")
            .select("id", { count: "exact", head: true })
            .eq("phone", contact.phone);
          if (!cancelled) setConversationsCount(cc ?? 0);
        }
      } else {
        setContactLevel("lead");
      }
    })();
    return () => { cancelled = true; };
  }, [leadId, id]);

  // Inicializa form a partir do card (sessionStorage)
  useEffect(() => {
    if (!card) return;
    setForm((prev) => ({
      ...prev,
      full_name: prev.full_name || card.clientName || "",
      phone: prev.phone || card.phone || "",
      destination: prev.destination || card.destination || "",
      travel_date_label: prev.travel_date_label || card.travelDate || "",
      budget_estimate: prev.budget_estimate || card.estimatedValue?.toString() || "",
    }));
  }, [card]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!leadId) {
      toast.error("Lead não identificado.");
      return;
    }
    if (!form.full_name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    try {
      const budget = form.budget_estimate ? Number(form.budget_estimate) : null;
      const travelers = form.travelers_count ? parseInt(form.travelers_count, 10) : null;
      const { error } = await supabase
        .from("leads")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          source: form.source || null,
          destination: form.destination || null,
          budget_estimate: Number.isFinite(budget as number) ? budget : null,
          travelers_count: Number.isFinite(travelers as number) ? travelers : null,
          preferences: form.preferences || null,
          trip_profile: form.trip_profile || null,
          assigned_user_id: form.assigned_user_id || null,
          lead_temperature: form.lead_temperature || null,
        } as any)
        .eq("id", leadId);
      if (error) throw error;

      // Mantém contacts em sincronia (nome real, nunca telefone/vazio)
      if (contactId && form.full_name.trim() && !/^\+?[\d\s-]+$/.test(form.full_name.trim())) {
        await supabase
          .from("contacts")
          .update({ full_name: form.full_name.trim(), phone: form.phone || null, email: form.email || null })
          .eq("id", contactId);
      }

      setCard((prev) =>
        prev
          ? {
              ...prev,
              clientName: form.full_name.trim(),
              phone: form.phone || undefined,
              destination: form.destination || undefined,
              estimatedValue: budget ?? undefined,
            }
          : prev
      );
      try {
        sessionStorage.setItem(
          `crm:lead:${id}`,
          JSON.stringify({
            ...(card ?? { id: id! }),
            clientName: form.full_name.trim(),
            phone: form.phone || undefined,
            destination: form.destination || undefined,
            estimatedValue: budget ?? undefined,
          })
        );
      } catch { /* ignore */ }
      toast.success("Alterações salvas com sucesso.");
    } catch (err) {
      console.error("[LeadDetail] save error:", err);
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const stageIndex = useMemo(
    () => Math.max(0, FUNNEL_STAGES.findIndex((s) => s.id === stageId)),
    [stageId]
  );



  const isClient = contactLevel === "cliente";

  return (
    <div className="flex flex-col min-h-[calc(100vh-0px)] bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="px-6 lg:px-10 pt-6 pb-5">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/crm")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-display font-semibold tracking-tight text-foreground">
                {card?.clientName ?? form.full_name ?? "Lead"}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {form.destination && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" strokeWidth={1.5} />
                    {form.destination}
                  </span>
                )}
                {form.travel_date_label && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4" strokeWidth={1.5} />
                    {form.travel_date_label}
                  </span>
                )}
                {card?.isAILead && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 ring-1 ring-inset ring-emerald-100"
                  >
                    <Bot className="h-3 w-3 mr-1" /> Lead triado pela IA
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isClient && leadId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => navigate(`/crm/lead/${id}/convert`)}
                >
                  <UserCheck className="h-4 w-4 mr-1.5" />
                  Converter para Cliente
                </Button>
              )}
              {isClient && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => navigate(`/quotes?new=1&lead_id=${leadId}`)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova Cotação
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stepper — estilo Cotações */}
        <div className="px-6 lg:px-10 pb-5">
          <div className="glass-card rounded-xl px-3 sm:px-4 py-3 bg-background border border-border">
            <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
              {FUNNEL_STAGES.map((stage, idx) => {
                const isActive = idx === stageIndex;
                const isPast = idx < stageIndex;
                const isLast = idx === FUNNEL_STAGES.length - 1;
                return (
                  <div key={stage.id} className="flex items-center flex-1">
                    <div
                      className={cn(
                        "flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-body font-medium transition-all whitespace-nowrap",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : isPast
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold",
                          isActive
                            ? "bg-primary-foreground text-primary"
                            : isPast
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {isPast ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                      </span>
                      {stage.title}
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          "flex-1 h-0.5 mx-1 rounded-full min-w-[8px]",
                          isPast ? "bg-primary/40" : "bg-border"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs + content */}
      <main className="flex-1 min-h-0">
        <Tabs defaultValue="main" className="flex flex-col">
          <div className="border-b border-border bg-background sticky top-0 z-10">
            <div className="px-6 lg:px-10 py-2">
              <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted p-0.5 w-full justify-start">
                <TabTriggerItem value="main" icon={FileText} label="Principal" />
                <TabTriggerItem value="timeline" icon={Clock} label="Timeline" />
                <TabTriggerItem value="quotes" icon={FileText} label="Cotações" count={quotesCount} />
                <TabTriggerItem value="conversations" icon={MessageCircle} label="Conversas" count={conversationsCount} />
                <TabTriggerItem value="documents" icon={FileBox} label="Documentos" />
                <TabTriggerItem value="notes" icon={StickyNote} label="Observações" />
              </TabsList>
            </div>
          </div>

          <div className="px-6 lg:px-10 py-8">
            <div className="max-w-5xl mx-auto">
              <TabsContent value="main" className="mt-0 space-y-8">
                <Section title="Informações do contato">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field
                      label="Nome"
                      value={form.full_name}
                      onChange={(e) => updateField("full_name", e.target.value)}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Telefone</Label>
                      <IntlPhoneInput
                        value={form.phone}
                        onChange={(v) => updateField("phone", v)}
                        placeholder="Ainda não informado"
                      />
                    </div>
                    <Field
                      label="E-mail"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                    <SelectField
                      label="Origem do lead"
                      value={form.source}
                      onChange={(v) => updateField("source", v)}
                      options={SOURCES}
                      placeholder="Selecione a origem"
                    />
                  </div>
                </Section>

                <Section title="Interesse">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field
                      label="Destino"
                      value={form.destination}
                      onChange={(e) => updateField("destination", e.target.value)}
                    />
                    <Field
                      label="Data da viagem"
                      value={form.travel_date_label}
                      onChange={(e) => updateField("travel_date_label", e.target.value)}
                    />
                    <Field
                      label="Número de viajantes"
                      placeholder="Ex.: 2"
                      value={form.travelers_count}
                      onChange={(e) => updateField("travelers_count", e.target.value)}
                    />
                    <Field
                      label="Orçamento estimado (R$)"
                      type="number"
                      value={form.budget_estimate}
                      onChange={(e) => updateField("budget_estimate", e.target.value)}
                    />
                    <SelectField
                      label="Perfil de viagem"
                      value={form.trip_profile}
                      onChange={(v) => updateField("trip_profile", v)}
                      options={TRIP_PROFILES}
                      placeholder="Selecione o perfil"
                    />
                  </div>
                </Section>

                <Section title="Atribuição">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <SelectField
                      label="Responsável"
                      value={form.assigned_user_id}
                      onChange={(v) => updateField("assigned_user_id", v)}
                      options={users.map((u) => ({ value: u.id, label: u.name }))}
                      placeholder="Selecione um responsável"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Temperatura do lead
                      </Label>
                      <div className="flex gap-2">
                        {TEMPERATURES.map((t) => {
                          const Icon = t.icon;
                          const active = form.lead_temperature === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() =>
                                updateField("lead_temperature", active ? "" : t.value)
                              }
                              className={cn(
                                "flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-md border text-xs font-medium transition-colors",
                                active
                                  ? t.activeClass
                                  : "border-input bg-background text-muted-foreground hover:bg-accent"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/crm")}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
                {leadId ? (
                  <LeadTimeline leadId={leadId} />
                ) : (
                  <p className="text-sm text-muted-foreground">Lead não identificado.</p>
                )}
              </TabsContent>

              <TabsContent value="quotes" className="mt-0">
                <Section title={`Cotações vinculadas (${quotesCount})`}>
                  {quotesCount === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="Nenhuma cotação vinculada"
                      description="Crie uma nova cotação para este contato."
                      action={
                        <Button
                          size="sm"
                          onClick={() => navigate(`/quotes?new=1&lead_id=${leadId}`)}
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Nova Cotação
                        </Button>
                      }
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/quotes?lead_id=${leadId}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Ver todas as cotações
                    </Button>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="conversations" className="mt-0">
                <Section title={`Conversas (${conversationsCount})`}>
                  {conversationsCount === 0 ? (
                    <EmptyState
                      icon={MessageCircle}
                      title="Nenhuma conversa registrada"
                      description="As conversas da Central de Atendimento aparecerão aqui."
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/service-center?phone=${form.phone}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Abrir na Central de Atendimento
                    </Button>
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="documents" className="mt-0">
                <Section title="Documentos">
                  <EmptyState
                    icon={FileBox}
                    title="Nenhum documento anexado"
                    description="Anexe documentos relacionados a este contato."
                  />
                </Section>
              </TabsContent>

              <TabsContent value="notes" className="mt-0 space-y-8">
                <Section title="Observações">
                  <Textarea
                    rows={6}
                    placeholder="Preferências, restrições, pedidos especiais..."
                    value={form.preferences}
                    onChange={(e) => updateField("preferences", e.target.value)}
                  />
                </Section>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/crm")}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

function TabTriggerItem({
  value,
  icon: Icon,
  label,
  count,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger value={value} className="flex items-center gap-1 text-[11px] px-2 py-1">
      <Icon className="w-3 h-3" />
      {label}
      {typeof count === "number" && count > 0 && (
        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          {title}
        </h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input className="h-10" {...props} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-border rounded-lg">
      <Icon className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  );
}
