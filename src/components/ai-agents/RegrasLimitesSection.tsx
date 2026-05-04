import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface ToggleRow {
  key: string;
  label: string;
  description?: string;
  enabled: boolean;
  inlineNumber?: number;
}

const groupLabel =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

interface RegrasLimitesSectionProps {
  initialRules?: string;
}

export function RegrasLimitesSection({ initialRules = "" }: RegrasLimitesSectionProps) {
  const [security, setSecurity] = useState<ToggleRow[]>([
    {
      key: "no-prices",
      label: "Nunca compartilhar preços sem validação de um humano",
      description: "O agente nunca confirma valores diretamente ao cliente.",
      enabled: true,
    },
    {
      key: "no-confirm",
      label: "Nunca confirmar reservas ou pagamentos",
      description: "Reservas e pagamentos sempre passam por um humano.",
      enabled: true,
    },
    {
      key: "no-offtopic",
      label: "Não responder sobre assuntos fora do escopo",
      description: "Mantém a conversa focada em viagens e serviços da agência.",
      enabled: true,
    },
    {
      key: "no-other-clients",
      label: "Não compartilhar dados de outros clientes",
      description: "Protege a privacidade das demais conversas.",
      enabled: true,
    },
    {
      key: "no-invent",
      label: "Nunca inventar informações sobre destinos ou serviços",
      description: "Quando não souber, deve dizer que vai consultar a equipe.",
      enabled: true,
    },
  ]);

  const [escalation, setEscalation] = useState<ToggleRow[]>([
    {
      key: "complaints",
      label: "Transferir para humano em reclamações",
      enabled: true,
    },
    {
      key: "no-resolution",
      label: "Transferir após X mensagens sem resolução",
      enabled: true,
      inlineNumber: 10,
    },
    {
      key: "explicit",
      label: "Transferir se cliente pedir explicitamente",
      enabled: true,
    },
    {
      key: "notify-urgent",
      label: "Notificar gestor em situações de urgência",
      enabled: true,
    },
  ]);

  const [maxMessages, setMaxMessages] = useState(20);
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [timeoutMsg, setTimeoutMsg] = useState("");
  const [customRules, setCustomRules] = useState(initialRules);

  const updateRow = (
    list: ToggleRow[],
    setList: (l: ToggleRow[]) => void,
    key: string,
    patch: Partial<ToggleRow>
  ) => setList(list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Regras e Limites
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Restrições e limites que o agente nunca deve violar.
        </p>
      </div>

      <div className="p-8 space-y-7">
        {/* Segurança */}
        <div className="space-y-3">
          <Label className={groupLabel}>Regras de Segurança</Label>
          <div className="rounded-md border border-input divide-y divide-gray-100 bg-background">
            {security.map((r) => (
              <div key={r.key} className="flex items-start gap-3 px-3 py-3">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(c) =>
                    updateRow(security, setSecurity, r.key, { enabled: !!c })
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{r.label}</p>
                  {r.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalonamento */}
        <div className="space-y-3">
          <Label className={groupLabel}>Regras de Escalonamento</Label>
          <div className="rounded-md border border-input divide-y divide-gray-100 bg-background">
            {escalation.map((r) => (
              <div key={r.key} className="flex items-center gap-3 px-3 py-3">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(c) =>
                    updateRow(escalation, setEscalation, r.key, { enabled: !!c })
                  }
                />
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{r.label}</p>
                  {r.inlineNumber !== undefined && r.enabled && (
                    <Input
                      type="number"
                      min={1}
                      value={r.inlineNumber}
                      onChange={(e) =>
                        updateRow(escalation, setEscalation, r.key, {
                          inlineNumber: Number(e.target.value) || 0,
                        })
                      }
                      className="h-8 w-20"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Limites operacionais */}
        <div className="space-y-3">
          <Label className={groupLabel}>Limites Operacionais</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Máximo de mensagens por conversa
              </Label>
              <Input
                type="number"
                min={1}
                value={maxMessages}
                onChange={(e) => setMaxMessages(Number(e.target.value) || 0)}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                Após este número, o agente sugere atendimento humano.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Timeout de inatividade (minutos)
              </Label>
              <Input
                type="number"
                min={1}
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(Number(e.target.value) || 0)}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mensagem de timeout
            </Label>
            <Textarea
              value={timeoutMsg}
              onChange={(e) => setTimeoutMsg(e.target.value)}
              rows={2}
              placeholder="Ex: Oi! Ainda está aí? Posso ajudar com mais alguma coisa?"
              className="bg-[hsl(220_15%_98%)] resize-y"
            />
          </div>
        </div>

        {/* Personalizadas */}
        <div className="space-y-2">
          <Label className={groupLabel}>Regras Personalizadas</Label>
          <Textarea
            value={customRules}
            onChange={(e) => setCustomRules(e.target.value)}
            rows={5}
            placeholder={`- Nunca prometa preços sem confirmar com um agente humano\n- Não compartilhe dados pessoais de outros clientes\n- Não invente informações sobre destinos`}
            className="font-mono text-[13px] leading-relaxed resize-y min-h-[140px] bg-[hsl(220_15%_98%)]"
          />
          <p className="text-xs text-muted-foreground">
            Adicione regras específicas em formato livre.
          </p>
        </div>
      </div>
    </section>
  );
}
