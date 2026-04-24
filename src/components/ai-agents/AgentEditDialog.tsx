import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Sparkles, Shield, Bot } from "lucide-react";
import { toast } from "sonner";

export interface Agent {
  id: string;
  name: string;
  model: string;
  active: boolean;
  personality?: string;
  rules?: string;
  tone?: string;
}

interface AgentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSave: (agent: Agent) => void;
}

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

export function AgentEditDialog({ open, onOpenChange, agent, onSave }: AgentEditDialogProps) {
  const [form, setForm] = useState<Agent>({
    id: "",
    name: "",
    model: "google/gemini-2.5-flash",
    active: true,
    personality: "",
    rules: "",
    tone: "amigavel",
  });

  useEffect(() => {
    if (agent) {
      setForm({
        personality: "",
        rules: "",
        tone: "amigavel",
        ...agent,
      });
    }
  }, [agent]);

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do agente");
      return;
    }
    onSave(form);
    toast.success("Agente salvo com sucesso");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[880px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-8 pt-7 pb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[hsl(220_45%_15%)] flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Editar Agente IA
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Configure a personalidade, modelo e regras do agente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-8 py-6 space-y-6">
          {/* Identidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              <Select
                value={form.model}
                onValueChange={(v) => setForm({ ...form, model: v })}
              >
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="agent-tone" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tom de Voz
              </Label>
              <Select
                value={form.tone}
                onValueChange={(v) => setForm({ ...form, tone: v })}
              >
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

          {/* Personalidade */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="agent-personality" className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-[hsl(var(--gold))]" />
                Personalidade e Diretrizes
              </Label>
              <span className="text-xs text-muted-foreground">
                Define como o agente se comporta
              </span>
            </div>
            <Textarea
              id="agent-personality"
              value={form.personality}
              onChange={(e) => setForm({ ...form, personality: e.target.value })}
              rows={8}
              placeholder={`Você é um consultor de viagens experiente da Altivus Turismo.
Sua missão é ajudar clientes a planejar viagens memoráveis...

- Sempre se apresente pelo nome
- Pergunte sobre preferências de viagem
- Sugira destinos baseados no perfil`}
              className="font-mono text-[13px] leading-relaxed resize-y min-h-[180px] bg-[hsl(220_15%_98%)]"
            />
          </div>

          {/* Regras */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="agent-rules" className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-destructive" />
                Regras de Conversa
              </Label>
              <span className="text-xs text-muted-foreground">
                Restrições e limites do agente
              </span>
            </div>
            <Textarea
              id="agent-rules"
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={8}
              placeholder={`- Nunca prometa preços sem confirmar com um agente humano
- Não compartilhe dados pessoais de outros clientes
- Não invente informações sobre destinos
- Sempre transfira para humano em caso de reclamação
- Não responda perguntas fora do contexto de viagens`}
              className="font-mono text-[13px] leading-relaxed resize-y min-h-[180px] bg-[hsl(220_15%_98%)]"
            />
          </div>
        </div>

        <DialogFooter className="px-8 py-5 border-t border-border/60 bg-[hsl(220_15%_98%)]">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[hsl(220_45%_15%)] hover:bg-[hsl(220_45%_22%)] text-white"
          >
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
