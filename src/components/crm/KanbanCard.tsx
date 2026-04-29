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
  Thermometer,
  User,
  Check,
  X as XIcon,
  GripVertical,
  Phone,
  MapPin,
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
    !card.destination && !card.travelDate && !card.agent && !card.estimatedValue;

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
    hot: "border-l-red-500",
    warm: "border-l-orange-400",
    cold: "border-l-sky-400",
  };
  const leftBorder = alert?.tone === "destructive"
    ? "border-l-destructive"
    : card.isRepurchase
      ? "border-l-amber-400"
      : card.isReturning
        ? "border-l-sky-400"
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
      )}
    >
      <div className="px-2.5 py-2">
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
                className={cn(
                  "w-3.5 h-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity",
                  draggable && "group-hover:opacity-100",
                )}
              />
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-medium font-sans">
                  {getInitials(card.clientName) || <User className="w-3 h-3" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-sans text-[14px] font-semibold min-w-0 truncate leading-tight tracking-tight",
                    nameIsPhone
                      ? "italic text-muted-foreground"
                      : "text-slate-800",
                  )}
                  title={nameIsPhone ? "Nome do contato ainda não informado — use 'Editar' no menu para atualizar" : undefined}
                >
                  {card.clientName}
                </p>
                {card.destination && (
                  <p className="flex items-center gap-1 font-sans text-[11px] text-slate-500 truncate leading-snug mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{card.destination}</span>
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="shrink-0 flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
            {cornerBadge}
            <div className="flex flex-col items-end gap-0.5">
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
              {lastContactDays !== null ? (
                <span
                  title={`Último contato há ${lastContactDays} dia(s)`}
                  className={cn(
                    "text-[9px] font-medium tabular-nums leading-none pr-0.5",
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
                    "text-[9px] font-medium tabular-nums leading-none pr-0.5",
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
          </div>
        </div>


        {isIncomplete ? (
          /* Estado incompleto: CTA central discreto */
          <div className="py-3 text-center">
            <p className="text-[11px] italic text-muted-foreground/80 font-body leading-snug">
              Dados incompletos — clique para completar
            </p>
          </div>
        ) : (
          <>
            {/* Linhas com ícones: telefone e data da viagem */}
            {(card.phone || card.travelDate || isBoardingSoon) && (
              <div className="mb-1.5 flex flex-col gap-1">
                {!nameIsPhone && card.phone && (
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500 font-body truncate tabular-nums">
                    <Phone className="w-3 h-3 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{formatPhone(card.phone)}</span>
                  </p>
                )}
                {(card.travelDate || isBoardingSoon) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {card.travelDate && (
                      <p className="text-[11px] text-slate-500 font-body truncate">
                        {card.travelDate}
                      </p>
                    )}
                    {isBoardingSoon && (
                      <span
                        title={`Embarque em ${daysToTravel} dia(s)`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/15 text-destructive"
                      >
                        <Plane className="w-3 h-3" />
                        Embarque próximo
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AI summary */}
            {card.isAILead && card.aiSummary && (
              <p className="text-[11px] italic text-muted-foreground/80 font-body leading-snug line-clamp-2 mb-1.5">
                "{card.aiSummary}"
              </p>
            )}

            {/* Tags compactas */}
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {card.tags.map((tag, i) => (
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
            )}

            {/* Linha 3: responsável (avatar + nome) + valor estimado */}
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/60 -mx-2.5 px-2.5">
              {card.agent?.avatarUrl ? (
                <img
                  src={card.agent.avatarUrl}
                  alt={card.agent.name}
                  className="shrink-0 w-[18px] h-[18px] rounded-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-semibold",
                    card.agent ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive",
                  )}
                  aria-hidden
                >
                  {card.agent ? getInitials(card.agent.name) : "?"}
                </div>
              )}
              <span
                className={cn(
                  "text-[11px] font-body truncate flex-1 min-w-0",
                  noAgent ? "text-destructive font-medium" : "text-muted-foreground",
                )}
              >
                {card.agent?.name || "Sem responsável"}
              </span>
              <span className={cn(
                "font-body shrink-0 tabular-nums ml-auto",
                value ? "text-[12px] font-medium text-foreground" : "text-[11px] text-muted-foreground/60",
              )}>
                {value ?? "—"}
              </span>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
