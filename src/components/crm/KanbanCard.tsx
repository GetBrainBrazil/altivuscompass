import { ReactNode, useState, useRef, useEffect } from "react";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  Flame,
  Plane,
  MoreVertical,
  Trash2,
  FileText,
  MessageCircle,
  Pencil,
  Archive,
  ArchiveRestore,
  Thermometer,
  User,
  Check,
  X as XIcon,
  GripVertical,
  Phone,
  MapPin,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type KanbanTagTone =
  | "blue"
  | "purple"
  | "amber"
  | "green"
  | "rose"
  | "slate";

export type KanbanTag = {
  label: string;
  tone?: KanbanTagTone;
};

/**
 * Alerta visual exibido como badge no canto superior direito do card.
 */
export type KanbanCardAlert = {
  label: string;
  tone: "destructive" | "warning" | "success";
};

/** Temperatura do lead — controla cor do ícone de chama. */
export type LeadTemperature = "hot" | "warm" | "cold";

export type KanbanCardData = {
  id: string;
  clientName: string;
  /** Telefone do lead (E.164 sem '+', como vem do WhatsApp). */
  phone?: string;
  destination?: string;
  travelDate?: string;
  /** Número de viajantes — usado para sinalizar nível de triagem da IA. */
  travelersCount?: number;
  /** ISO date (YYYY-MM-DD) da viagem — usado para calcular "Embarque próximo". */
  travelDateISO?: string;
  tags?: KanbanTag[];
  estimatedValue?: number;
  agent?: {
    id?: string;
    name: string;
    avatarUrl?: string;
  };
  isAILead?: boolean;
  isManualLead?: boolean;
  aiSummary?: string;
  /** Origem do contato/lead — usado para filtros (whatsapp, manual, phone, email, referral, etc). */
  source?: string;
  alert?: KanbanCardAlert;
  contactLevel?: ContactLevel;
  /** Timestamp ISO de quando o card entrou na coluna atual. Usado para badge "Xd na etapa". */
  stageEnteredAt?: string;
  /** Timestamp ISO do último contato com o lead (mensagem, ligação, etc). */
  lastContactAt?: string;
  /** Temperatura do lead (default: "cold"). */
  temperature?: LeadTemperature;
  /** Cliente já existente iniciando uma nova jornada de compra. */
  isRepurchase?: boolean;
  /** Contato antigo que voltou após >30 dias sem interação. */
  isReturning?: boolean;
};

const TAG_TONE_CLASSES: Record<KanbanTagTone, string> = {
  blue: "bg-blue-50/70 text-blue-700",
  purple: "bg-purple-50/70 text-purple-700",
  amber: "bg-amber-50/70 text-amber-700",
  green: "bg-emerald-50/70 text-emerald-700",
  rose: "bg-rose-50/70 text-rose-700",
  slate: "bg-slate-100/70 text-slate-700",
};

const ALERT_BADGE_CLASSES: Record<KanbanCardAlert["tone"], string> = {
  destructive: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
};

/**
 * Detecta se o "nome" do contato é, na verdade, apenas um número de telefone
 * (apenas dígitos, espaços, hífens, parênteses e o prefixo +). Indica que o
 * consultor ainda precisa atualizar o nome real.
 */
function isPhoneLikeName(name?: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (/[A-Za-zÀ-ÿ]/.test(trimmed)) return false;
  return /\d/.test(trimmed) && /^[+\d\s().\-]+$/.test(trimmed);
}

const TEMP_NEXT: Record<LeadTemperature, LeadTemperature> = {
  cold: "warm",
  warm: "hot",
  hot: "cold",
};

const TEMP_LABEL: Record<LeadTemperature, string> = {
  hot: "Quente — quer fechar em breve",
  warm: "Morno — interesse sem urgência",
  cold: "Frio — contato inicial",
};

const TEMP_CLASSES: Record<LeadTemperature, string> = {
  hot: "text-red-500 fill-red-500/30",
  warm: "text-orange-400 fill-orange-400/25",
  cold: "text-slate-400",
};

