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
} from "lucide-react";
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

const SECTIONS: { key: SectionKey; icon: string; label: string }[] = [
  { key: "identidade", icon: "🤖", label: "Identidade" },
  { key: "fluxos", icon: "🎯", label: "Fluxos de Atendimento" },
  { key: "comunicacao", icon: "💬", label: "Comunicação" },
  { key: "coleta", icon: "📋", label: "Coleta de Dados" },
  { key: "regras", icon: "⚡", label: "Regras e Limites" },
  { key: "integracoes", icon: "🔗", label: "Integrações" },
  { key: "metricas", icon: "📊", label: "Métricas" },
  { key: "testar", icon: "🧪", label: "Testar Agente" },
];

const emptyAgent = (): Agent => ({
  id: crypto.randomUUID(),
  name: "",
  model: "google/gemini-2.5-flash",
  active: true,
  personality: "",
  rules: "",
  tone: "amigavel",
});

export default function AIAgentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [form, setForm] = useState<Agent>(() => {
    if (isNew) return emptyAgent();
    try {
      const list: Agent[] = JSON.parse(sessionStorage.getItem(LIST_KEY) || "[]");
      const found = list.find((a) => a.id === id);
      if (found) return { personality: "", rules: "", tone: "amigavel", ...found };
    } catch {}
    return { ...emptyAgent(), id: id! };
  });

  const [activeSection, setActiveSection] = useState<SectionKey>("identidade");
  const initialSnapshot = useMemo(() => JSON.stringify(form), []);
  const isDirty = JSON.stringify(form) !== initialSnapshot;

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do agente");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY + ":save", JSON.stringify(form));
    toast.success(isNew ? "Agente criado com sucesso" : "Agente atualizado");
    navigate("/ai-agents");
  };

  const handleCancel = () => {
    if (isDirty && !confirm("Descartar alterações não salvas?")) return;
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
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleCancel}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-10 w-10 rounded-lg bg-[hsl(220_45%_15%)] flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight truncate">
                {isNew ? "Novo Agente IA" : form.name || "Agente sem nome"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isNew ? "Configure o comportamento do novo agente" : "Edite as configurações do agente"}
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
              className="h-9 bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] text-white"
            >
              Salvar Configurações
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
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveSection(s.key)}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors text-left shrink-0 " +
                    (isActive
                      ? "bg-[hsl(220_45%_15%)] text-white"
                      : "text-gray-600 hover:bg-gray-100 bg-transparent")
                  }
                >
                  <span className="text-base leading-none">{s.icon}</span>
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
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="agent-name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nome do Agente
              </Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Atendente Principal"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-model" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Modelo de IA
              </Label>
              <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                <SelectTrigger id="agent-model" className="h-10">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-tone" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tom de Voz
              </Label>
              <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                <SelectTrigger id="agent-tone" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  {form.active ? "Ativo — atendendo conversas" : "Inativo — pausado"}
                </span>
              </div>
            </div>
          </div>
        </section>
        )}

        {activeSection === "comunicacao" && (
        <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border/60">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[hsl(var(--gold))]" />
              Comunicação — Personalidade e Diretrizes
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Define o tom, missão e estilo de comunicação do agente.
            </p>
          </div>
          <div className="p-8">
            <Textarea
              id="agent-personality"
              value={form.personality}
              onChange={(e) => setForm({ ...form, personality: e.target.value })}
              rows={10}
              placeholder={`Você é um consultor de viagens experiente da Altivus Turismo.\nSua missão é ajudar clientes a planejar viagens memoráveis...\n\n- Sempre se apresente pelo nome\n- Pergunte sobre preferências de viagem\n- Sugira destinos baseados no perfil`}
              className="font-mono text-[13px] leading-relaxed resize-y min-h-[220px] bg-[hsl(220_15%_98%)]"
            />
          </div>
        </section>
        )}

        {activeSection === "regras" && (
        <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border/60">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" />
              Regras e Limites
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Restrições e limites que o agente nunca deve violar.
            </p>
          </div>
          <div className="p-8">
            <Textarea
              id="agent-rules"
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={10}
              placeholder={`- Nunca prometa preços sem confirmar com um agente humano\n- Não compartilhe dados pessoais de outros clientes\n- Não invente informações sobre destinos\n- Sempre transfira para humano em caso de reclamação\n- Não responda perguntas fora do contexto de viagens`}
              className="font-mono text-[13px] leading-relaxed resize-y min-h-[220px] bg-[hsl(220_15%_98%)]"
            />
          </div>
        </section>
        )}

        {activeSection === "testar" && (
        <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-border/60">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Testar Agente
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Simule uma conversa para validar personalidade e regras antes de ativar.
            </p>
          </div>
          <div className="p-8">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => toast.info("Modo de teste em breve")}
            >
              <FlaskConical className="h-4 w-4 mr-2" />
              Iniciar teste
            </Button>
          </div>
        </section>
        )}

        {(activeSection === "fluxos" ||
          activeSection === "coleta" ||
          activeSection === "integracoes" ||
          activeSection === "metricas") && (
          <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-border/60">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {SECTIONS.find((s) => s.key === activeSection)?.label}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Em breve — esta seção será configurada nos próximos passos.
              </p>
            </div>
            <div className="p-8 text-sm text-muted-foreground">
              Conteúdo em breve.
            </div>
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
