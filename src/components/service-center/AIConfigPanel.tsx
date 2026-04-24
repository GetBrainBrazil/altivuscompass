import { useEffect, useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, ShieldAlert, MessageCircle, Save, X, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "service-center.ai-config";

interface AIConfig {
  systemPrompt: string;
  restrictedRules: string[];
  toneOfVoice: string;
}

const DEFAULT_CONFIG: AIConfig = {
  systemPrompt:
    "Você é um consultor de viagens da Altivus Turismo. Seu objetivo é qualificar leads, entender o desejo da viagem (destino, datas, número de pessoas, orçamento) e encaminhar ao consultor humano quando o lead estiver pronto para fechar. Seja cordial, use emojis com moderação e responda sempre em português.",
  restrictedRules: [
    "Não prometer preços fechados",
    "Não confirmar disponibilidade sem consultar",
    "Não compartilhar dados internos",
  ],
  toneOfVoice: "amigavel-profissional",
};

const TONE_OPTIONS = [
  { value: "amigavel-profissional", label: "Amigável & Profissional", desc: "Equilíbrio entre simpatia e expertise" },
  { value: "formal", label: "Formal & Consultivo", desc: "Tom corporativo, sem gírias" },
  { value: "descontraido", label: "Descontraído & Próximo", desc: "Conversa leve, como um amigo" },
  { value: "luxo", label: "Premium & Sofisticado", desc: "Elegante, focado em alto padrão" },
  { value: "direto", label: "Direto & Objetivo", desc: "Respostas curtas e práticas" },
];

export default function AIConfigPanel() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [tagInput, setTagInput] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = <K extends keyof AIConfig>(key: K, value: AIConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setDirty(true);
  };

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (config.restrictedRules.includes(v)) {
      setTagInput("");
      return;
    }
    update("restrictedRules", [...config.restrictedRules, v]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    update(
      "restrictedRules",
      config.restrictedRules.filter((t) => t !== tag),
    );
  };

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !tagInput && config.restrictedRules.length) {
      removeTag(config.restrictedRules[config.restrictedRules.length - 1]);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setDirty(false);
      toast.success("Configurações da IA salvas com sucesso");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
  };

  const selectedTone = TONE_OPTIONS.find((t) => t.value === config.toneOfVoice);

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--navy))] text-[hsl(var(--cream))] flex items-center justify-center shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Configurações da IA</h1>
              <p className="text-xs text-muted-foreground">
                Painel de engenharia de prompt do agente de atendimento.
              </p>
            </div>
          </div>
          {dirty && (
            <span className="text-[11px] font-medium text-warning bg-warning/10 border border-warning/30 px-2.5 py-1 rounded-full">
              Alterações não salvas
            </span>
          )}
        </div>
      </header>

      {/* Form */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
          {/* System Prompt */}
          <section className="rounded-2xl bg-white border shadow-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <Label htmlFor="system-prompt" className="text-sm font-semibold">
                  Prompt de Sistema
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define a personalidade, missão e comportamento principal do agente.
                </p>
              </div>
            </div>
            <Textarea
              id="system-prompt"
              value={config.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              rows={8}
              placeholder="Descreva como a IA deve se comportar..."
              className="font-mono text-xs leading-relaxed resize-y min-h-[180px]"
            />
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>Instruções claras geram respostas mais consistentes.</span>
              <span>{config.systemPrompt.length} caracteres</span>
            </div>
          </section>

          {/* Restricted Rules */}
          <section className="rounded-2xl bg-white border shadow-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <Label htmlFor="restricted-input" className="text-sm font-semibold">
                  Regras Restritas
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  O que a IA <strong>não</strong> pode fazer. Pressione Enter para adicionar.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 min-h-[88px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 transition-all">
              <div className="flex flex-wrap gap-1.5">
                {config.restrictedRules.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 pl-3 pr-1.5 py-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center transition-colors"
                      aria-label={`Remover ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                  <Input
                    id="restricted-input"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKeyDown}
                    placeholder={
                      config.restrictedRules.length === 0
                        ? "Ex: Não prometer descontos..."
                        : "Adicionar regra..."
                    }
                    className="h-7 border-0 bg-transparent shadow-none focus-visible:ring-0 px-1.5 text-xs placeholder:text-muted-foreground/70"
                  />
                  {tagInput.trim() && (
                    <button
                      type="button"
                      onClick={addTag}
                      className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shrink-0"
                      aria-label="Adicionar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {config.restrictedRules.length} regra
              {config.restrictedRules.length !== 1 && "s"} ativa
              {config.restrictedRules.length !== 1 && "s"}.
            </p>
          </section>

          {/* Tone of voice */}
          <section className="rounded-2xl bg-white border shadow-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-9 w-9 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <Label htmlFor="tone" className="text-sm font-semibold">
                  Tom de Voz
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define o estilo de comunicação do agente nas respostas.
                </p>
              </div>
            </div>
            <Select value={config.toneOfVoice} onValueChange={(v) => update("toneOfVoice", v)}>
              <SelectTrigger id="tone" className="h-11">
                <SelectValue placeholder="Selecione um tom..." />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{t.label}</span>
                      <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTone && (
              <p className="mt-2 text-[11px] text-muted-foreground italic">
                "{selectedTone.desc}"
              </p>
            )}
          </section>
        </div>
      </ScrollArea>

      {/* Footer action bar */}
      <footer className="border-t bg-white/90 backdrop-blur-sm px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            As alterações afetam novas conversas iniciadas pela IA.
          </p>
          <Button
            onClick={handleSave}
            disabled={!dirty}
            size="lg"
            className="gap-2 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90 shadow-md px-6"
          >
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </footer>
    </div>
  );
}
