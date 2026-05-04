import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface FieldItem {
  id: string;
  label: string;
  enabled: boolean;
  helper?: string;
  custom?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const initialFields: FieldItem[] = [
  { id: uid(), label: "Nome completo", enabled: true },
  { id: uid(), label: "Telefone", enabled: true, helper: "Já disponível pelo WhatsApp" },
  { id: uid(), label: "E-mail", enabled: true },
  { id: uid(), label: "CPF", enabled: false },
  { id: uid(), label: "Data de nascimento", enabled: false },
  { id: uid(), label: "Cidade/Estado", enabled: false },
];

const groupLabel =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function ColetaDadosSection() {
  const [fields, setFields] = useState<FieldItem[]>(initialFields);
  const [moment, setMoment] = useState<string>("flow");
  const [validateEmail, setValidateEmail] = useState(true);
  const [validatePhone, setValidatePhone] = useState(true);
  const [confirmBeforeSave, setConfirmBeforeSave] = useState(false);
  const [saveCRM, setSaveCRM] = useState(true);
  const [saveServiceCenter, setSaveServiceCenter] = useState(true);

  const updateField = (id: string, patch: Partial<FieldItem>) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const removeField = (id: string) =>
    setFields(fields.filter((f) => f.id !== id));

  const addCustom = () =>
    setFields([
      ...fields,
      { id: uid(), label: "Novo campo", enabled: true, custom: true },
    ]);

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Coleta de Dados
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Defina quais informações do cliente o agente deve capturar em toda conversa.
        </p>
      </div>

      <div className="p-8 space-y-7">
        {/* Dados obrigatórios */}
        <div className="space-y-3">
          <Label className={groupLabel}>Dados obrigatórios</Label>
          <div className="rounded-md border border-input divide-y divide-gray-100 bg-background">
            {fields.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 h-12">
                <Switch
                  checked={f.enabled}
                  onCheckedChange={(c) => updateField(f.id, { enabled: !!c })}
                />
                {f.custom ? (
                  <Input
                    value={f.label}
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                    className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm flex-1"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{f.label}</p>
                    {f.helper && (
                      <p className="text-xs text-muted-foreground">{f.helper}</p>
                    )}
                  </div>
                )}
                {f.custom && (
                  <button
                    type="button"
                    onClick={() => removeField(f.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Adicionar campo personalizado
          </Button>
        </div>

        {/* Momento da coleta */}
        <div className="space-y-3">
          <Label className={groupLabel}>Momento da coleta</Label>
          <RadioGroup value={moment} onValueChange={setMoment} className="space-y-2">
            {[
              {
                v: "start",
                l: "No início da conversa",
                h: "Agente pede os dados antes de iniciar o atendimento",
              },
              {
                v: "flow",
                l: "Ao longo da conversa naturalmente",
                h: "Agente coleta as informações conforme a conversa flui",
              },
              {
                v: "end",
                l: "Ao final, antes de encaminhar",
                h: "Agente confirma os dados antes de transferir ou criar o lead",
              },
            ].map((opt) => (
              <label
                key={opt.v}
                className="flex items-start gap-3 px-3 py-2.5 rounded-md border border-input hover:bg-muted/50 cursor-pointer"
              >
                <RadioGroupItem value={opt.v} id={`moment-${opt.v}`} className="mt-0.5" />
                <div>
                  <p className="text-sm text-foreground">{opt.l}</p>
                  <p className="text-xs text-muted-foreground">{opt.h}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Validação */}
        <div className="space-y-3">
          <Label className={groupLabel}>Validação de dados</Label>
          <div className="rounded-md border border-input divide-y divide-gray-100 bg-background">
            {[
              {
                checked: validateEmail,
                set: setValidateEmail,
                label: "Validar formato de e-mail",
              },
              {
                checked: validatePhone,
                set: setValidatePhone,
                label: "Validar formato de telefone",
              },
              {
                checked: confirmBeforeSave,
                set: setConfirmBeforeSave,
                label: "Confirmar dados com o cliente antes de salvar",
                helper: "O agente repete os dados coletados e pede confirmação",
              },
            ].map((row) => (
              <div key={row.label} className="flex items-start gap-3 px-3 py-2.5 min-h-[48px]">
                <Switch
                  checked={row.checked}
                  onCheckedChange={(c) => row.set(!!c)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm text-foreground">{row.label}</p>
                  {row.helper && (
                    <p className="text-xs text-muted-foreground">{row.helper}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Onde salvar */}
        <div className="space-y-3">
          <Label className={groupLabel}>Onde salvar</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 px-3 h-12 rounded-md border border-input bg-background hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={saveCRM}
                onCheckedChange={(c) => setSaveCRM(!!c)}
              />
              <span className="text-sm">
                CRM — criar ou atualizar lead automaticamente
              </span>
            </label>
            <label className="flex items-center gap-3 px-3 h-12 rounded-md border border-input bg-background hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={saveServiceCenter}
                onCheckedChange={(c) => setSaveServiceCenter(!!c)}
              />
              <span className="text-sm">
                Central de Atendimento — vincular dados à conversa
              </span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
