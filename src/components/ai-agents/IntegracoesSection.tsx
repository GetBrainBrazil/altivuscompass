import { useEffect, useRef, useState, DragEvent } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Users,
  FileText,
  Bell,
  BookOpen,
  UploadCloud,
  Trash2,
  Plane,
  LifeBuoy,
  HelpCircle,
  Check,
  ChevronDown,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getUserInitials } from "@/components/ui/user-picker";

interface KBFile {
  id: string;
  name: string;
  size: number;
}

const FUNNELS = ["Funil de Vendas", "Funil de Suporte", "Funil de Indecisos"];
const STAGES = ["Novos Leads", "Em Qualificação", "Em Negociação"];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uid = () => Math.random().toString(36).slice(2, 10);

type FlowKey = "nova_cotacao" | "suporte" | "prospect_indeciso";
type DistributionMethod = "round_robin" | "all" | "availability";
type FallbackMode = "wait_message" | "notify_manager" | "both";

export interface TeamMemberConfig {
  user_id: string;
  available: boolean;
  online: boolean;
}

export interface IntegracoesValue {
  create_leads: boolean;
  funnel: string;
  stage: string;
  draft_quote: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  team_members: TeamMemberConfig[];
  routing: Record<FlowKey, string[]>;
  distribution: DistributionMethod;
  handoff_template: string;
  fallback_mode: FallbackMode;
  fallback_wait_message: string;
  fallback_manager_id: string | null;
  fallback_max_wait_min: number;
  files: KBFile[];
}

interface Props {
  value?: Partial<IntegracoesValue>;
  onChange?: (v: IntegracoesValue) => void;
}

interface TeamUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  role: string | null;
}

const DEFAULT_TEMPLATE = `🔔 Novo atendimento para você

Cliente: {nome_cliente}
Telefone: {telefone_cliente}
Tipo: {fluxo_detectado}
Resumo: {resumo_conversa}

Dados coletados:
{dados_coletados}

Acesse a Central de Atendimento para continuar a conversa.`;

const DEFAULT_WAIT_MSG =
  "No momento todos os nossos consultores estão em atendimento. Em breve alguém vai te atender!";

const FLOWS: { key: FlowKey; label: string; helper: string; Icon: typeof Plane; bg: string; color: string }[] = [
  {
    key: "nova_cotacao",
    label: "Nova Cotação",
    helper: "Quem recebe leads que querem fazer uma cotação",
    Icon: Plane,
    bg: "bg-green-50",
    color: "text-green-600",
  },
  {
    key: "suporte",
    label: "Suporte / Problema",
    helper: "Quem recebe clientes com problemas ou emergências",
    Icon: LifeBuoy,
    bg: "bg-red-50",
    color: "text-red-600",
  },
  {
    key: "prospect_indeciso",
    label: "Prospect Indeciso",
    helper: "Quem recebe prospects que precisam de orientação",
    Icon: HelpCircle,
    bg: "bg-yellow-50",
    color: "text-yellow-600",
  },
];

