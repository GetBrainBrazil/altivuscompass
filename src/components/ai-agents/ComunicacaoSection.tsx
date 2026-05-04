import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Smile, Briefcase, Sparkles, GraduationCap, Pencil, type LucideIcon } from "lucide-react";

const TONES: {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  name: string;
  example: string;
}[] = [
  {
    id: "amigavel",
    icon: Smile,
    iconBg: "#EFF6FF",
    iconColor: "#3B82F6",
    name: "Amigável e acolhedor",
    example: "Oi! Que bom falar com você! Como posso ajudar?",
  },
  {
    id: "profissional",
    icon: Briefcase,
    iconBg: "#F1F5F9",
    iconColor: "#475569",
    name: "Profissional e cordial",
    example: "Olá, boas-vindas à Altivus Turismo. Como posso auxiliá-lo?",
  },
  {
    id: "entusiasmado",
    icon: Sparkles,
    iconBg: "#FFFBEB",
    iconColor: "#F59E0B",
    name: "Entusiasmado e inspirador",
    example: "Olá! Pronto para a viagem dos sonhos? 🌍",
  },
  {
    id: "consultivo",
    icon: GraduationCap,
    iconBg: "#ECFDF5",
    iconColor: "#059669",
    name: "Consultivo e especialista",
    example: "Sou especialista em viagens e vou encontrar a melhor opção.",
  },
  {
    id: "personalizado",
    icon: Pencil,
    iconBg: "#FAF5FF",
    iconColor: "#A855F7",
    name: "Personalizado",
    example: "Defina seu próprio tom de voz.",
  },
];

const DAYS = [
  { key: "seg", label: "Seg", weekday: true },
  { key: "ter", label: "Ter", weekday: true },
  { key: "qua", label: "Qua", weekday: true },
  { key: "qui", label: "Qui", weekday: true },
  { key: "sex", label: "Sex", weekday: true },
  { key: "sab", label: "Sáb", weekday: false },
  { key: "dom", label: "Dom", weekday: false },
];

interface ComunicacaoSectionProps {
  initialPersonality?: string;
  initialTone?: string;
}

