import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Check,
  MapPin,
  Calendar as CalendarIcon,
  MessageCircle,
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
  Sparkles,
  ChevronDown,
  User as UserIcon,
  Phone,
  Mail,
  Globe,
  Users as UsersIcon,
  DollarSign,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { LeadWhatsAppColumn } from "@/components/crm/LeadWhatsAppColumn";
import { UserPicker } from "@/components/ui/user-picker";
import { CRMBreadcrumb } from "@/components/crm/CRMBreadcrumb";
import { QuoteKanbanCard } from "@/components/quotes/QuoteKanbanCard";
import { LeadNotesTab } from "@/components/crm/LeadNotesTab";
import { LeadDocumentsTab } from "@/components/crm/LeadDocumentsTab";

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

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (!id) return "main";
    try {
      return sessionStorage.getItem(`crm:lead:${id}:tab`) || "main";
    } catch {
      return "main";
    }
  });

  // Re-sincroniza ao voltar para a tela (ex.: ao fechar o editor de cotações)
  useEffect(() => {
    if (!id) return;
    const onFocus = () => {
      try {
        const v = sessionStorage.getItem(`crm:lead:${id}:tab`);
        if (v) setActiveTab(v);
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [id]);

  // Marca a origem para que o editor de cotações volte para o card do CRM ao fechar
  // e para que a sidebar continue destacando "CRM" enquanto a cotação estiver aberta.
  const setQuotesReturnTo = () => {
    if (!id) return;
    try {
      const payload = {
        url: `/crm/lead/${id}${window.location.search}`,
        ts: Date.now(),
      };
      sessionStorage.setItem("quotes:returnTo", JSON.stringify(payload));
      sessionStorage.setItem(
        "quotes:origin",
        JSON.stringify({ origin: "crm", ts: Date.now() }),
      );
      // Notifica a sidebar para reavaliar o item ativo imediatamente
      window.dispatchEvent(new Event("quotes:origin-changed"));
    } catch { /* ignore */ }
  };

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
  type LeadQuote = {
    id: string;
    title: string | null;
    destination: string | null;
    stage: string;
    total_value: number | null;
    travel_date_start: string | null;
    travel_date_end: string | null;
    quote_validity: string | null;
    created_at: string | null;
    conclusion_type: string | null;
    archived_at: string | null;
  };
  const [leadQuotes, setLeadQuotes] = useState<LeadQuote[]>([]);
  const quotesCount = leadQuotes.length;
  const [waPanelOpen, setWaPanelOpen] = useState(false);
  const [legacyPreferences, setLegacyPreferences] = useState<string | null>(null);
  const [aiData, setAiData] = useState<{
    ai_summary: string | null;
    destination: string | null;
    travel_date_start: string | null;
    travel_date_end: string | null;
    flexible_dates: boolean | null;
    flexible_dates_description: string | null;
    travelers_count: number | null;
    budget_estimate: number | null;
    preferences: string | null;
    extras: Record<string, any>;
  }>({
    ai_summary: null,
    destination: null,
    travel_date_start: null,
    travel_date_end: null,
    flexible_dates: null,
    flexible_dates_description: null,
    travelers_count: null,
    budget_estimate: null,
    preferences: null,
    extras: {},
  });

  // Quantidade de mensagens não lidas no WhatsApp
  const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
  const { data: waInfo = { unread: 0, hasConversation: false } } = useQuery({
    queryKey: ["lead-wa-info", contactId, form.phone],
    enabled: !!contactId || !!form.phone,
    queryFn: async () => {
      let conv: any = null;
      if (contactId) {
        const { data } = await supabase
          .from("wa_conversations")
          .select("unread_count")
          .eq("contact_id", contactId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        if (data) conv = data;
      }
      if (!conv) {
        const tail = onlyDigits(form.phone || "").slice(-9);
        if (tail) {
          const { data } = await supabase
            .from("wa_conversations")
            .select("phone, unread_count")
            .ilike("phone", `%${tail}%`)
            .order("last_message_at", { ascending: false, nullsFirst: false })
            .limit(5);
          const found = (data || []).find((c: any) =>
            onlyDigits(c.phone || "").endsWith(tail),
          );
          conv = found ?? null;
        }
      }
      return { unread: Number(conv?.unread_count ?? 0), hasConversation: !!conv };
    },
  });
  const waUnread = waInfo.unread;
  const hasConversation = waInfo.hasConversation;

  useEffect(() => {
    if (!card && id) setCard(readCard(id));
  }, [id, card]);

  // Carrega lista de usuários (responsáveis)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles_basic")
        .select("user_id, full_name, email, avatar_url")
        .order("full_name", { ascending: true });
      if (cancelled || !data) return;
      setUsers(
        data
          .filter((u) => u.user_id)
          .map((u) => ({
            id: u.user_id as string,
            name: u.full_name || u.email || "Usuário",
            avatarUrl: u.avatar_url ?? null,
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
        .select("phone, full_name, email, source, destination, travel_date_start, travel_date_end, flexible_dates, flexible_dates_description, budget_estimate, travelers_count, preferences, trip_profile, assigned_user_id, lead_temperature, ai_summary, ai_collected_data")
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

      // Captura observação legada (campo `preferences` antigo) só uma vez,
      // para exibi-la como "Observação importada" no novo sistema de notas.
      setLegacyPreferences((prev) => prev ?? (data.preferences ?? null));

      // Snapshot dos dados extraídos pela IA (origem WhatsApp)
      const collected = ((data as any).ai_collected_data ?? {}) as Record<string, any>;
      const { whatsapp_sender_name: _ignored, ...extras } = collected;
      setAiData({
        ai_summary: (data as any).ai_summary ?? null,
        destination: data.destination ?? null,
        travel_date_start: data.travel_date_start ?? null,
        travel_date_end: data.travel_date_end ?? null,
        flexible_dates: (data as any).flexible_dates ?? null,
        flexible_dates_description: (data as any).flexible_dates_description ?? null,
        travelers_count: data.travelers_count ?? null,
        budget_estimate: data.budget_estimate != null ? Number(data.budget_estimate) : null,
        preferences: data.preferences ?? null,
        extras: extras || {},
      });

      setCard((prev) => ({
        id: id!,
        clientName: data.full_name || prev?.clientName || "",
        destination: data.destination ?? prev?.destination,
        ...prev,
        phone: data.phone ?? prev?.phone,
      }));

      // Quotes (lista completa para renderizar inline na aba "Cotações")
      const { data: lq } = await supabase
        .from("quotes")
        .select("id, title, destination, stage, total_value, travel_date_start, travel_date_end, quote_validity, created_at, conclusion_type, archived_at")
        .eq("lead_id", leadId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (!cancelled) setLeadQuotes((lq ?? []) as LeadQuote[]);

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
      } else {
        setContactLevel("lead");
      }
    })();
    return () => { cancelled = true; };
  }, [leadId, id]);

  // Refetch das cotações vinculadas (chamado ao voltar a aba/janela ou após editor fechar)
  const refetchLeadQuotes = async () => {
    if (!leadId) return;
    const { data } = await supabase
      .from("quotes")
      .select("id, title, destination, stage, total_value, travel_date_start, travel_date_end, quote_validity, created_at, conclusion_type, archived_at")
      .eq("lead_id", leadId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    setLeadQuotes((data ?? []) as LeadQuote[]);
  };

  // Refetch quando a aba/janela volta a ficar visível (cobre voltar de /quotes)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refetchLeadQuotes();
    };
    const onFocus = () => refetchLeadQuotes();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

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

  const appHeaderH = 56;
  const stickyTabsTop = appHeaderH;

  const isClient = contactLevel === "cliente";

  return (
    <div className="flex flex-col min-h-[calc(100vh-0px)] bg-slate-50 dark:bg-slate-950">
      {/* Cabeçalho principal — largura total */}
      <header className="border-b border-border bg-white dark:bg-slate-900 w-full">
        <div className="px-6 lg:px-10 pt-6 pb-5">
          <CRMBreadcrumb
            className="mb-3"
            items={[
              { label: "CRM", to: "/crm" },
              { label: "Leads", to: "/crm" },
              { label: "Detalhes do Lead" },
            ]}
          />

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
                {card?.isAILead && (() => {
                  const filled = [
                    !!form.destination?.trim(),
                    !!form.travel_date_label?.trim(),
                    !!form.travelers_count?.toString().trim(),
                  ].filter(Boolean).length;
                  const variant =
                    filled === 3 ? "complete" : filled === 0 ? "neutral" : "partial";
                  const cls =
                    variant === "complete"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 ring-1 ring-inset ring-emerald-100"
                      : variant === "partial"
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-50 ring-1 ring-inset ring-amber-100"
                        : "bg-muted text-muted-foreground hover:bg-muted ring-1 ring-inset ring-border";
                  const label =
                    variant === "complete"
                      ? "Lead triado pela IA"
                      : variant === "partial"
                        ? "Em qualificação pela IA"
                        : "Recebido pela IA";
                  return (
                    <Badge
                      variant="secondary"
                      className={cls}
                      title={
                        variant === "complete"
                          ? "Destino, período e número de viajantes coletados pela IA"
                          : variant === "partial"
                            ? `IA coletou ${filled} de 3 dados de interesse (destino, período, viajantes)`
                            : "IA iniciou a conversa, mas ainda não coletou dados de interesse"
                      }
                    >
                      <Bot className="h-3 w-3 mr-1" /> {label}
                    </Badge>
                  );
                })()}
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
                  onClick={() => { setQuotesReturnTo(); navigate("/quotes", { state: { newQuote: true, leadId } }); }}
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  Nova Cotação
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Grid de duas colunas: conteúdo + painel lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-[68fr_32fr] items-start flex-1 min-h-0">
        <div className="flex flex-col min-w-0">
      {/* Tabs + content */}
      <main className="flex-1 min-h-0">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            if (id) {
              try { sessionStorage.setItem(`crm:lead:${id}:tab`, v); } catch {}
            }
          }}
          className="flex flex-col"
        >
          {/* Wrapper sticky agrupando Stepper + Abas */}
          <div className="sticky z-20 bg-slate-50 dark:bg-slate-900 pt-4 pb-2 w-full shadow-sm" style={{ top: stickyTabsTop }}>
            {/* Stepper — estilo chevron (etapas do funil) */}
            <div className="px-6 lg:px-10 pb-3">
              <div className="rounded-xl px-2 sm:px-3 py-2 bg-background border border-border overflow-x-auto">
                <div className="flex items-stretch w-full min-w-max">
                  {FUNNEL_STAGES.map((stage, idx) => {
                    const isActive = idx === stageIndex;
                    const isPast = idx < stageIndex;
                    const isFirst = idx === 0;
                    const isLast = idx === FUNNEL_STAGES.length - 1;

                    // Chevron clip-path: ponta à direita (exceto último) e recorte à esquerda (exceto primeiro)
                    const clipPath = !isFirst && !isLast
                      ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)"
                      : isFirst && !isLast
                        ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                        : !isFirst && isLast
                          ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                          : undefined;

                    const colorClasses = isActive
                      ? "bg-amber-400 text-amber-950 font-semibold"
                      : isPast
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100";

                    return (
                      <div
                        key={stage.id}
                        className={cn(
                          "flex items-center justify-center text-xs sm:text-sm py-2 px-4 sm:px-5 transition-colors flex-1 min-w-[110px]",
                          colorClasses,
                          !isFirst && "-ml-2",
                        )}
                        style={{ clipPath }}
                      >
                        <span className="whitespace-nowrap">{stage.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Abas */}
            <div className="px-6 lg:px-10 border-b border-border">
              <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted p-0.5 w-full justify-start">
                <TabTriggerItem value="main" icon={FileText} label="Principal" />
                <TabTriggerItem value="timeline" icon={Clock} label="Timeline" />
                <TabTriggerItem value="quotes" icon={FileText} label="Cotações" count={quotesCount} />
                <TabTriggerItem value="documents" icon={FileBox} label="Documentos" />
                <TabTriggerItem value="notes" icon={StickyNote} label="Observações" />
              </TabsList>
            </div>
          </div>

          <div className="px-6 lg:px-10 py-8">
            <div className="max-w-5xl mx-auto">
              <TabsContent value="main" className="mt-0 space-y-4">
                <Section title="Informações do contato">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <Field
                      label="Nome"
                      value={form.full_name}
                      onChange={(e) => updateField("full_name", e.target.value)}
                    />
                    <div className="space-y-1">
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

                {form.source === "whatsapp" && (
                  <AISummarySection
                    aiData={aiData}
                    form={form}
                    onApply={(field, value) => updateField(field as any, value as any)}
                  />
                )}

                <Section title="Interesse">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Responsável
                      </Label>
                      <UserPicker
                        users={users}
                        value={form.assigned_user_id || null}
                        onChange={(v) => updateField("assigned_user_id", v ?? "")}
                        placeholder="Selecione um responsável"
                      />
                    </div>
                    <div className="space-y-1">
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
                                "flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-colors",
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs uppercase tracking-[0.18em] font-body text-muted-foreground">
                      Cotações vinculadas ({quotesCount})
                    </h3>
                    {quotesCount > 0 && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setQuotesReturnTo();
                          navigate("/quotes", { state: { newQuote: true, leadId } });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Nova Cotação
                      </Button>
                    )}
                  </div>

                  {quotesCount === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="Nenhuma cotação vinculada"
                      description="Crie uma nova cotação para este contato."
                      action={
                        <Button
                          size="sm"
                          onClick={() => {
                            setQuotesReturnTo();
                            navigate("/quotes", { state: { newQuote: true, leadId } });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1.5" />
                          Nova Cotação
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {leadQuotes.map((q) => (
                        <QuoteKanbanCard
                          key={q.id}
                          quote={{
                            id: q.id,
                            title: q.title,
                            destination: q.destination,
                            stage: q.stage,
                            total_value: q.total_value,
                            travel_date_start: q.travel_date_start,
                            travel_date_end: q.travel_date_end,
                            quote_validity: q.quote_validity,
                            created_at: q.created_at,
                            conclusion_type: q.conclusion_type,
                            archived_at: q.archived_at,
                          }}
                          assigneeName={form.full_name || card?.clientName || null}
                          onClick={() => { setQuotesReturnTo(); navigate("/quotes", { state: { editQuoteId: q.id } }); }}
                          onDragStart={() => {}}
                          onDragEnd={() => {}}
                          menu={<span aria-hidden />}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>


              <TabsContent value="documents" className="mt-0">
                <Section title="Documentos">
                  <LeadDocumentsTab leadId={leadId} />
                </Section>
              </TabsContent>

              <TabsContent value="notes" className="mt-0 space-y-4">
                <LeadNotesTab leadId={leadId} legacyText={legacyPreferences} />
              </TabsContent>
            </div>
          </div>
      </Tabs>
      </main>
      </div>

      <aside
        className="hidden lg:block min-w-0 self-start sticky border-l border-border overflow-hidden bg-white dark:bg-slate-900 z-10"
        style={{ top: stickyTabsTop, height: `calc(100vh - ${stickyTabsTop}px)` }}
      >
        <LeadWhatsAppColumn
          onClose={() => setWaPanelOpen(false)}
          contactName={form.full_name || card?.clientName || "Contato"}
          phone={form.phone || card?.phone || null}
          contactId={contactId}
          leadId={leadId}
          formSnapshot={{
            destination: form.destination,
            travel_date_label: form.travel_date_label,
            budget_estimate: form.budget_estimate,
            travelers_count: form.travelers_count,
          }}
          onApplyNoteSuggestion={(s) => updateField(s.field as any, s.value as any)}
        />
      </aside>
      </div>
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
      <div className="flex items-center gap-3 mb-2">
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
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: LucideIcon }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input className={cn("h-9", Icon && "pl-9")} {...props} />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        )}
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className={cn("h-9", Icon && "pl-9")}>
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

// ===== Resumo da IA (origem WhatsApp) =====

type AIDataSnapshot = {
  ai_summary: string | null;
  destination: string | null;
  travel_date_start: string | null;
  travel_date_end: string | null;
  flexible_dates: boolean | null;
  flexible_dates_description: string | null;
  travelers_count: number | null;
  budget_estimate: number | null;
  preferences: string | null;
  extras: Record<string, any>;
};

type AIRow = {
  label: string;
  value: string;
  field?: string;
  applyValue?: string;
  alreadyApplied?: boolean;
};

function formatBRL(n: number) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  } catch {
    return `R$ ${n}`;
  }
}

function formatDateBR(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function buildAIRows(
  ai: AIDataSnapshot,
  form: { destination: string; travel_date_label: string; budget_estimate: string; travelers_count: string; preferences: string },
): AIRow[] {
  const rows: AIRow[] = [];

  const intent = ai.extras?.intent || ai.extras?.intencao || ai.extras?.motivo;
  if (intent) rows.push({ label: "Intenção identificada", value: String(intent) });

  if (ai.destination) {
    rows.push({
      label: "Destino mencionado",
      value: ai.destination,
      field: "destination",
      applyValue: ai.destination,
      alreadyApplied: form.destination.trim().toLowerCase() === ai.destination.trim().toLowerCase(),
    });
  }

  if (ai.travel_date_start || ai.travel_date_end || ai.flexible_dates) {
    let dateValue = "";
    let applyDate = "";
    if (ai.flexible_dates) {
      dateValue = ai.flexible_dates_description ? `Flexíveis — ${ai.flexible_dates_description}` : "Datas flexíveis";
      applyDate = dateValue;
    } else if (ai.travel_date_start && ai.travel_date_end && ai.travel_date_start !== ai.travel_date_end) {
      dateValue = `${formatDateBR(ai.travel_date_start)} a ${formatDateBR(ai.travel_date_end)}`;
      applyDate = `${ai.travel_date_start} a ${ai.travel_date_end}`;
    } else if (ai.travel_date_start) {
      dateValue = formatDateBR(ai.travel_date_start);
      applyDate = ai.travel_date_start;
    }
    if (dateValue) {
      rows.push({
        label: "Datas mencionadas",
        value: dateValue,
        field: "travel_date_label",
        applyValue: applyDate,
        alreadyApplied: form.travel_date_label.trim() === applyDate.trim(),
      });
    }
  }

  if (ai.travelers_count != null) {
    const v = String(ai.travelers_count);
    rows.push({
      label: "Número de viajantes",
      value: v,
      field: "travelers_count",
      applyValue: v,
      alreadyApplied: form.travelers_count.trim() === v,
    });
  }

  if (ai.budget_estimate != null) {
    const v = String(ai.budget_estimate);
    rows.push({
      label: "Orçamento mencionado",
      value: formatBRL(ai.budget_estimate),
      field: "budget_estimate",
      applyValue: v,
      alreadyApplied: form.budget_estimate.trim() === v,
    });
  }

  if (ai.preferences) {
    rows.push({
      label: "Preferências",
      value: ai.preferences,
      field: "preferences",
      applyValue: ai.preferences,
      alreadyApplied: (form.preferences || "").includes(ai.preferences),
    });
  }

  const restrictions = ai.extras?.restrictions || ai.extras?.restricoes;
  if (restrictions) rows.push({ label: "Restrições", value: String(restrictions) });

  return rows;
}

function AISummarySection({
  aiData,
  form,
  onApply,
}: {
  aiData: AIDataSnapshot;
  form: { destination: string; travel_date_label: string; budget_estimate: string; travelers_count: string; preferences: string };
  onApply: (field: string, value: string) => void;
}) {
  const rows = useMemo(() => buildAIRows(aiData, form), [aiData, form]);
  const hasData = rows.length > 0 || !!aiData.ai_summary;
  const [open, setOpen] = useState<boolean>(hasData);

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Resumo da IA
        </h2>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="rounded-lg border border-primary/20 bg-primary/[0.04]">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-primary/[0.06] transition-colors rounded-t-lg">
            <span className="text-xs text-muted-foreground">
              {hasData
                ? `${rows.length} informação${rows.length === 1 ? "" : "ões"} coletada${rows.length === 1 ? "" : "s"} pela IA durante a conversa`
                : "Nenhuma informação coletada pela IA"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 pt-1 space-y-3">
              {aiData.ai_summary && (
                <div className="rounded-md bg-background/60 border border-border px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Resumo da conversa
                  </p>
                  <p className="text-sm text-foreground leading-relaxed italic">
                    "{aiData.ai_summary}"
                  </p>
                </div>
              )}

              {rows.length === 0 && !aiData.ai_summary ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma informação estruturada foi extraída ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {rows.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-md bg-background/60 border border-border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {r.label}
                        </p>
                        <p className="text-sm text-foreground break-words">{r.value}</p>
                      </div>
                      {r.field && r.applyValue ? (
                        r.alreadyApplied ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 mt-0.5">
                            <Check className="h-3 w-3" /> aplicado
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] shrink-0 mt-0.5 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => onApply(r.field!, r.applyValue!)}
                          >
                            Usar
                          </Button>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </section>
  );
}