/**
 * Formata telefone E.164 (ex: "5511987654321") em formato BR amigável:
 * "+55 (11) 98765-4321". Para números não-BR ou inválidos, retorna como veio
 * com prefixo "+".
 */
function formatPhone(raw?: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Brasil: 55 + DDD(2) + 8 ou 9 dígitos
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${mid}-${end}`;
  }
  return `+${digits}`;
}

function formatBRL(value?: number) {
  if (value == null) return null;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function stageDaysBadgeClasses(d: number): string {
  if (d >= 14) return "bg-destructive/15 text-destructive";
  if (d >= 7) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function stageDaysLabel(d: number): string {
  if (d >= 14) return "14d+";
  return `${d}d`;
}

export function KanbanCard({
  card,
  onClick,
  stageBorderClass = "border-l-muted-foreground/40",
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onTemperatureChange,
  onDelete,
  onAssignAgent,
  agentOptions,
  onCreateQuote,
  onViewConversation,
  onEdit,
  onArchive,
  onUnarchive,
  archivedAppearance = false,
  onRenameClient,
}: {
  card: KanbanCardData;
  onClick?: (card: KanbanCardData) => void;
  stageBorderClass?: string;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (card: KanbanCardData, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (card: KanbanCardData, e: React.DragEvent<HTMLDivElement>) => void;
  /** Callback ao clicar no ícone de chama para alternar a temperatura. */
  onTemperatureChange?: (card: KanbanCardData, next: LeadTemperature) => void;
  /** Callback ao clicar em "Excluir" no menu de 3 pontos. */
  onDelete?: (card: KanbanCardData) => void;
  /** Atribuir um responsável (consultor) inline pelo dropdown. */
  onAssignAgent?: (card: KanbanCardData, userId: string) => void;
  /** Lista de consultores disponíveis para atribuição rápida. */
  agentOptions?: { user_id: string; full_name: string; avatar_url?: string | null }[];
  /** Criar nova cotação pré-preenchida com os dados do lead. */
  onCreateQuote?: (card: KanbanCardData) => void;
  /** Abrir conversa no WhatsApp / Central de Atendimento. */
  onViewConversation?: (card: KanbanCardData) => void;
  /** Abrir ficha completa para edição. */
  onEdit?: (card: KanbanCardData) => void;
  /** Arquivar o card (mover para área oculta). */
  onArchive?: (card: KanbanCardData) => void;
  /** Desarquivar (somente para cards na área de arquivados). Quando definido, o item "Arquivar" é substituído por "Desarquivar". */
  onUnarchive?: (card: KanbanCardData) => void;
  /** Aplica visual opaco/cinza ao card (usado em cards arquivados). */
  archivedAppearance?: boolean;
  /** Renomear o contato inline (quando o nome ainda é apenas um telefone). */
  onRenameClient?: (card: KanbanCardData, newName: string) => Promise<void> | void;
}) {
  const value = formatBRL(card.estimatedValue);
  const alert = card.alert;
  const temperature: LeadTemperature = card.temperature ?? "cold";
  const stageDays = daysSince(card.stageEnteredAt);
  const lastContactDays = daysSince(card.lastContactAt);
  const daysToTravel = daysUntil(card.travelDateISO);
  const isBoardingSoon = daysToTravel !== null && daysToTravel >= 0 && daysToTravel <= 30;
  const nameIsPhone = isPhoneLikeName(card.clientName);
  const isIncomplete =
    !card.destination && !card.travelDate && !card.agent && !card.estimatedValue && !card.phone;

  // ── Edição inline do nome (quando ainda é apenas um telefone) ─────────────
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditingName) {
      // Foca o input ao entrar em modo de edição
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [isEditingName]);

  const startEditingName = () => {
    if (!onRenameClient) return;
    setNameDraft("");
    setIsEditingName(true);
  };
  const cancelEditingName = () => {
    setIsEditingName(false);
    setNameDraft("");
  };
  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) {
      cancelEditingName();
      return;
    }
    if (!onRenameClient) {
      cancelEditingName();
      return;
    }
    try {
      setSavingName(true);
      await onRenameClient(card, next);
      setIsEditingName(false);
      setNameDraft("");
    } finally {
      setSavingName(false);
    }
  };


  let cornerBadge: ReactNode = null;
  if (alert) {
    const Icon = alert.tone === "success" ? CheckCircle2 : AlertTriangle;
    cornerBadge = (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
          ALERT_BADGE_CLASSES[alert.tone],
        )}
      >
        <Icon className="w-3 h-3" />
        {alert.label}
      </span>
    );
  } else if (card.isAILead) {
    const aiFilled = [!!card.destination, !!card.travelDate, !!card.travelersCount].filter(Boolean).length;
    const aiVariant = aiFilled === 3 ? "complete" : aiFilled === 0 ? "neutral" : "partial";
    const aiCls =
      aiVariant === "complete"
        ? "bg-success/15 text-success"
        : aiVariant === "partial"
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
          : "bg-muted text-muted-foreground";
    const aiTitle =
      aiVariant === "complete"
        ? "Lead triado pela IA via WhatsApp (destino, período e viajantes coletados)"
        : aiVariant === "partial"
          ? `Em qualificação pela IA (${aiFilled}/3 dados de interesse)`
          : "Recebido pela IA via WhatsApp — ainda sem dados de interesse";
    cornerBadge = (
      <span title={aiTitle} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", aiCls)}>
        <Sparkles className="w-3 h-3" />
        IA
      </span>
    );
  } else if (card.isManualLead) {
    cornerBadge = (
      <span
        title="Lead criado manualmente pelo consultor"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-soft-blue/15 text-soft-blue"
      >
        <UserPlus className="w-3 h-3" />
        Manual
      </span>
    );
  }

  const tempBorder: Record<LeadTemperature, string> = {
    hot: "border-l-rose-300",
    warm: "border-l-amber-200",
    cold: "border-l-slate-300",
  };
  const leftBorder = alert?.tone === "destructive"
    ? "border-l-destructive/60"
    : card.isRepurchase
      ? "border-l-amber-200"
      : card.isReturning
        ? "border-l-slate-300"
        : tempBorder[temperature];
  const noAgent = !card.agent;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        try {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", card.id);
          const node = e.currentTarget as HTMLDivElement;
          const rect = node.getBoundingClientRect();
          const ghost = node.cloneNode(true) as HTMLDivElement;
          ghost.style.position = "absolute";
          ghost.style.top = "-1000px";
          ghost.style.left = "-1000px";
          ghost.style.width = `${rect.width}px`;
          ghost.style.pointerEvents = "none";
          ghost.style.opacity = "1";
          ghost.style.transform = "rotate(2.5deg)";
          ghost.style.boxShadow =
            "0 20px 35px -10px hsl(var(--foreground) / 0.35), 0 8px 16px -6px hsl(var(--foreground) / 0.25)";
          ghost.style.borderRadius = "0.5rem";
          ghost.setAttribute("data-drag-ghost", "true");
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
          window.setTimeout(() => {
            ghost.remove();
          }, 0);
        } catch {
          /* ignore */
        }
        onDragStart?.(card, e);
      }}
      onDragEnd={(e) => onDragEnd?.(card, e)}
      onClick={() => onClick?.(card)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(card);
        }
      }}
      className={cn(
        "group relative rounded-lg border border-border bg-card text-left",
        "border-l-4 shadow-sm hover:shadow-md transition-all animate-fade-in",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-30",
        leftBorder,
        alert?.tone === "destructive" && "bg-destructive/5",
        card.isRepurchase &&
          "border-amber-300/70 ring-1 ring-amber-200/60 bg-gradient-to-br from-amber-50/40 to-transparent",
        card.isReturning && !card.isRepurchase &&
          "border-sky-300/70 ring-1 ring-sky-200/60 bg-gradient-to-br from-sky-50/40 to-transparent",
        archivedAppearance && "opacity-60 grayscale-[0.4] hover:opacity-80",
      )}
    >
      <div className="p-4">
        {/* Topo: nome + badge + menu no canto superior direito */}
        <div className="flex items-start justify-between gap-1.5 mb-0.5">
          {isEditingName ? (
            <div
              className="flex-1 min-w-0 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type="text"
                value={nameDraft}
                disabled={savingName}
                placeholder="Nome do contato"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveName();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEditingName();
                  }
                }}
                className="flex-1 min-w-0 text-sm font-medium font-body bg-background border border-primary/40 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                aria-label="Salvar nome"
                disabled={savingName || !nameDraft.trim()}
                onClick={(e) => {
                  e.stopPropagation();
                  void saveName();
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded text-success hover:bg-success/10 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Cancelar edição"
                disabled={savingName}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEditingName();
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:bg-muted/60"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <GripVertical
                aria-hidden="true"
                className="w-3.5 h-3.5 shrink-0 text-slate-300"
              />
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-medium font-sans">
                  {getInitials(card.clientName) || <User className="w-3 h-3" />}
                </AvatarFallback>
              </Avatar>
              <p
                className={cn(
                  "flex-1 min-w-0 font-sans text-[14px] font-semibold leading-tight tracking-tight whitespace-normal break-words",
                  nameIsPhone
                    ? "italic text-muted-foreground"
                    : "text-slate-800",
                )}
                title={nameIsPhone ? "Nome do contato ainda não informado — use 'Editar' no menu para atualizar" : undefined}
              >
                {card.clientName}
              </p>
            </div>
          )}
          <div className="shrink-0 flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
            {(onDelete || onAssignAgent || onCreateQuote || onViewConversation || onEdit || onArchive || onTemperatureChange) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Mais ações"
                    className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                  {onAssignAgent && agentOptions && agentOptions.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <User className="w-3.5 h-3.5 mr-2" />
                        Atribuir responsável
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-64 overflow-y-auto w-56">
                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Consultores
                        </DropdownMenuLabel>
                        {agentOptions.map((u) => {
                          const isCurrent = card.agent?.id === u.user_id;
                          return (
                            <DropdownMenuItem
                              key={u.user_id}
                              onSelect={(e) => {
                                e.preventDefault();
                                onAssignAgent(card, u.user_id);
                              }}
                              className={cn("gap-2", isCurrent && "bg-primary/5 text-primary")}
                            >
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[8px] font-semibold flex items-center justify-center">
                                  {getInitials(u.full_name)}
                                </div>
                              )}
                              <span className="truncate">{u.full_name}</span>
                              {isCurrent && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {onCreateQuote && (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        onCreateQuote(card);
                      }}
                    >
                      <FileText className="w-3.5 h-3.5 mr-2" />
                      Criar cotação
                    </DropdownMenuItem>
                  )}
                  {onViewConversation && (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        onViewConversation(card);
                      }}
                      disabled={!card.phone}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-2" />
                      Ver conversa
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        onEdit(card);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {onTemperatureChange && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Thermometer className="w-3.5 h-3.5 mr-2" />
                        Marcar temperatura
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onTemperatureChange(card, "hot");
                          }}
                        >
                          <Flame className="w-3.5 h-3.5 mr-2 text-red-500 fill-red-500/30" />
                          Quente
                          {temperature === "hot" && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onTemperatureChange(card, "warm");
                          }}
                        >
                          <Flame className="w-3.5 h-3.5 mr-2 text-orange-400 fill-orange-400/25" />
                          Morno
                          {temperature === "warm" && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onTemperatureChange(card, "cold");
                          }}
                        >
                          <Flame className="w-3.5 h-3.5 mr-2 text-slate-400" />
                          Frio
                          {temperature === "cold" && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {(onArchive || onDelete) && <DropdownMenuSeparator />}
                  {onArchive && (
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        onArchive(card);
                      }}
                    >
                      <Archive className="w-3.5 h-3.5 mr-2" />
                      Arquivar
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        onDelete(card);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Linha secundária: apenas indicador de dias (badges movidas para o rodapé) */}
        {(lastContactDays !== null || stageDays !== null) && (
          <div className="flex items-center justify-end gap-1.5 mb-2 pl-[34px]">
            {lastContactDays !== null ? (
              <span
                title={`Último contato há ${lastContactDays} dia(s)`}
                className={cn(
                  "shrink-0 text-[9px] font-medium tabular-nums leading-none",
                  lastContactDays >= 14
                    ? "text-destructive"
                    : lastContactDays >= 7
                      ? "text-amber-600"
                      : "text-muted-foreground/70",
                )}
              >
                {lastContactDays === 0 ? "hoje" : `há ${lastContactDays}d`}
              </span>
            ) : stageDays !== null ? (
              <span
                title={`${stageDays} dia(s) nesta etapa`}
                className={cn(
                  "shrink-0 text-[9px] font-medium tabular-nums leading-none",
                  stageDays >= 14
                    ? "text-destructive"
                    : stageDays >= 7
                      ? "text-amber-600"
                      : "text-muted-foreground/70",
                )}
              >
                {stageDaysLabel(stageDays)}
              </span>
            ) : null}
          </div>
        )}


        {!isIncomplete && (
          <>
            {/* Bloco de dados: destino + data + telefone */}
            {(card.destination || card.travelDate || card.phone || isBoardingSoon) && (
              <div className="mb-2 flex flex-col gap-0.5">
                {(card.destination || card.travelDate) && (
                  <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500 font-body min-w-0">
                    {card.destination && (
                      <span className="flex items-center gap-1 min-w-0 truncate">
                        <MapPin className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{card.destination}</span>
                      </span>
                    )}
                    {card.travelDate && (
                      <span className="flex items-center gap-1 min-w-0 truncate">
                        <Calendar className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{card.travelDate}</span>
                      </span>
                    )}
                  </div>
                )}
                {!nameIsPhone && card.phone && (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500 font-body truncate tabular-nums">
                    <span className="truncate">{formatPhone(card.phone)}</span>
                    <svg
                      viewBox="0 0 24 24"
                      aria-label="WhatsApp"
                      className="w-3 h-3 shrink-0 text-emerald-600 fill-current"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488"/>
                    </svg>
                  </p>
                )}
                {isBoardingSoon && (
                  <span
                    title={`Embarque em ${daysToTravel} dia(s)`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive self-start"
                  >
                    <Plane className="w-3 h-3" />
                    Embarque próximo
                  </span>
                )}
              </div>
            )}

            {/* AI summary */}
            {card.isAILead && card.aiSummary && (
              <p className="text-[11px] italic text-muted-foreground/80 font-body leading-snug line-clamp-2 mb-1.5">
                "{card.aiSummary}"
              </p>
            )}

            {/* Tags compactas (exclui WhatsApp — agora exibido como ícone na linha do telefone) */}
            {(() => {
              const visibleTags = card.tags?.filter((t) => t.label !== "WhatsApp") ?? [];
              return visibleTags.length > 0 ? (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {visibleTags.map((tag, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium font-body",
                        TAG_TONE_CLASSES[tag.tone ?? "slate"],
                      )}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Rodapé: pílulas (ContactLevel, IA/Manual, Recompra/Retornou) à esquerda + valor + avatar do responsável à direita */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-border/60 -mx-4 px-4">
              <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                {card.contactLevel && (
                  <ContactLevelBadge level={card.contactLevel} size="xs" className="shrink-0" />
                )}
                {cornerBadge}
                {card.isRepurchase && (
                  <span
                    title="Cliente iniciando uma nova jornada de compra"
                    className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-700"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Recompra
                  </span>
                )}
                {card.isReturning && !card.isRepurchase && (
                  <span
                    title="Contato antigo que voltou a falar após mais de 30 dias"
                    className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-700"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Retornou
                  </span>
                )}
              </div>
              {value && (
                <span className="font-body shrink-0 tabular-nums text-[12px] font-medium text-foreground">
                  {value}
                </span>
              )}
              {card.agent?.avatarUrl ? (
                <img
                  src={card.agent.avatarUrl}
                  alt={card.agent.name}
                  title={card.agent.name}
                  className="shrink-0 w-[22px] h-[22px] rounded-full object-cover"
                />
              ) : (
                <div
                  title={card.agent?.name || "Sem responsável"}
                  className={cn(
                    "shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold",
                    card.agent ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive",
                  )}
                  aria-hidden
                >
                  {card.agent ? getInitials(card.agent.name) : "?"}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