export function ComunicacaoSection({
  initialPersonality = "",
  initialTone = "amigavel",
}: ComunicacaoSectionProps) {
  const startsCustom = !!initialPersonality && !TONES.some((t) => t.id === initialTone);
  const [tone, setTone] = useState<string>(
    startsCustom ? "personalizado" : initialTone || "amigavel"
  );
  const [customTone, setCustomTone] = useState<string>(initialPersonality);

  const [displayName, setDisplayName] = useState("");
  const [languages, setLanguages] = useState<Record<string, boolean>>({
    pt: true,
    en: false,
    es: false,
  });
  const [autoDetectLang, setAutoDetectLang] = useState(false);
  const [useEmojis, setUseEmojis] = useState(true);
  const [maxLength, setMaxLength] = useState(300);

  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [holdMsg, setHoldMsg] = useState("");
  const [offHoursEnabled, setOffHoursEnabled] = useState(false);
  const [offHoursMsg, setOffHoursMsg] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>(
    Object.fromEntries(DAYS.map((d) => [d.key, d.weekday]))
  );

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Comunicação
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Defina a personalidade, idioma e mensagens padrão do agente.
        </p>
      </div>

      <div className="p-8 space-y-7">
        {/* Tom de voz */}
        <div className="space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tom de voz
          </Label>
          <div className="flex flex-wrap gap-3">
            {TONES.map((t) => {
              const selected = tone === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "w-[180px] min-h-[140px] text-left rounded-lg p-3 transition-all flex flex-col",
                    selected
                      ? "border-2 border-[#1B2A4A] bg-[rgba(27,42,74,0.03)]"
                      : "border border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center mb-2"
                    style={{ backgroundColor: t.iconBg }}
                  >
                    <Icon size={18} style={{ color: t.iconColor }} strokeWidth={2} />
                  </div>
                  <div className="text-sm font-semibold text-foreground leading-tight">
                    {t.name}
                  </div>
                  <p className="mt-1.5 text-[11px] italic text-gray-500 leading-snug">
                    "{t.example}"
                  </p>
                </button>
              );
            })}
          </div>
          {tone === "personalizado" && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Descreva o tom de voz desejado
              </Label>
              <Textarea
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                rows={5}
                placeholder="Ex: Tom acolhedor e leve, com toques de humor sutil. Sempre se apresente pelo nome..."
                className="bg-[hsl(220_15%_98%)] resize-y min-h-[120px]"
              />
            </div>
          )}
        </div>

        {/* Nome de apresentação */}
        <div className="space-y-2">
          <Label
            htmlFor="display-name"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Nome de apresentação
          </Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex: Lia, Ana, Assistente Altivus"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Como o agente se apresenta ao cliente.
          </p>
        </div>

        {/* Idiomas */}
        <div className="space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Idiomas
          </Label>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "pt", label: "Português", locked: true },
              { key: "en", label: "Inglês", locked: false },
              { key: "es", label: "Espanhol", locked: false },
            ].map((l) => (
              <label
                key={l.key}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background",
                  l.locked ? "opacity-90" : "cursor-pointer hover:bg-muted/50"
                )}
              >
                <Checkbox
                  checked={languages[l.key]}
                  disabled={l.locked}
                  onCheckedChange={(c) =>
                    !l.locked && setLanguages({ ...languages, [l.key]: !!c })
                  }
                />
                <span className="text-sm">{l.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Switch checked={autoDetectLang} onCheckedChange={setAutoDetectLang} />
            <span className="text-sm">
              Detectar idioma automaticamente e responder no mesmo idioma
            </span>
          </div>
        </div>

        {/* Emojis */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Usar emojis
          </Label>
          <div className="flex items-center gap-3 px-3 h-10 rounded-md border border-input bg-background">
            <Switch checked={useEmojis} onCheckedChange={setUseEmojis} />
            <span className="text-sm">
              {useEmojis ? "Ativado" : "Desativado"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Permitir que o agente use emojis nas respostas.
          </p>
        </div>

        {/* Tamanho máximo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tamanho máximo de mensagem
            </Label>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {maxLength} <span className="text-muted-foreground font-normal">caracteres</span>
            </span>
          </div>
          <Slider
            value={[maxLength]}
            min={50}
            max={500}
            step={10}
            onValueChange={(v) => setMaxLength(v[0] ?? 300)}
          />
          <p className="text-xs text-muted-foreground">
            Limite de caracteres por mensagem para manter respostas concisas no WhatsApp.
          </p>
        </div>

        {/* Mensagens padrão */}
        <div className="pt-2 border-t border-border/60">
          <h3 className="text-sm font-semibold text-foreground mt-5 mb-4">
            Mensagens Padrão
          </h3>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mensagem de boas-vindas
              </Label>
              <Textarea
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                rows={3}
                placeholder="Ex: Olá! Sou a Lia da Altivus Turismo. Como posso te ajudar hoje?"
                className="bg-[hsl(220_15%_98%)] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Primeira mensagem enviada ao iniciar uma conversa.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mensagem de espera (transferência)
              </Label>
              <Textarea
                value={holdMsg}
                onChange={(e) => setHoldMsg(e.target.value)}
                rows={2}
                placeholder="Ex: Vou te conectar com um dos nossos consultores. Aguarde um momento!"
                className="bg-[hsl(220_15%_98%)] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Enviada ao transferir para um atendente humano.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={offHoursEnabled}
                  onCheckedChange={setOffHoursEnabled}
                />
                <span className="text-sm font-medium">
                  Ativar mensagem fora do horário
                </span>
              </div>

              {offHoursEnabled && (
                <div className="space-y-4 pl-1 animate-accordion-down">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Mensagem fora do horário
                    </Label>
                    <Textarea
                      value={offHoursMsg}
                      onChange={(e) => setOffHoursMsg(e.target.value)}
                      rows={2}
                      placeholder="Ex: Nosso horário de atendimento é de segunda a sexta, 9h às 18h. Deixe sua mensagem!"
                      className="bg-[hsl(220_15%_98%)] resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enviada quando o atendimento está fechado.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Início
                      </Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Fim
                      </Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Dias de atendimento
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((d) => {
                        const on = activeDays[d.key];
                        return (
                          <button
                            key={d.key}
                            type="button"
                            onClick={() =>
                              setActiveDays({ ...activeDays, [d.key]: !on })
                            }
                            className={cn(
                              "h-9 w-12 rounded-md text-xs font-semibold border transition-colors",
                              on
                                ? "bg-[hsl(220_45%_15%)] text-white border-[hsl(220_45%_15%)]"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-muted/50"
                            )}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
