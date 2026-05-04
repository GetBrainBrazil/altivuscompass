import { useEffect, useRef, useState, DragEvent } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, FileText, Bell, BookOpen, UploadCloud, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KBFile {
  id: string;
  name: string;
  size: number;
}

const FUNNELS = ["Funil de Vendas", "Funil de Suporte", "Funil de Indecisos"];
const STAGES = ["Novos Leads", "Em Qualificação", "Em Negociação"];
const TEAM = [
  "Equipe de Vendas",
  "Atendente Plantão",
  "Consultor Sênior",
  "Não atribuir",
];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export interface IntegracoesValue {
  create_leads: boolean;
  funnel: string;
  stage: string;
  draft_quote: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  owner: string;
  files: KBFile[];
}

interface Props {
  value?: Partial<IntegracoesValue>;
  onChange?: (v: IntegracoesValue) => void;
}

export function IntegracoesSection({ value, onChange }: Props = {}) {
  // CRM
  const [createLeads, setCreateLeads] = useState(value?.create_leads ?? true);
  const [funnel, setFunnel] = useState(value?.funnel ?? FUNNELS[0]);
  const [stage, setStage] = useState(value?.stage ?? STAGES[0]);

  // Cotações
  const [draftQuote, setDraftQuote] = useState(value?.draft_quote ?? false);

  // Notificações
  const [notifyEmail, setNotifyEmail] = useState(value?.notify_email ?? true);
  const [notifyWA, setNotifyWA] = useState(value?.notify_whatsapp ?? false);
  const [owner, setOwner] = useState(value?.owner ?? TEAM[0]);

  // Base de Conhecimento
  const [files, setFiles] = useState<KBFile[]>(value?.files ?? []);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChange?.({
      create_leads: createLeads,
      funnel,
      stage,
      draft_quote: draftQuote,
      notify_email: notifyEmail,
      notify_whatsapp: notifyWA,
      owner,
      files,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createLeads, funnel, stage, draftQuote, notifyEmail, notifyWA, owner, files]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted = Array.from(list).filter((f) =>
      /\.(pdf|docx)$/i.test(f.name)
    );
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
          <ToggleRow
            label="Criar leads automaticamente"
            checked={createLeads}
            onChange={setCreateLeads}
          />
          {createLeads && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <DropdownField
                label="Funil padrão"
                value={funnel}
                onChange={setFunnel}
                options={FUNNELS}
              />
              <DropdownField
                label="Etapa inicial"
                value={stage}
                onChange={setStage}
                options={STAGES}
              />
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
          <ToggleRow
            label="Notificar responsável por e-mail"
            checked={notifyEmail}
            onChange={setNotifyEmail}
          />
          <ToggleRow
            label="Notificar responsável por WhatsApp"
            checked={notifyWA}
            onChange={setNotifyWA}
          />
          <div className="pt-2 max-w-sm">
            <DropdownField
              label="Responsável padrão"
              value={owner}
              onChange={setOwner}
              options={TEAM}
            />
          </div>
        </IntegrationCard>

        {/* Base de Conhecimento */}
        <IntegrationCard
          icon={<BookOpen className="h-5 w-5" />}
          title="Base de Conhecimento"
        >
          <p className="text-xs text-muted-foreground -mt-1">
            O agente usará estes documentos para responder perguntas sobre destinos,
            políticas e serviços.
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
            <p className="text-sm text-foreground font-medium">
              Arraste arquivos ou clique para enviar
            </p>
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
                    onClick={() =>
                      setFiles(files.filter((file) => file.id !== f.id))
                    }
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
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
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
