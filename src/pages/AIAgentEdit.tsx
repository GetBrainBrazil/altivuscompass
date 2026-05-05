import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import {
  Sparkles, Shield, Bot, ArrowLeft, FlaskConical, Trash2,
  Headset, MessageCircle, Brain, Globe, Plane, Compass, Heart, Star, ShieldCheck, User, Sparkle, Map, Briefcase, Camera, Coffee, Palmtree,
  GitBranch, ClipboardList, Plug, BarChart3, Loader2, AlertTriangle, AlertCircle, Check, CheckCircle, Power, Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Agent } from "@/components/ai-agents/AgentEditDialog";
import { FluxosAtendimentoSection } from "@/components/ai-agents/FluxosAtendimentoSection";
import { ComunicacaoSection } from "@/components/ai-agents/ComunicacaoSection";
import { ColetaDadosSection } from "@/components/ai-agents/ColetaDadosSection";
import { RegrasLimitesSection } from "@/components/ai-agents/RegrasLimitesSection";
import { IntegracoesSection } from "@/components/ai-agents/IntegracoesSection";
import { MetricasSection } from "@/components/ai-agents/MetricasSection";
import { TestarAgenteSection } from "@/components/ai-agents/TestarAgenteSection";
import { useWhatsAppProfile } from "@/hooks/useWhatsAppProfile";
import { supabase } from "@/integrations/supabase/client";
import { SectionSkeleton } from "@/components/ai-agents/AIAgentSkeletons";
import WhatsAppConnectionPanel from "@/components/ai-agents/WhatsAppConnectionPanel";

const STORAGE_KEY = "ai-agents-draft";
const LIST_KEY = "ai-agents-list";

const MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (rápido)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (avançado)" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (econômico)" },
  { value: "openai/gpt-5", label: "GPT-5 (premium)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini (balanceado)" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano (rápido)" },
];

const TONES = [
  { value: "amigavel", label: "Amigável e acolhedor" },
  { value: "formal", label: "Formal e profissional" },
  { value: "consultivo", label: "Consultivo e especialista" },
  { value: "direto", label: "Direto e objetivo" },
  { value: "entusiasmado", label: "Entusiasmado e inspirador" },
];

type SectionKey =
  | "identidade"
  | "fluxos"
  | "comunicacao"
  | "coleta"
  | "regras"
  | "integracoes"
  | "metricas"
  | "testar"
  | "whatsapp";

const SECTIONS: { key: SectionKey; icon: LucideIcon; label: string }[] = [
  { key: "identidade", icon: Bot, label: "Identidade" },
  { key: "fluxos", icon: GitBranch, label: "Fluxos de Atendimento" },
  { key: "comunicacao", icon: MessageCircle, label: "Comunicação" },
  { key: "coleta", icon: ClipboardList, label: "Coleta de Dados" },
  { key: "regras", icon: ShieldCheck, label: "Regras e Limites" },
  { key: "integracoes", icon: Plug, label: "Integrações" },
  { key: "metricas", icon: BarChart3, label: "Métricas" },
  { key: "testar", icon: FlaskConical, label: "Testar Agente" },
];

const AGENT_ICONS: { key: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "bot", Icon: Bot },
  { key: "headset", Icon: Headset },
  { key: "message", Icon: MessageCircle },
  { key: "sparkle", Icon: Sparkle },
  { key: "brain", Icon: Brain },
  { key: "globe", Icon: Globe },
  { key: "plane", Icon: Plane },
  { key: "compass", Icon: Compass },
  { key: "heart", Icon: Heart },
  { key: "star", Icon: Star },
  { key: "shield", Icon: ShieldCheck },
  { key: "user", Icon: User },
  { key: "map", Icon: Map },
  { key: "briefcase", Icon: Briefcase },
  { key: "camera", Icon: Camera },
  { key: "palmtree", Icon: Palmtree },
];

const getAgentIcon = (key?: string) =>
  AGENT_ICONS.find((i) => i.key === key)?.Icon ?? Bot;

const emptyAgent = (): Agent => ({
  id: crypto.randomUUID(),
  name: "",
  model: "google/gemini-2.5-flash",
  active: true,
  personality: "",
  rules: "",
  tone: "amigavel",
  icon: "bot",
  description: "",
});