export function IntegracoesSection({ value, onChange }: Props = {}) {
  const [createLeads, setCreateLeads] = useState(value?.create_leads ?? true);
  const [funnel, setFunnel] = useState(value?.funnel ?? FUNNELS[0]);
  const [stage, setStage] = useState(value?.stage ?? STAGES[0]);
  const [draftQuote, setDraftQuote] = useState(value?.draft_quote ?? false);
  const [notifyEmail, setNotifyEmail] = useState(value?.notify_email ?? true);
  const [notifyWA, setNotifyWA] = useState(value?.notify_whatsapp ?? false);

  const [teamMembers, setTeamMembers] = useState<TeamMemberConfig[]>(
    value?.team_members ?? []
  );
  const [routing, setRouting] = useState<Record<FlowKey, string[]>>(
    value?.routing ?? { nova_cotacao: [], suporte: [], prospect_indeciso: [] }
  );
  const [distribution, setDistribution] = useState<DistributionMethod>(
    value?.distribution ?? "round_robin"
  );
  const [template, setTemplate] = useState(value?.handoff_template ?? DEFAULT_TEMPLATE);
  const [fallbackMode, setFallbackMode] = useState<FallbackMode>(
    value?.fallback_mode ?? "wait_message"
  );
  const [waitMessage, setWaitMessage] = useState(
    value?.fallback_wait_message ?? DEFAULT_WAIT_MSG
  );
  const [managerId, setManagerId] = useState<string | null>(
    value?.fallback_manager_id ?? null
  );
  const [maxWaitMin, setMaxWaitMin] = useState<number>(value?.fallback_max_wait_min ?? 15);

  const [files, setFiles] = useState<KBFile[]>(value?.files ?? []);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Load team users from profiles + roles
  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, phone")
        .order("full_name", { ascending: true });
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string>();
      (roles || []).forEach((r: any) => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
      });
      const list: TeamUser[] = (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || "Sem nome",
        avatar_url: p.avatar_url,
        phone: p.phone,
        role: roleMap.get(p.user_id) || null,
      }));
      setUsers(list);
      // Initialize team_members entries for users not yet present
      setTeamMembers((prev) => {
        const existingIds = new Set(prev.map((m) => m.user_id));
        const additions = list
          .filter((u) => !existingIds.has(u.user_id))
          .map((u) => ({ user_id: u.user_id, available: false, online: false }));
        return additions.length ? [...prev, ...additions] : prev;
      });
    })();
  }, []);

  useEffect(() => {
    onChange?.({
      create_leads: createLeads,
      funnel,
      stage,
      draft_quote: draftQuote,
      notify_email: notifyEmail,
      notify_whatsapp: notifyWA,
      team_members: teamMembers,
      routing,
      distribution,
      handoff_template: template,
      fallback_mode: fallbackMode,
      fallback_wait_message: waitMessage,
      fallback_manager_id: managerId,
      fallback_max_wait_min: maxWaitMin,
      files,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createLeads, funnel, stage, draftQuote, notifyEmail, notifyWA,
    teamMembers, routing, distribution, template,
    fallbackMode, waitMessage, managerId, maxWaitMin, files,
  ]);

  const updateMember = (user_id: string, patch: Partial<TeamMemberConfig>) => {
    setTeamMembers((prev) =>
      prev.map((m) => (m.user_id === user_id ? { ...m, ...patch } : m))
    );
  };

  const activeMembers = users.filter((u) =>
    teamMembers.find((m) => m.user_id === u.user_id && m.available)
  );

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((f) => /\.(pdf|docx)$/i.test(f.name));
    setFiles((prev) => [
      ...prev,
      ...accepted.map((f) => ({ id: uid(), name: f.name, size: f.size })),
    ]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const renderPreview = () =>
    template
      .replaceAll("{nome_cliente}", "Maria Silva")
      .replaceAll("{telefone_cliente}", "+55 11 98765-4321")
      .replaceAll("{fluxo_detectado}", "Nova Cotação")
      .replaceAll("{resumo_conversa}", "Cliente quer cotação para Paris em julho, 2 adultos.")
      .replaceAll("{dados_coletados}", "- Destino: Paris\n- Período: Julho/2026\n- Pax: 2 adultos");

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Integrações
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Conecte o agente aos módulos da plataforma.
        </p>
      </div>

      <div className="p-8 space-y-4">
        {/* CRM */}
        <IntegrationCard icon={<Users className="h-5 w-5" />} title="CRM">
          <ToggleRow label="Criar leads automaticamente" checked={createLeads} onChange={setCreateLeads} />
          {createLeads && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <DropdownField label="Funil padrão" value={funnel} onChange={setFunnel} options={FUNNELS} />
              <DropdownField label="Etapa inicial" value={stage} onChange={setStage} options={STAGES} />
            </div>
          )}
        </IntegrationCard>

        {/* Cotações */}
        <IntegrationCard icon={<FileText className="h-5 w-5" />} title="Cotações">
          <ToggleRow
            label="Gerar rascunho de cotação automaticamente"
            checked={draftQuote}
            onChange={setDraftQuote}
          />
        </IntegrationCard>

        {/* Notificações */}
        <IntegrationCard icon={<Bell className="h-5 w-5" />} title="Notificações">
          <ToggleRow label="Notificar responsável por e-mail" checked={notifyEmail} onChange={setNotifyEmail} />
          <ToggleRow label="Notificar responsável por WhatsApp" checked={notifyWA} onChange={setNotifyWA} />

          {/* Team members */}
          <div className="pt-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Equipe disponível para handoff</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Selecione quais membros estão disponíveis para receber atendimentos.
              </p>
            </div>
            <div className="space-y-2">
              {users.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum membro encontrado.</p>
              )}
              {users.map((u) => {
                const cfg = teamMembers.find((m) => m.user_id === u.user_id);
                const available = cfg?.available ?? false;
                const online = cfg?.online ?? false;
                return (
                  <div
                    key={u.user_id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <Avatar className="h-9 w-9">
                      {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.full_name} /> : null}
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {getUserInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{u.full_name}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              online ? "bg-green-500" : "bg-gray-300"
                            )}
                          />
                          {online ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u.role || "Membro"} · {u.phone || "Sem telefone"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateMember(u.user_id, { online: !online })}
                      className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-gray-200"
                    >
                      {online ? "Marcar offline" : "Marcar online"}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden md:inline">Disponível</span>
                      <Switch
                        checked={available}
                        onCheckedChange={(c) => updateMember(u.user_id, { available: !!c })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Routing rules */}
          <div className="pt-6 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Regras de direcionamento</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina quem recebe o handoff baseado no tipo de atendimento detectado pela IA.
              </p>
            </div>
            <div className="space-y-3">
              {FLOWS.map((f) => (
                <div key={f.key} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("h-6 w-6 rounded-full flex items-center justify-center", f.bg)}>
                      <f.Icon className={cn("h-3.5 w-3.5", f.color)} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{f.label}</span>
                    <span className="text-muted-foreground text-sm">→</span>
                  </div>
                  <MultiUserPicker
                    users={activeMembers}
                    value={routing[f.key]}
                    onChange={(ids) => setRouting((r) => ({ ...r, [f.key]: ids }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">{f.helper}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution method */}
          <div className="pt-6 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Método de distribuição</h4>
            <RadioGroup
              value={distribution}
              onValueChange={(v) => setDistribution(v as DistributionMethod)}
              className="gap-2"
            >
              <RadioOption
                value="round_robin"
                label="Round-robin"
                desc="Distribui igualmente entre os membros selecionados, alternando a cada handoff."
              />
              <RadioOption
                value="all"
                label="Todos recebem"
                desc="Notifica todos os membros selecionados para aquele fluxo simultaneamente; o primeiro que responder assume."
              />
              <RadioOption
                value="availability"
                label="Por disponibilidade"
                desc="Envia para o primeiro membro marcado como Online; se nenhum estiver online, envia para todos."
              />
            </RadioGroup>
          </div>

          {/* Handoff message template */}
          <div className="pt-6 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Mensagem de handoff</h4>
            <p className="text-xs text-muted-foreground">
              Mensagem enviada ao agente da Altivus via WhatsApp quando a IA faz o handoff.
            </p>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={9}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use as variáveis entre chaves {"{}"} para personalizar. Variáveis disponíveis:{" "}
              <code>{"{nome_cliente}"}</code>, <code>{"{telefone_cliente}"}</code>,{" "}
              <code>{"{fluxo_detectado}"}</code>, <code>{"{resumo_conversa}"}</code>,{" "}
              <code>{"{dados_coletados}"}</code>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((p) => !p)}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              {showPreview ? "Ocultar pré-visualização" : "Pré-visualizar"}
            </Button>
            {showPreview && (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pré-visualização</p>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground">{renderPreview()}</pre>
              </div>
            )}
          </div>

          {/* Fallback */}
          <div className="pt-6 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Fallback</h4>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Se nenhum agente estiver disponível:
              </Label>
              <RadioGroup
                value={fallbackMode}
                onValueChange={(v) => setFallbackMode(v as FallbackMode)}
                className="gap-2"
              >
                <RadioOption value="wait_message" label="Enviar mensagem de espera ao cliente e manter na fila" />
                <RadioOption value="notify_manager" label="Notificar gestor por e-mail" />
                <RadioOption value="both" label="Ambos" />
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mensagem de espera para o cliente
              </Label>
              <Textarea value={waitMessage} onChange={(e) => setWaitMessage(e.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Gestor para fallback
                </Label>
                <Select
                  value={managerId ?? ""}
                  onValueChange={(v) => setManagerId(v || null)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione um gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tempo máximo de espera (minutos)
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={maxWaitMin}
                  onChange={(e) => setMaxWaitMin(Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Após este tempo sem resposta de nenhum agente, o gestor é notificado automaticamente.
                </p>
              </div>
            </div>
          </div>
        </IntegrationCard>

        {/* Base de Conhecimento */}
        <IntegrationCard icon={<BookOpen className="h-5 w-5" />} title="Base de Conhecimento">
          <p className="text-xs text-muted-foreground -mt-1">
            O agente usará estes documentos para responder perguntas sobre destinos, políticas e serviços.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-[hsl(220_45%_15%)] bg-[hsl(220_45%_15%)]/5"
                : "border-gray-300 bg-gray-50 hover:bg-gray-100"
            )}
          >
            <UploadCloud className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-foreground font-medium">Arraste arquivos ou clique para enviar</p>
            <p className="text-xs text-muted-foreground">PDF ou DOCX</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="rounded-md border border-input divide-y divide-gray-100 bg-background">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((file) => file.id !== f.id))}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Remover arquivo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </IntegrationCard>
      </div>
    </section>
  );
}

function IntegrationCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-[hsl(220_45%_15%)] text-white flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2 pl-1">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Switch checked={checked} onCheckedChange={(c) => onChange(!!c)} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function DropdownField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
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

function RadioOption({ value, label, desc }: { value: string; label: string; desc?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer rounded-md p-2 hover:bg-gray-50">
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="flex-1">
        <div className="text-sm text-foreground">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
    </label>
  );
}

function MultiUserPicker({
  users,
  value,
  onChange,
}: {
  users: TeamUser[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = users.filter((u) => value.includes(u.user_id));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-h-10 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent/30"
        >
          <div className="flex flex-wrap gap-1 items-center min-w-0 flex-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">Selecione membros disponíveis…</span>
            ) : (
              selected.map((u) => (
                <span
                  key={u.user_id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                >
                  {u.full_name}
                </span>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
        {users.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">
            Nenhum membro disponível. Ative membros na lista acima.
          </div>
        ) : (
          users.map((u) => {
            const isSelected = value.includes(u.user_id);
            return (
              <button
                key={u.user_id}
                type="button"
                onClick={() => toggle(u.user_id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-accent text-left"
              >
                <Avatar className="h-6 w-6">
                  {u.avatar_url ? <AvatarImage src={u.avatar_url} /> : null}
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getUserInitials(u.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate">{u.full_name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
