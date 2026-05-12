import { useEffect, useState, KeyboardEvent } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type DetectionMethod = "ai" | "ask" | "menu";

interface ChecklistItem {
  id: string;
  label: string;
  enabled: boolean;
}

interface FlowState {
  active: boolean;
  expanded: boolean;
  priority: string;
  questions: ChecklistItem[];
  closingMessage: string;
}

interface QuoteFlow extends FlowState {
  action: string;
  owner: string;
}

interface SupportFlow extends FlowState {
  categories: ChecklistItem[];
  collect: ChecklistItem[];
  action: string;
  slaMinutes: number;
}

interface ProspectFlow extends FlowState {
  strategy: string;
  action: string;
  maxMinutes: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultQuoteQuestions: ChecklistItem[] = [
  "Destino desejado",
  "Data/período da viagem",
  "Número de viajantes",
  "Tipo de viagem (lazer, negócios, lua de mel, família)",
  "Orçamento estimado",
  "Preferência de hospedagem",
  "Precisa de aéreo?",
  "Precisa de transfer?",
  "Precisa de seguro viagem?",
].map((label) => ({ id: uid(), label, enabled: true }));

const defaultSupportCategories: ChecklistItem[] = [
  "Problema com voo (atraso, cancelamento, remarcação)",
  "Problema com hospedagem",
  "Problema com transfer/transporte",
  "Emergência médica ou seguro",
  "Documentação (visto, passaporte)",
  "Reclamação geral",
  "Outro",
].map((label) => ({ id: uid(), label, enabled: true }));

const defaultSupportCollect: ChecklistItem[] = [
  "Nome do cliente",
  "Número da reserva/pedido",
  "Descrição do problema",
  "Localização atual",
  "Urgência percebida",
].map((label) => ({ id: uid(), label, enabled: true }));

const defaultProspectQuestions: ChecklistItem[] = [
  "Que tipo de experiência busca? (praia, aventura, cultural, romântica)",
  "Preferência de continente/região?",
  "Qual período do ano?",
  "Viaja sozinho, casal, família ou grupo?",
  "Já viajou para fora do Brasil?",
  "Faixa de orçamento por pessoa",
].map((label) => ({ id: uid(), label, enabled: true }));

const PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const QUOTE_ACTIONS = [
  "Criar lead no CRM automaticamente",
  "Criar lead + gerar cotação rascunho",
  "Transferir para atendente humano",
  "Enviar resumo por e-mail ao responsável",
];

const SUPPORT_ACTIONS = [
  "Transferir imediatamente para humano",
  "Tentar resolver + transferir se não conseguir",
  "Notificar responsável + continuar atendimento",
];

const PROSPECT_ACTIONS = [
  "Converter para lead com destinos sugeridos",
  "Agendar callback com consultor",
  "Enviar sugestões por WhatsApp",
];

const TEAM = [
  "Equipe de Vendas",
  "Atendente Plantão",
  "Consultor Sênior",
  "Não atribuir",
];

export interface FluxosValue {
  detection: DetectionMethod;
  keywords: string[];
  quote: QuoteFlow;
  support: SupportFlow;
  prospect: ProspectFlow;
}

interface Props {
  value?: Partial<FluxosValue>;
  onChange?: (v: FluxosValue) => void;
}

export function FluxosAtendimentoSection({ value, onChange }: Props = {}) {
  const [detection, setDetection] = useState<DetectionMethod>(value?.detection ?? "ai");
  const [keywords, setKeywords] = useState<string[]>(value?.keywords ?? [
    "urgente", "emergência", "cancelado", "problema", "ajuda", "socorro",
  ]);
  const [keywordDraft, setKeywordDraft] = useState("");

  const [quote, setQuote] = useState<QuoteFlow>(value?.quote ?? {
    active: true,
    expanded: false,
    priority: "normal",
    questions: defaultQuoteQuestions,
    action: QUOTE_ACTIONS[0],
    owner: TEAM[0],
    closingMessage: "",
  });

  const [support, setSupport] = useState<SupportFlow>(value?.support ?? {
    active: true,
    expanded: false,
    priority: "urgente",
    questions: [],
    categories: defaultSupportCategories,
    collect: defaultSupportCollect,
    action: SUPPORT_ACTIONS[0],
    slaMinutes: 5,
    closingMessage: "",
  });

  const [prospect, setProspect] = useState<ProspectFlow>(value?.prospect ?? {
    active: true,
    expanded: false,
    priority: "normal",
    questions: defaultProspectQuestions,
    strategy: "explore",
    action: PROSPECT_ACTIONS[0],
    maxMinutes: 15,
    closingMessage: "",
  });

  useEffect(() => {
    onChange?.({ detection, keywords, quote, support, prospect });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection, keywords, quote, support, prospect]);

  const addKeyword = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = keywordDraft.trim().toLowerCase();
      if (v && !keywords.includes(v)) setKeywords([...keywords, v]);
      setKeywordDraft("");
    } else if (e.key === "Backspace" && !keywordDraft && keywords.length) {
      setKeywords(keywords.slice(0, -1));
    }
  };

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Fluxos de Atendimento
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure como o agente identifica e conduz cada tipo de conversa.
        </p>
      </div>

      <div className="p-8 space-y-6">
        {/* Detection card */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Detecção de Fluxo</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Como o agente identifica o tipo de atendimento
            </Label>
            <RadioGroup
              value={detection}
              onValueChange={(v) => setDetection(v as DetectionMethod)}
              className="space-y-2"
            >
              {[
                { v: "ai", l: "IA detecta automaticamente pela conversa" },
                { v: "ask", l: "Perguntar ao cliente no início" },
                { v: "menu", l: "Menu de opções numerado" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-start gap-3 px-3 py-2 rounded-md border border-input hover:bg-muted/50 cursor-pointer"
                >
                  <RadioGroupItem value={opt.v} id={`det-${opt.v}`} className="mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm">{opt.l}</span>
                    {opt.v === "menu" && detection === "menu" && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <li>1 - Nova Cotação</li>
                        <li>2 - Preciso de informações da minha viagem já contratada</li>
                        <li>3 - Estou em viagem e preciso de suporte</li>
                        <li>4 - Solicitações e informações de pós venda</li>
                        <li>5 - Falar com um Atendente</li>
                      </ul>
                    )}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Palavras-chave de urgência
            </Label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-input bg-background min-h-[44px]">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[hsl(220_45%_15%)] text-white text-xs"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => setKeywords(keywords.filter((x) => x !== k))}
                    className="hover:opacity-70"
                    aria-label={`Remover ${k}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                onKeyDown={addKeyword}
                placeholder="Digite e pressione Enter..."
                className="flex-1 min-w-[140px] bg-transparent outline-none text-sm px-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Quando detectadas, a conversa é direcionada automaticamente para o fluxo de Suporte.
            </p>
          </div>
        </div>

        {/* Flow cards */}
        <div className="space-y-4">
          <FlowCard
            dotClass="bg-emerald-500"
            title="Nova Cotação"
            subtitle="Lead ou prospect quer fazer uma viagem"
            active={quote.active}
            expanded={quote.expanded}
            onToggleActive={(v) => setQuote({ ...quote, active: v })}
            onToggleExpand={() => setQuote({ ...quote, expanded: !quote.expanded })}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PriorityField
                value={quote.priority}
                onChange={(v) => setQuote({ ...quote, priority: v })}
              />
              <DropdownField
                label="Responsável padrão"
                value={quote.owner}
                onChange={(v) => setQuote({ ...quote, owner: v })}
                options={TEAM}
              />
            </div>

            <ChecklistEditor
              label="Perguntas obrigatórias"
              items={quote.questions}
              onChange={(items) => setQuote({ ...quote, questions: items })}
              addLabel="Adicionar pergunta"
            />

            <DropdownField
              label="Ação ao concluir coleta"
              value={quote.action}
              onChange={(v) => setQuote({ ...quote, action: v })}
              options={QUOTE_ACTIONS}
            />

            <TextareaField
              label="Mensagem de encerramento"
              value={quote.closingMessage}
              onChange={(v) => setQuote({ ...quote, closingMessage: v })}
              placeholder="Ex: Perfeito! Vou encaminhar suas informações para nosso time preparar a melhor proposta!"
            />
          </FlowCard>

          <FlowCard
            dotClass="bg-red-500"
            title="Suporte / Problema"
            subtitle="Cliente precisa de ajuda ou tem um problema"
            active={support.active}
            expanded={support.expanded}
            onToggleActive={(v) => setSupport({ ...support, active: v })}
            onToggleExpand={() => setSupport({ ...support, expanded: !support.expanded })}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PriorityField
                value={support.priority}
                onChange={(v) => setSupport({ ...support, priority: v })}
              />
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  SLA de resposta (minutos)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={support.slaMinutes}
                  onChange={(e) =>
                    setSupport({ ...support, slaMinutes: Number(e.target.value) || 0 })
                  }
                  className="h-10"
                />
              </div>
            </div>

            <ChecklistEditor
              label="Categorias de problema"
              items={support.categories}
              onChange={(items) => setSupport({ ...support, categories: items })}
              addLabel="Adicionar categoria"
            />

            <ChecklistEditor
              label="Informações a coletar"
              items={support.collect}
              onChange={(items) => setSupport({ ...support, collect: items })}
              addLabel="Adicionar informação"
            />

            <DropdownField
              label="Ação ao identificar problema"
              value={support.action}
              onChange={(v) => setSupport({ ...support, action: v })}
              options={SUPPORT_ACTIONS}
            />

            <TextareaField
              label="Mensagem de acolhimento"
              value={support.closingMessage}
              onChange={(v) => setSupport({ ...support, closingMessage: v })}
              placeholder="Ex: Entendo a situação. Vou te ajudar o mais rápido possível."
            />
          </FlowCard>

          <FlowCard
            dotClass="bg-amber-400"
            title="Prospect Indeciso"
            subtitle="Não sabe o que quer, precisa de orientação"
            active={prospect.active}
            expanded={prospect.expanded}
            onToggleActive={(v) => setProspect({ ...prospect, active: v })}
            onToggleExpand={() => setProspect({ ...prospect, expanded: !prospect.expanded })}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PriorityField
                value={prospect.priority}
                onChange={(v) => setProspect({ ...prospect, priority: v })}
              />
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tempo máximo de engajamento (minutos)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={prospect.maxMinutes}
                  onChange={(e) =>
                    setProspect({ ...prospect, maxMinutes: Number(e.target.value) || 0 })
                  }
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Estratégia de engajamento
              </Label>
              <RadioGroup
                value={prospect.strategy}
                onValueChange={(v) => setProspect({ ...prospect, strategy: v })}
                className="space-y-2"
              >
                {[
                  { v: "explore", l: "Fazer perguntas exploratórias" },
                  { v: "popular", l: "Sugerir destinos populares" },
                  { v: "catalog", l: "Enviar catálogo de opções" },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    className="flex items-center gap-3 px-3 py-2 rounded-md border border-input hover:bg-muted/50 cursor-pointer"
                  >
                    <RadioGroupItem value={opt.v} id={`strat-${opt.v}`} />
                    <span className="text-sm">{opt.l}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <ChecklistEditor
              label="Perguntas exploratórias"
              items={prospect.questions}
              onChange={(items) => setProspect({ ...prospect, questions: items })}
              addLabel="Adicionar pergunta"
            />

            <DropdownField
              label="Ação ao concluir"
              value={prospect.action}
              onChange={(v) => setProspect({ ...prospect, action: v })}
              options={PROSPECT_ACTIONS}
            />
          </FlowCard>
        </div>
      </div>
    </section>
  );
}

function FlowCard({
  dotClass,
  title,
  subtitle,
  active,
  expanded,
  onToggleActive,
  onToggleExpand,
  children,
}: {
  dotClass: string;
  title: string;
  subtitle: string;
  active: boolean;
  expanded: boolean;
  onToggleActive: (v: boolean) => void;
  onToggleExpand: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className={cn("h-3 w-3 rounded-full shrink-0", dotClass)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={onToggleActive} />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {active ? "Ativo" : "Inativo"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-5 pt-1 space-y-5 animate-accordion-down border-t border-gray-100">
          <div className="pt-4 space-y-5">{children}</div>
        </div>
      )}
    </div>
  );
}

function PriorityField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <DropdownField
      label="Prioridade"
      value={value}
      onChange={onChange}
      options={PRIORITIES.map((p) => p.label)}
      valueMap={Object.fromEntries(PRIORITIES.map((p) => [p.label, p.value]))}
      currentLabel={PRIORITIES.find((p) => p.value === value)?.label ?? "Normal"}
      onChangeRaw={(label) => {
        const found = PRIORITIES.find((p) => p.label === label);
        if (found) onChange(found.value);
      }}
    />
  );
}

function DropdownField({
  label,
  value,
  onChange,
  options,
  currentLabel,
  onChangeRaw,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  valueMap?: Record<string, string>;
  currentLabel?: string;
  onChangeRaw?: (v: string) => void;
}) {
  const handleChange = onChangeRaw ?? onChange;
  const display = currentLabel ?? value;
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Select value={display} onValueChange={handleChange}>
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-y bg-[hsl(220_15%_98%)]"
      />
    </div>
  );
}

function ChecklistEditor({
  label,
  items,
  onChange,
  addLabel,
}: {
  label: string;
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  addLabel: string;
}) {
  const update = (id: string, patch: Partial<ChecklistItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));
  const add = () =>
    onChange([...items, { id: uid(), label: "Nova pergunta", enabled: true }]);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="rounded-md border border-input divide-y divide-gray-100 bg-background">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 px-3 py-2">
            <Checkbox
              checked={it.enabled}
              onCheckedChange={(c) => update(it.id, { enabled: !!c })}
            />
            <Input
              value={it.label}
              onChange={(e) => update(it.id, { label: e.target.value })}
              className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm"
            />
            <button
              type="button"
              onClick={() => remove(it.id)}
              className="text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">Nenhum item.</p>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="h-8">
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        {addLabel}
      </Button>
    </div>
  );
}