const DEFAULT_AGENT: Agent = {
  id: "1",
  name: "Atendente Principal",
  model: "google/gemini-2.5-flash",
  active: true,
  tone: "amigavel",
  icon: "bot",
  description: "",
  personality:
    "Você é o atendente principal da Altivus Turismo. Recepcione clientes com cordialidade e identifique rapidamente o tipo de demanda.",
  rules:
    "- Nunca compartilhe preços sem validação\n- Transfira para humano em reclamações\n- Não responda fora do escopo de viagens",
};

export default function AIAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = false;

  const [form, setForm] = useState<Agent>(() => {
    try {
      const list: Agent[] = JSON.parse(sessionStorage.getItem(LIST_KEY) || "[]");
      const found = id ? list.find((a) => a.id === id) : list[0];
      const base = found ?? list[0] ?? DEFAULT_AGENT;
      return { personality: "", rules: "", tone: "amigavel", icon: "bot", description: "", ...base };
    } catch {}
    return DEFAULT_AGENT;
  });

  const [searchParams] = useSearchParams();
  const initialSection: SectionKey =
    searchParams.get("section") === "whatsapp" ? "whatsapp" : "identidade";
  const [activeSection, setActiveSection] = useState<SectionKey>(initialSection);
  const [revealedSections, setRevealedSections] = useState<Set<SectionKey>>(() => new Set());
  const wa = useWhatsAppProfile();

  // Reveal logic per section. Identidade also waits for WA photo to load (or 3s timeout).
  useEffect(() => {
    if (revealedSections.has(activeSection)) return;

    let cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      setRevealedSections((prev) => {
        if (prev.has(activeSection)) return prev;
        const next = new Set(prev);
        next.add(activeSection);
        return next;
      });
    };

    if (activeSection === "identidade") {
      if (wa.loading) return; // wait for next effect run when wa resolves
      if (wa.connected && wa.photoUrl) {
        const img = new Image();
        const timeout = window.setTimeout(reveal, 3000);
        img.onload = () => { window.clearTimeout(timeout); reveal(); };
        img.onerror = () => { window.clearTimeout(timeout); reveal(); };
        img.src = wa.photoUrl;
        return () => { cancelled = true; window.clearTimeout(timeout); };
      }
      // No photo to wait for
      const t = window.setTimeout(reveal, 150);
      return () => { cancelled = true; window.clearTimeout(t); };
    }

    const t = window.setTimeout(reveal, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [activeSection, wa.loading, wa.connected, wa.photoUrl, revealedSections]);

  const isSectionReady = revealedSections.has(activeSection);

  // Normalize values so null/undefined/"" and null/[] are treated equivalently
  const normalize = (val: unknown): unknown => {
    if (val === null || val === undefined || val === "") return null;
    if (Array.isArray(val)) {
      const arr = val.map(normalize);
      return arr.length === 0 ? null : arr;
    }
    if (typeof val === "object") {
      const out: Record<string, unknown> = {};
      const obj = val as Record<string, unknown>;
      Object.keys(obj)
        .sort()
        .forEach((k) => {
          const n = normalize(obj[k]);
          if (n !== null) out[k] = n;
        });
      return Object.keys(out).length === 0 ? null : out;
    }
    return val;
  };
  const serialize = (v: Agent) => JSON.stringify(normalize(structuredClone(v)));

  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => serialize(form));
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const isDirty = serialize(form) !== savedSnapshot;

  // Sub-sections call onChange on mount with their default values, which would
  // mark the form as dirty even when the user did nothing. Treat the first
  // emission per config key as a baseline (update both form and savedSnapshot).
  const seededConfigKeys = useRef<Set<string>>(new Set());
  const updateConfig = (key: string, v: unknown) => {
    setForm((f) => {
      const nextForm = { ...f, config: { ...(f.config || {}), [key]: v } } as Agent;
      if (!seededConfigKeys.current.has(key)) {
        seededConfigKeys.current.add(key);
        // Rebase saved snapshot so this initial emission isn't counted as a change
        setSavedSnapshot(serialize(nextForm));
      }
      return nextForm;
    });
  };

  // Operational status toggle (saves immediately, independent of "Salvar")
  const [statusSaving, setStatusSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);

  // Load current operational status from DB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_agent_status" as any)
        .select("active")
        .eq("agent_id", form.id)
        .maybeSingle();
      if (!cancelled && data && typeof (data as any).active === "boolean") {
        setForm((f) => {
          const updated = { ...f, active: (data as any).active };
          setSavedSnapshot(serialize(updated));
          return updated;
        });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmStatusChange = async () => {
    if (pendingStatus === null) return;
    const next = pendingStatus;
    setStatusSaving(true);
    const { error } = await supabase
      .from("ai_agent_status" as any)
      .upsert({ agent_id: form.id, active: next, updated_at: new Date().toISOString() }, { onConflict: "agent_id" });
    setStatusSaving(false);
    if (error) {
      toast.error("Erro ao alterar status. Tente novamente.");
      setPendingStatus(null);
      return;
    }
    setForm((f) => {
      const updated = { ...f, active: next };
      setSavedSnapshot(serialize(updated));
      return updated;
    });
    if (next) toast.success("Agente ativado com sucesso");
    else toast("Agente desativado");
    setPendingStatus(null);
  };

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  // Warn on browser navigation away with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Pending navigation due to unsaved changes
  const [pendingNav, setPendingNav] = useState<{ type: "href"; to: string } | { type: "pop" } | null>(null);

  // Intercept link clicks anywhere in the app while dirty
  useEffect(() => {
    if (!isDirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;
      // Only intercept internal SPA navigations
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const dest = url.pathname + url.search + url.hash;
      const current = window.location.pathname + window.location.search + window.location.hash;
      if (dest === current) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNav({ type: "href", to: dest });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  // Intercept browser back/forward while dirty
  useEffect(() => {
    if (!isDirty) return;
    // Push a sentinel state so popstate can be caught
    window.history.pushState({ __unsavedSentinel: true }, "");
    const onPop = (_e: PopStateEvent) => {
      // Re-push so we stay on this page until user decides
      window.history.pushState({ __unsavedSentinel: true }, "");
      setPendingNav({ type: "pop" });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [isDirty]);

  const performNav = (nav: typeof pendingNav) => {
    if (!nav) return;
    if (nav.type === "href") navigate(nav.to);
    else navigate(-1);
  };

  const handleDiscardAndLeave = () => {
    const nav = pendingNav;
    try {
      const snap = JSON.parse(savedSnapshot) as Agent;
      setForm(snap);
    } catch {}
    setPendingNav(null);
    // Defer to allow isDirty to recompute
    setTimeout(() => performNav(nav), 0);
  };

  const handleSaveAndLeave = async () => {
    if (!form.name.trim() || !form.model) {
      toast.error("Preencha os campos obrigatórios antes de salvar");
      setPendingNav(null);
      setActiveSection("identidade");
      return;
    }
    const nav = pendingNav;
    setPendingNav(null);
    await handleSave();
    setTimeout(() => performNav(nav), 50);
  };

  const handleSave = async () => {
    let hasError = false;
    if (!form.name.trim()) {
      setNameError("Informe o nome do agente");
      hasError = true;
    } else {
      setNameError(null);
    }
    if (!form.model) {
      setModelError("Selecione um modelo de IA");
      hasError = true;
    } else {
      setModelError(null);
    }
    if (hasError) {
      setActiveSection("identidade");
      setTimeout(() => {
        const el = document.getElementById(!form.name.trim() ? "agent-name" : "agent-model");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLInputElement | null)?.focus?.();
      }, 50);
      return;
    }

    setSaving(true);
    try {
      // Persist full agent config to local "backend"
      const list: Agent[] = JSON.parse(sessionStorage.getItem(LIST_KEY) || "[]");
      const idx = list.findIndex((a) => a.id === form.id);
      if (idx >= 0) list[idx] = form;
      else list.push(form);
      sessionStorage.setItem(LIST_KEY, JSON.stringify(list));
      sessionStorage.setItem(STORAGE_KEY + ":save", JSON.stringify(form));
      // Simulate async save
      await new Promise((r) => setTimeout(r, 400));
      setSavedSnapshot(serialize(form));
      toast.success("Configurações salvas com sucesso", { position: "top-right", duration: 3000 });
    } catch {
      toast.error("Erro ao salvar configurações. Tente novamente.", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isDirty) return;
    if (!confirm("Descartar alterações não salvas?")) return;
    try {
      const snap = JSON.parse(savedSnapshot) as Agent;
      setForm(snap);
    } catch {}
  };

  const handleDelete = () => {
    try {
      const list: Agent[] = JSON.parse(sessionStorage.getItem(LIST_KEY) || "[]");
      const next = list.filter((a) => a.id !== form.id);
      sessionStorage.setItem(LIST_KEY, JSON.stringify(next));
      const replacement = next[0] ?? DEFAULT_AGENT;
      setForm({ personality: "", rules: "", tone: "amigavel", icon: "bot", description: "", ...replacement });
      setSavedSnapshot(serialize(replacement as Agent));
    } catch {}
    toast.success(`Agente "${form.name || "sem nome"}" excluído`);
  };

  return (
    <div className="min-h-screen bg-[hsl(220_15%_97%)] dark:bg-[#0F1117]">
      {/* Sticky header */}
      <div className="sticky top-14 z-40 bg-white dark:bg-[#161923] border-b border-border/60 dark:border-[#2A2D3A] shadow-sm">
        <div className="max-w-[1100px] mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-[hsl(220_45%_15%)] dark:bg-[#2A3F6B] flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white dark:text-gray-100" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight truncate dark:text-gray-100">
                {form.name || "Agente sem nome"}
              </h1>
              <p className="text-xs text-muted-foreground dark:text-gray-500">
                Gerencie seu agente de inteligência artificial
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 text-destructive dark:text-red-400 hover:text-destructive hover:bg-destructive/5 border-destructive/30 dark:border-[#3A3D4A]"
                  >
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O agente{" "}
                      <strong>"{form.name || "sem nome"}"</strong> e todas as suas
                      configurações serão removidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" onClick={handleCancel} className="h-9 dark:text-gray-400 dark:border-[#3A3D4A] dark:hover:bg-white/5">
              Cancelar
            </Button>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="relative h-9 bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] text-white dark:bg-[#2A3F6B] dark:hover:bg-[#34497A] dark:text-gray-100"
                  >
                    {saving ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 mr-2 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        Salvar Configurações
                        {isDirty && (
                          <span
                            className="absolute -top-1 -right-1 rounded-full ring-2 ring-white"
                            style={{ width: 8, height: 8, backgroundColor: "#F59E0B" }}
                          />
                        )}
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {isDirty && !saving && (
                  <TooltipContent side="bottom">Há alterações não salvas</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Top horizontal nav */}
        <nav
          className="sticky top-[140px] z-20 bg-muted dark:bg-[#161923] border border-border/60 dark:border-[#2A2D3A] rounded-lg p-1 flex items-stretch gap-0.5 w-full shadow-sm"
          aria-label="Seções do agente"
        >
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.key;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(s.key)}
                title={s.label}
                className={
                  "flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] leading-tight whitespace-nowrap transition-colors " +
                  (isActive
                    ? "bg-white dark:bg-transparent dark:border-b-2 dark:border-gray-100 dark:rounded-none text-[hsl(220_45%_15%)] dark:text-gray-100 shadow-sm dark:shadow-none font-medium"
                    : "text-muted-foreground dark:text-gray-500 hover:bg-white/60 dark:hover:bg-white/5 dark:hover:text-gray-300")
                }
              >
                <Icon size={13} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}

          <div className="w-px bg-border mx-0.5 self-stretch" />

          {(() => {
            const isActive = activeSection === "whatsapp";
            return (
              <button
                type="button"
                onClick={() => setActiveSection("whatsapp")}
                title="Conexão WhatsApp"
                className={
                  "flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] leading-tight whitespace-nowrap transition-colors " +
                  (isActive
                    ? "bg-white dark:bg-transparent dark:border-b-2 dark:border-gray-100 dark:rounded-none text-[hsl(220_45%_15%)] dark:text-gray-100 shadow-sm dark:shadow-none font-medium"
                    : "text-muted-foreground dark:text-gray-500 hover:bg-white/60 dark:hover:bg-white/5 dark:hover:text-gray-300")
                }
              >
                <Smartphone size={13} strokeWidth={2} className="shrink-0" />
                <span className="truncate">WhatsApp</span>
                <span
                  className={
                    "inline-block h-1.5 w-1.5 rounded-full shrink-0 " +
                    (wa.loading
                      ? "bg-gray-300"
                      : wa.connected
                      ? "bg-emerald-500"
                      : "bg-red-500")
                  }
                  aria-label={wa.connected ? "WhatsApp conectado" : "WhatsApp desconectado"}
                />
              </button>
            );
          })()}
        </nav>

        {/* Content panel */}
        <div className="min-w-0 space-y-8">
        {!isSectionReady && <SectionSkeleton section={activeSection} />}
        {isSectionReady && (
        <div className="animate-fade-in">
        {activeSection === "identidade" && (
        <section className="bg-white dark:bg-[#161923] rounded-xl border border-border/60 dark:border-[#2A2D3A] shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border/60 dark:border-[#2A2D3A]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
              Identidade
            </h2>
            <p className="text-xs text-muted-foreground dark:text-gray-500 mt-1">
              Como este agente é identificado e qual modelo de IA o alimenta.
            </p>
          </div>
          <div className="p-8 space-y-6">
            {/* Avatar */}
            <AvatarIdentitySection form={form} setForm={setForm} />

            {/* Nome + Modelo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="agent-name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nome do Agente
                </Label>
                <Input
                  id="agent-name"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (e.target.value.trim()) setNameError(null);
                  }}
                  placeholder="Ex: Atendente Principal"
                  className={"h-10 " + (nameError ? "border-destructive focus-visible:ring-destructive" : "")}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-model" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Modelo de IA
                </Label>
                <Select value={form.model} onValueChange={(v) => { setForm({ ...form, model: v }); if (v) setModelError(null); }}>
                  <SelectTrigger id="agent-model" className={"h-10 " + (modelError ? "border-destructive focus-visible:ring-destructive" : "")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modelError && <p className="text-xs text-destructive">{modelError}</p>}
              </div>
            </div>

            {/* Descrição interna */}
            <div className="space-y-2">
              <Label htmlFor="agent-description" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Descrição interna
              </Label>
              <div className="relative">
                <Input
                  id="agent-description"
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value.slice(0, 120) })
                  }
                  placeholder="Ex: Atendente principal para triagem e qualificação de leads"
                  maxLength={120}
                  className="h-10 pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground tabular-nums">
                  {(form.description ?? "").length}/120
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Resumo do propósito deste agente. Visível apenas para a equipe.
              </p>
            </div>

            {/* Status Card — operational live switch */}
            <div
              className={
                "mt-6 flex items-center justify-between gap-4 rounded-lg p-4 border " +
                (form.active
                  ? "bg-white border-border border-l-4 border-l-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.1)]"
                  : "bg-gray-50 border-border border-l-4 border-l-gray-300")
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                {form.active ? (
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className={"text-sm font-semibold " + (form.active ? "text-green-700" : "text-gray-600")}>
                    {form.active ? "Agente Ativo" : "Agente Inativo"}
                  </div>
                  <div className={"text-[13px] " + (form.active ? "text-gray-500" : "text-gray-400")}>
                    {form.active
                      ? "A IA está respondendo mensagens no WhatsApp em tempo real"
                      : "A IA não está respondendo mensagens. Apenas atendentes humanos podem responder."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={statusSaving}
                onClick={() => setPendingStatus(!form.active)}
                className={
                  "shrink-0 inline-flex items-center gap-2 text-[13px] font-medium rounded-full px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
                  (form.active
                    ? "bg-white border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                    : "bg-green-500 text-white border border-green-500 hover:bg-green-600 hover:border-green-600")
                }
              >
                {statusSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )}
                {form.active ? "Desativar Agente" : "Ativar Agente"}
              </button>
            </div>
          </div>
        </section>
        )}

        {activeSection === "comunicacao" && (
          <ComunicacaoSection
            initialPersonality={form.personality}
            initialTone={form.tone}
            value={form.config?.comunicacao}
            onChange={(v) => updateConfig("comunicacao", v)}
          />
        )}

        {activeSection === "regras" && (
          <RegrasLimitesSection
            initialRules={form.rules}
            value={form.config?.regras}
            onChange={(v) => updateConfig("regras", v)}
          />
        )}

        {activeSection === "testar" && <TestarAgenteSection agent={form} />}

        {activeSection === "fluxos" && (
          <FluxosAtendimentoSection
            value={form.config?.fluxos}
            onChange={(v) => updateConfig("fluxos", v)}
          />
        )}

        {activeSection === "coleta" && (
          <ColetaDadosSection
            value={form.config?.coleta}
            onChange={(v) => updateConfig("coleta", v)}
          />
        )}

        {activeSection === "integracoes" && (
          <IntegracoesSection
            value={form.config?.integracoes}
            onChange={(v) => updateConfig("integracoes", v)}
          />
        )}

        {activeSection === "metricas" && <MetricasSection />}

        {activeSection === "whatsapp" && <WhatsAppConnectionPanel />}
        </div>
        )}
        </div>
      </div>

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => { if (!open) setPendingStatus(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingStatus ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {pendingStatus ? "Ativar Agente IA" : "Desativar Agente IA"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {pendingStatus
                    ? "Ao ativar o agente, a IA começará a responder automaticamente todas as mensagens recebidas no WhatsApp usando as configurações salvas."
                    : "Ao desativar o agente, a IA deixará de responder mensagens no WhatsApp. Apenas atendentes humanos poderão responder na Central de Atendimento."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingStatus
                    ? "Certifique-se de que as configurações estão corretas antes de ativar."
                    : "Mensagens recebidas continuarão sendo registradas."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmStatusChange(); }}
              disabled={statusSaving}
              className={
                pendingStatus
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }
            >
              {statusSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pendingStatus ? "Ativar Agente" : "Desativar Agente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingNav !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[4px] animate-in fade-in-0 duration-200"
          onClick={() => setPendingNav(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setPendingNav(null); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-white rounded-[12px] p-7 animate-in fade-in-0 zoom-in-95 duration-200"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex justify-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#FFFBEB]">
                <AlertCircle className="text-[#F59E0B]" size={40} strokeWidth={2} />
              </div>
            </div>
            <h2 className="mt-4 text-center text-[18px] font-semibold text-gray-900">
              Alterações não salvas
            </h2>
            <p className="mt-2 text-center text-[14px] text-gray-500">
              Você tem mudanças que ainda não foram salvas. O que deseja fazer?
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveAndLeave}
                className="w-full h-[42px] rounded-lg bg-[#1B2A4A] hover:bg-[#243558] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors duration-150"
              >
                <Check size={16} />
                Salvar e sair
              </button>
              <button
                type="button"
                onClick={handleDiscardAndLeave}
                className="w-full h-[42px] rounded-lg bg-transparent border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600 text-sm transition-colors duration-150"
              >
                Descartar alterações
              </button>
              <button
                type="button"
                onClick={() => setPendingNav(null)}
                className="w-full h-9 bg-transparent text-gray-400 hover:text-gray-600 text-[13px] transition-colors duration-150"
              >
                Continuar editando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarIdentitySection({
  form,
  setForm,
}: {
  form: Agent;
  setForm: (a: Agent) => void;
}) {
  const wa = useWhatsAppProfile();
  const showWAPhoto = wa.connected && !!wa.photoUrl && form.avatarSource !== "custom";
  const IconComp = getAgentIcon(form.icon);

  return (
    <div className="flex items-center gap-5">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative shrink-0">
              <div className="h-16 w-16 rounded-full bg-[hsl(220_45%_15%)] flex items-center justify-center overflow-hidden">
                {showWAPhoto ? (
                  <img
                    src={wa.photoUrl!}
                    alt="Foto do WhatsApp"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <IconComp className="h-7 w-7 text-white" />
                )}
              </div>
              {showWAPhoto && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full bg-[#25D366] ring-2 ring-white flex items-center justify-center"
                  aria-label="Foto do WhatsApp"
                >
                  <MessageCircle className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              <span
                className={
                  "absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white " +
                  (wa.connected ? "bg-emerald-500" : "bg-red-500")
                }
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {wa.loading
              ? "Verificando WhatsApp..."
              : wa.connected
              ? "WhatsApp conectado"
              : "WhatsApp não conectado"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Avatar do Agente
        </Label>
        <p className="text-sm text-foreground mt-1">
          {showWAPhoto
            ? wa.formattedPhone || "Foto do WhatsApp"
            : "Ícone padrão"}
        </p>
      </div>
    </div>
  );
}

