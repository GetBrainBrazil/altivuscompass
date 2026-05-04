import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  GitBranch, ClipboardList, Plug, BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  | "testar";

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

  const [activeSection, setActiveSection] = useState<SectionKey>("identidade");
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(form));
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const isDirty = JSON.stringify(form) !== savedSnapshot;

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
      setSavedSnapshot(JSON.stringify(form));
      toast.success("Configurações salvas com sucesso", { position: "top-right", duration: 3000 });
    } catch {
      toast.error("Erro ao salvar configurações. Tente novamente.", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty && !confirm("Você tem alterações não salvas. Deseja sair sem salvar?")) return;
    navigate("/ai-agents");
  };

  const handleDelete = () => {
    try {
      const list: Agent[] = JSON.parse(sessionStorage.getItem(LIST_KEY) || "[]");
      const next = list.filter((a) => a.id !== form.id);
      sessionStorage.setItem(LIST_KEY, JSON.stringify(next));
    } catch {}
    toast.success(`Agente "${form.name || "sem nome"}" excluído`);
    navigate("/ai-agents");
  };

  return (
    <div className="min-h-screen bg-[hsl(220_15%_97%)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-border/60">
        <div className="max-w-[1100px] mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-[hsl(220_45%_15%)] flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight truncate">
                {form.name || "Agente sem nome"}
              </h1>
              <p className="text-xs text-muted-foreground">
                Gerencie seu agente de inteligência artificial
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Alterações não salvas
              </span>
            )}
            <Button
              variant="outline"
              className="h-9 border-border/70 text-foreground hover:bg-muted"
              onClick={() => navigate("/whatsapp-connection")}
            >
              <MessageCircle className="h-4 w-4 sm:mr-2 text-[hsl(142_70%_40%)]" />
              <span className="hidden sm:inline">Conexão WhatsApp</span>
            </Button>
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
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
            <Button variant="outline" onClick={handleCancel} className="h-9">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="relative h-9 bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] text-white"
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
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-10 flex flex-col md:flex-row gap-8">
        {/* Left nav */}
        <aside className="md:w-[240px] md:shrink-0">
          <nav
            className="md:sticky md:top-24 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible -mx-2 px-2 md:mx-0 md:px-0"
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
                  className={
                    "flex items-center gap-[10px] px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors text-left shrink-0 " +
                    (isActive
                      ? "bg-[hsl(220_45%_15%)] text-white"
                      : "text-gray-500 hover:bg-gray-100 bg-transparent")
                  }
                >
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                  <span className="font-medium">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content panel */}
        <div className="flex-1 min-w-0 space-y-8">
        {activeSection === "identidade" && (
        <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border/60">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Identidade
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Como este agente é identificado e qual modelo de IA o alimenta.
            </p>
          </div>
          <div className="p-8 space-y-6">
            {/* Avatar */}
            <div className="flex items-start gap-5">
              {(() => {
                const IconComp = getAgentIcon(form.icon);
                return (
                  <div className="h-16 w-16 rounded-full bg-[hsl(220_45%_15%)] flex items-center justify-center shrink-0">
                    <IconComp className="h-7 w-7 text-white" />
                  </div>
                );
              })()}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ícone do Agente
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      Alterar ícone
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-3" align="start">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                      Escolha um ícone
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {AGENT_ICONS.map(({ key, Icon }) => {
                        const selected = (form.icon ?? "bot") === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setForm({ ...form, icon: key })}
                            className={
                              "h-12 w-12 rounded-full flex items-center justify-center transition-all " +
                              (selected
                                ? "bg-[hsl(220_45%_15%)] text-white ring-2 ring-[hsl(220_45%_15%)] ring-offset-2"
                                : "bg-muted text-muted-foreground hover:bg-muted/70")
                            }
                            aria-label={key}
                          >
                            <Icon className="h-5 w-5" />
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

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

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </Label>
              <div className="h-10 flex items-center gap-3 px-3 rounded-md border border-input bg-background">
                <Switch
                  checked={form.active}
                  onCheckedChange={(c) => setForm({ ...form, active: c })}
                />
                <span className="text-sm text-foreground">
                  {form.active ? "Ativo — atendendo conversas" : "Inativo"}
                </span>
              </div>
            </div>
          </div>
        </section>
        )}

        {activeSection === "comunicacao" && (
          <ComunicacaoSection
            initialPersonality={form.personality}
            initialTone={form.tone}
            value={form.config?.comunicacao}
            onChange={(v) =>
              setForm((f) => ({ ...f, config: { ...(f.config || {}), comunicacao: v } }))
            }
          />
        )}

        {activeSection === "regras" && (
          <RegrasLimitesSection
            initialRules={form.rules}
            value={form.config?.regras}
            onChange={(v) =>
              setForm((f) => ({ ...f, config: { ...(f.config || {}), regras: v } }))
            }
          />
        )}

        {activeSection === "testar" && <TestarAgenteSection />}

        {activeSection === "fluxos" && (
          <FluxosAtendimentoSection
            value={form.config?.fluxos}
            onChange={(v) =>
              setForm((f) => ({ ...f, config: { ...(f.config || {}), fluxos: v } }))
            }
          />
        )}

        {activeSection === "coleta" && (
          <ColetaDadosSection
            value={form.config?.coleta}
            onChange={(v) =>
              setForm((f) => ({ ...f, config: { ...(f.config || {}), coleta: v } }))
            }
          />
        )}

        {activeSection === "integracoes" && (
          <IntegracoesSection
            value={form.config?.integracoes}
            onChange={(v) =>
              setForm((f) => ({ ...f, config: { ...(f.config || {}), integracoes: v } }))
            }
          />
        )}

        {activeSection === "metricas" && <MetricasSection />}
        </div>
      </div>
    </div>
  );
}
