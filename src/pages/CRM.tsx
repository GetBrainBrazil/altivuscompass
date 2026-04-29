import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  MoreVertical,
  Trash2,
  ArrowLeftToLine,
  ArrowRightToLine,
  Pencil,
  Search,
  Users,
  DollarSign,
  Sparkles,
  X,
  AlertTriangle,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Rows3,
  Plane,
  LifeBuoy,
  MapPin,
  Target,
  Info,
  FilePlus,
} from "lucide-react";
import { FilterChip, SearchableList } from "@/components/tasks/FilterChip";
import { CRMTableView } from "@/components/crm/CRMTableView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UserPicker } from "@/components/ui/user-picker";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { KanbanCard, type KanbanCardData, type LeadTemperature } from "@/components/crm/KanbanCard";
import { KanbanCardSkeleton } from "@/components/ui/loading-skeletons";
import { ClientPromotionDialog } from "@/components/crm/ClientPromotionDialog";
import { DeleteContactDialog, type DeleteContactTarget } from "@/components/contacts/DeleteContactDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type KanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCardData[];
};

const INITIAL_SALES_COLUMNS: KanbanColumn[] = [
  { id: "new-leads", title: "Novos Contatos", cards: [] },
  { id: "qualifying", title: "Em Qualificação", cards: [] },
  { id: "quote", title: "Cotação", cards: [] },
  { id: "proposal-sent", title: "Proposta Enviada", cards: [] },
  { id: "closed", title: "Fechado", cards: [] },
  { id: "lost", title: "Perdidos", cards: [] },
];

const INITIAL_OPS_COLUMNS: KanbanColumn[] = [
  { id: "pre-trip", title: "Pré-Viagem", cards: [] },
  { id: "in-trip", title: "Em Viagem", cards: [] },
  { id: "support", title: "Suporte Ativo", cards: [] },
  { id: "post-trip", title: "Pós-Viagem", cards: [] },
];

const STAGE_DOT_COLORS = [
  "bg-soft-blue",
  "bg-purple-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-success",
  "bg-slate-400",
  "bg-primary",
];

function KanbanBoard({
  columns,
  onCardClick,
  onDeleteColumn,
  onAddColumn,
  onRenameColumn,
  onAddBefore,
  onAddAfter,
  draggedCardId,
  draggedFromColumnId,
  validTargetColumnIds,
  onCardDragStart,
  onCardDragEnd,
  onDropOnColumn,
  onTemperatureChange,
  onCardDelete,
  onCardAssignAgent,
  onCardCreateQuote,
  onCardViewConversation,
  onCardEdit,
  onCardArchive,
  onCardRenameClient,
  agentOptions,
  focusCardId,
  isLoading,
  collapsibleColumnIds,
  collapsedColumnIds,
  onToggleColumnCollapse,
}: {
  columns: KanbanColumn[];
  onCardClick: (card: KanbanCardData) => void;
  onDeleteColumn?: (columnId: string) => void;
  onAddColumn?: () => void;
  onRenameColumn?: (columnId: string) => void;
  onAddBefore?: (columnId: string) => void;
  onAddAfter?: (columnId: string) => void;
  draggedCardId: string | null;
  draggedFromColumnId?: string | null;
  validTargetColumnIds?: Set<string> | null;
  onCardDragStart: (card: KanbanCardData) => void;
  onCardDragEnd: () => void;
  onDropOnColumn: (columnId: string, targetIndex?: number) => void;
  onTemperatureChange: (card: KanbanCardData, next: LeadTemperature) => void;
  onCardDelete?: (card: KanbanCardData) => void;
  onCardAssignAgent?: (card: KanbanCardData, userId: string) => void;
  onCardCreateQuote?: (card: KanbanCardData) => void;
  onCardViewConversation?: (card: KanbanCardData) => void;
  onCardEdit?: (card: KanbanCardData) => void;
  onCardArchive?: (card: KanbanCardData) => void;
  onCardRenameClient?: (card: KanbanCardData, newName: string) => Promise<void> | void;
  agentOptions?: { user_id: string; full_name: string; avatar_url?: string | null }[];
  focusCardId?: string | null;
  isLoading?: boolean;
  collapsibleColumnIds?: Set<string>;
  collapsedColumnIds?: Set<string>;
  onToggleColumnCollapse?: (columnId: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 mt-3 pb-4 overflow-x-auto overflow-y-hidden scrollbar-elegant [transform:scaleY(-1)]">
      <div className="flex gap-1.5 px-3 py-2 min-w-max h-full items-stretch [transform:scaleY(-1)]">
        {columns.map((col, idx) => {
          const isValidTarget =
            !!draggedCardId &&
            (validTargetColumnIds ? validTargetColumnIds.has(col.id) : true);
          const isInvalidTarget = !!draggedCardId && !isValidTarget;
          const isSourceColumn = !!draggedCardId && col.id === draggedFromColumnId;
          return (
            <KanbanColumnCard
              key={col.id}
              column={col}
              dotColor={STAGE_DOT_COLORS[idx % STAGE_DOT_COLORS.length]}
              onCardClick={onCardClick}
              onDelete={onDeleteColumn ? () => onDeleteColumn(col.id) : undefined}
              onRename={onRenameColumn ? () => onRenameColumn(col.id) : undefined}
              onAddBefore={onAddBefore ? () => onAddBefore(col.id) : undefined}
              onAddAfter={onAddAfter ? () => onAddAfter(col.id) : undefined}
              draggedCardId={draggedCardId}
              isValidTarget={isValidTarget}
              isInvalidTarget={isInvalidTarget}
              isSourceColumn={isSourceColumn}
              onCardDragStart={onCardDragStart}
              onCardDragEnd={onCardDragEnd}
              onDropOnColumn={onDropOnColumn}
              onTemperatureChange={onTemperatureChange}
              onCardDelete={onCardDelete}
              onCardAssignAgent={onCardAssignAgent}
              onCardCreateQuote={onCardCreateQuote}
              onCardViewConversation={onCardViewConversation}
              onCardEdit={onCardEdit}
              onCardArchive={onCardArchive}
              onCardRenameClient={onCardRenameClient}
              agentOptions={agentOptions}
              focusCardId={focusCardId}
              isLoading={isLoading}
              collapsible={collapsibleColumnIds?.has(col.id) ?? false}
              collapsed={collapsedColumnIds?.has(col.id) ?? false}
              onToggleCollapse={
                onToggleColumnCollapse ? () => onToggleColumnCollapse(col.id) : undefined
              }
            />
          );
        })}
        {onAddColumn && <AddColumnButton onClick={onAddColumn} />}
      </div>
    </div>
  );
}

function KanbanColumnCard({
  column,
  dotColor,
  onCardClick,
  onDelete,
  onRename,
  onAddBefore,
  onAddAfter,
  draggedCardId,
  isValidTarget,
  isInvalidTarget,
  isSourceColumn,
  onCardDragStart,
  onCardDragEnd,
  onDropOnColumn,
  onTemperatureChange,
  onCardDelete,
  onCardAssignAgent,
  onCardCreateQuote,
  onCardViewConversation,
  onCardEdit,
  onCardArchive,
  onCardRenameClient,
  agentOptions,
  focusCardId,
  isLoading,
  collapsible,
  collapsed,
  onToggleCollapse,
}: {
  column: KanbanColumn;
  dotColor: string;
  onCardClick: (card: KanbanCardData) => void;
  onDelete?: () => void;
  onRename?: () => void;
  onAddBefore?: () => void;
  onAddAfter?: () => void;
  draggedCardId: string | null;
  isValidTarget?: boolean;
  isInvalidTarget?: boolean;
  isSourceColumn?: boolean;
  onCardDragStart: (card: KanbanCardData) => void;
  onCardDragEnd: () => void;
  onDropOnColumn: (columnId: string, targetIndex?: number) => void;
  onTemperatureChange: (card: KanbanCardData, next: LeadTemperature) => void;
  onCardDelete?: (card: KanbanCardData) => void;
  onCardAssignAgent?: (card: KanbanCardData, userId: string) => void;
  onCardCreateQuote?: (card: KanbanCardData) => void;
  onCardViewConversation?: (card: KanbanCardData) => void;
  onCardEdit?: (card: KanbanCardData) => void;
  onCardArchive?: (card: KanbanCardData) => void;
  onCardRenameClient?: (card: KanbanCardData, newName: string) => Promise<void> | void;
  agentOptions?: { user_id: string; full_name: string; avatar_url?: string | null }[];
  focusCardId?: string | null;
  isLoading?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const ownerlessCount = column.cards.filter((c) => !c.agent?.name).length;
  const isCollapsed = !!(collapsible && collapsed);
  // Visual feedback states for drag operation
  const showValidHint = !!draggedCardId && !!isValidTarget && !isSourceColumn && !isOver;
  const dimmedInvalid = !!draggedCardId && !!isInvalidTarget;
  return (
    <div
      className={cn(
        "flex flex-col shrink-0 max-h-full transition-all duration-200",
        isCollapsed ? "w-[48px]" : "w-[232px]",
        dimmedInvalid && "opacity-40 pointer-events-none",
      )}
    >
      {/* Column header (fixed) — flat, dot + title + count */}
      <div
        className={cn(
          "flex items-start gap-2 px-1 py-2 mb-1 shrink-0",
          collapsible && "cursor-pointer rounded-md hover:bg-muted/40",
          isCollapsed && "flex-col items-center gap-1.5 py-3",
        )}
        onClick={collapsible ? onToggleCollapse : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
        title={collapsible ? (isCollapsed ? "Expandir etapa" : "Recolher etapa") : undefined}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            isCollapsed ? "" : "mt-1.5",
            dotColor,
          )}
        />
        <span
          className={cn(
            "text-xs font-medium text-foreground font-body truncate",
            isCollapsed
              ? "[writing-mode:vertical-rl] [text-orientation:mixed] rotate-180 max-h-[180px]"
              : "mt-0.5",
          )}
        >
          {column.title}
        </span>
        <div
          className={cn(
            "flex flex-col leading-tight",
            isCollapsed ? "items-center mt-1" : "ml-auto items-end",
          )}
        >
          <span className="text-xs text-muted-foreground font-body">
            {isLoading ? "—" : column.cards.length}
          </span>
          {!isLoading && ownerlessCount > 0 && !isCollapsed && (
            <span className="text-[10px] text-destructive font-body">
              {ownerlessCount} sem dono
            </span>
          )}
        </div>
        {!isCollapsed && (onAddBefore || onAddAfter || onRename || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/60 hover:text-foreground opacity-60 hover:opacity-100"
                aria-label="Opções da etapa"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onAddBefore && (
                <DropdownMenuItem onClick={onAddBefore}>
                  <ArrowLeftToLine className="h-4 w-4 mr-2" />
                  Adicionar etapa à esquerda
                </DropdownMenuItem>
              )}
              {onAddAfter && (
                <DropdownMenuItem onClick={onAddAfter}>
                  <ArrowRightToLine className="h-4 w-4 mr-2" />
                  Adicionar etapa à direita
                </DropdownMenuItem>
              )}
              {(onAddBefore || onAddAfter) && (onRename || onDelete) && (
                <DropdownMenuSeparator />
              )}
              {onRename && (
                <DropdownMenuItem onClick={onRename}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Renomear etapa
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir etapa
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Column body — scrolls vertically and acts as the drop zone */}
      {!isCollapsed && (
        <div
          onDragOver={(e) => {
            if (!draggedCardId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!isOver) setIsOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsOver(false);
            setOverIndex(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const idx = overIndex;
            setIsOver(false);
            setOverIndex(null);
            onDropOnColumn(column.id, idx ?? column.cards.length);
          }}
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin pr-1 rounded-lg transition-colors border border-dashed",
            isOver
              ? "bg-primary/10 ring-2 ring-primary/40 ring-inset border-primary/60"
              : showValidHint
                ? "border-primary/40 bg-primary/[0.03]"
                : "border-transparent",
          )}
        >
          <div className="space-y-1.5 min-h-[120px] p-1">
            {isLoading && column.cards.length === 0 ? (
              <>
                <KanbanCardSkeleton />
                <KanbanCardSkeleton />
                <KanbanCardSkeleton />
              </>
            ) : column.cards.length === 0 ? (
              <EmptyColumnHint />
            ) : (
              column.cards.map((card, cardIdx) => {
                const isFocused = focusCardId && focusCardId === card.id;
                const showInsertAbove = isOver && overIndex === cardIdx && draggedCardId !== card.id;
                return (
                  <div
                    key={card.id}
                    data-card-id={card.id}
                    ref={(el) => {
                      if (el && isFocused) {
                        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* noop */ }
                      }
                    }}
                    onDragOver={(e) => {
                      if (!draggedCardId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const before = e.clientY < rect.top + rect.height / 2;
                      const next = before ? cardIdx : cardIdx + 1;
                      if (!isOver) setIsOver(true);
                      if (overIndex !== next) setOverIndex(next);
                    }}
                    className={cn(
                      "transition-all rounded-lg animate-fade-in",
                      isFocused && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background animate-pulse",
                      showInsertAbove && "mt-3 border-t-2 border-primary/60 pt-1",
                    )}
                  >
                    <KanbanCard
                      card={card}
                      onClick={onCardClick}
                      stageBorderClass={dotColor.replace("bg-", "border-l-")}
                      draggable
                      isDragging={draggedCardId === card.id}
                      onDragStart={(c) => onCardDragStart(c)}
                      onDragEnd={() => { onCardDragEnd(); setOverIndex(null); }}
                      onTemperatureChange={onTemperatureChange}
                      onDelete={onCardDelete}
                      onAssignAgent={onCardAssignAgent}
                      agentOptions={agentOptions}
                      onCreateQuote={onCardCreateQuote}
                      onViewConversation={onCardViewConversation}
                      onEdit={onCardEdit}
                      onArchive={onCardArchive}
                      onRenameClient={onCardRenameClient}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Collapsed: ainda aceita drop para mover cards (ex.: para Perdidos) */}
      {isCollapsed && (
        <div
          onDragOver={(e) => {
            if (!draggedCardId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!isOver) setIsOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsOver(false);
            onDropOnColumn(column.id);
          }}
          className={cn(
            "flex-1 min-h-[120px] rounded-lg transition-colors border border-dashed border-transparent",
            isOver && "bg-destructive/10 border-destructive/40",
          )}
          title="Solte aqui para marcar como Perdido"
        />
      )}
    </div>
  );
}


function AddColumnButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center w-[232px] shrink-0 rounded-xl",
        "min-h-[200px] border-2 border-dashed border-slate-300 dark:border-slate-700",
        "text-muted-foreground hover:text-foreground",
        "hover:border-slate-400 dark:hover:border-slate-600",
        "hover:bg-slate-100/50 dark:hover:bg-slate-900/30",
        "transition-colors"
      )}
    >
      <Plus className="h-5 w-5 mb-2" strokeWidth={1.5} />
      <span className="text-sm font-medium">Adicionar nova etapa</span>
    </button>
  );
}

function EmptyColumnHint() {
  return (
    <div className="flex items-center justify-center h-32 rounded-lg text-xs text-muted-foreground/50">
      Nenhum item
    </div>
  );
}

export default function CRM() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "ops" ? "ops" : "sales";
  const [tab, setTabState] = useState<"sales" | "ops">(initialTab);

  useEffect(() => {
    const urlTab = searchParams.get("tab") === "ops" ? "ops" : "sales";
    if (urlTab !== tab) setTabState(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const setTab = (v: "sales" | "ops") => {
    setTabState(v);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", v);
      return next;
    }, { replace: true });
  };

  // ?focus=lead-{id} — destaca e rola até o card no kanban de Vendas.
  // Garante a aba "sales" e mantém o foco por alguns segundos.
  const focusParam = searchParams.get("focus");
  const [focusCardId, setFocusCardId] = useState<string | null>(focusParam || null);
  useEffect(() => {
    if (!focusParam) return;
    setFocusCardId(focusParam);
    if (tab !== "sales") setTabState("sales");
    const t = window.setTimeout(() => {
      setFocusCardId(null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("focus");
        return next;
      }, { replace: true });
    }, 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam]);

  const SALES_STORAGE_KEY = "crm:columns:sales:v3";
  const OPS_STORAGE_KEY = "crm:columns:ops:v4";
  const LEGACY_KEYS = [
    "crm:columns:sales:v1",
    "crm:columns:sales:v2",
    "crm:columns:ops:v1",
    "crm:columns:ops:v2",
    "crm:columns:ops:v3",
  ];

  const loadColumns = (key: string, fallback: KanbanColumn[]): KanbanColumn[] => {
    if (typeof window === "undefined") return fallback;
    try {
      // Limpa quaisquer chaves antigas com mocks persistidos
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as KanbanColumn[];
      if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
      // Sanitiza: remove cards que não vieram do banco (sem prefixo lead-/quote-/manual-)
      const sanitized = parsed.map((col) => ({
        ...col,
        cards: col.cards.filter(
          (c) => c.id.startsWith("lead-") || c.id.startsWith("quote-") || c.id.startsWith("manual-"),
        ),
      }));
      // Garante que colunas obrigatórias do fallback existam (ex.: "Perdidos" foi
      // adicionada depois — usuários antigos não têm esta coluna no localStorage).
      const existingIds = new Set(sanitized.map((c) => c.id));
      fallback.forEach((fc) => {
        if (!existingIds.has(fc.id)) sanitized.push({ ...fc, cards: [] });
      });
      return sanitized;
    } catch {
      return fallback;
    }
  };

  const [salesColumns, setSalesColumns] = useState<KanbanColumn[]>(() =>
    loadColumns(SALES_STORAGE_KEY, INITIAL_SALES_COLUMNS),
  );
  const [opsColumns, setOpsColumns] = useState<KanbanColumn[]>(() =>
    loadColumns(OPS_STORAGE_KEY, INITIAL_OPS_COLUMNS),
  );

  useEffect(() => {
    try {
      localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(salesColumns));
    } catch {
      /* ignore */
    }
  }, [salesColumns]);

  useEffect(() => {
    try {
      localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(opsColumns));
    } catch {
      /* ignore */
    }
  }, [opsColumns]);

  // ─── Sync inbound leads (from WhatsApp AI / manual quick-create) into the
  // "Novos Leads (IA)" column. We poll every 30s so newly captured leads show
  // up automatically without a page refresh.
  const [leadsRefreshTick, setLeadsRefreshTick] = useState(0);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone, source, destination, travel_date_start, travel_date_end, flexible_dates_description, travelers_count, budget_estimate, ai_summary, created_at, is_returning, returned_at, assigned_user_id")
        .is("converted_client_id", null)
        .or("archived.is.null,archived.eq.false")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error || cancelled || !data) {
        if (!cancelled) setIsLoadingLeads(false);
        return;
      }

      // Mapa user_id → { name, avatarUrl } para popular agent
      const assignedIds = Array.from(
        new Set(
          (data as any[])
            .map((l) => l.assigned_user_id)
            .filter((v): v is string => !!v),
        ),
      );
      const userById = new Map<string, { name: string; avatarUrl?: string | null }>();
      if (assignedIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic")
          .select("user_id, full_name, email, avatar_url")
          .in("user_id", assignedIds);
        (profs ?? []).forEach((p: any) => {
          if (p.user_id) {
            userById.set(p.user_id, {
              name: p.full_name || p.email || "Usuário",
              avatarUrl: p.avatar_url ?? null,
            });
          }
        });
      }

      // Mantém temperatura/stageEnteredAt já existentes para cards de leads
      const existingByLeadId = new Map<string, KanbanCardData>();
      setSalesColumns((prevSnap) => {
        prevSnap.forEach((col) =>
          col.cards.forEach((c) => {
            if (c.id.startsWith("lead-")) existingByLeadId.set(c.id, c);
          }),
        );
        return prevSnap;
      });

      const leadCards: KanbanCardData[] = data.map((l: any) => {
        const id = `lead-${l.id}`;
        const existing = existingByLeadId.get(id);
        const hasTravelData =
          !!l.destination &&
          (!!l.travel_date_start || !!l.travel_date_end || !!l.flexible_dates_description) &&
          !!l.travelers_count;
        const isFromWhatsApp = l.source === "whatsapp_ai" || l.source === "whatsapp";
        const isAI = isFromWhatsApp; // origem WhatsApp (com ou sem IA ativa) ganha o badge "IA"
        const assignedUser = l.assigned_user_id ? userById.get(l.assigned_user_id) : null;
        return {
          id,
          clientName: l.full_name,
          phone: l.phone ?? undefined,
          destination: l.destination ?? undefined,
          travelDate: l.travel_date_start
            ? new Date(l.travel_date_start).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
            : (l.flexible_dates_description ?? undefined),
          travelDateISO: l.travel_date_start ?? undefined,
          travelersCount: l.travelers_count ?? undefined,
          estimatedValue: l.budget_estimate ? Number(l.budget_estimate) : undefined,
          isAILead: isAI,
          isManualLead: !isAI,
          aiSummary: l.ai_summary ?? undefined,
          source: l.source ?? undefined,
          contactLevel: hasTravelData ? "lead" : "prospect",
          isReturning: !!l.is_returning,
          stageEnteredAt: existing?.stageEnteredAt ?? l.created_at ?? new Date().toISOString(),
          lastContactAt: l.last_contact_at ?? l.updated_at ?? l.created_at ?? undefined,
          temperature: existing?.temperature ?? (l.lead_temperature as LeadTemperature | null) ?? undefined,
          agent: assignedUser
            ? {
                id: l.assigned_user_id,
                name: assignedUser.name,
                avatarUrl: assignedUser.avatarUrl ?? undefined,
              }
            : undefined,
          tags: [
            l.travelers_count ? { label: `${l.travelers_count} viajante(s)`, tone: "blue" as const } : null,
            isFromWhatsApp ? { label: "WhatsApp", tone: "green" as const } : null,
          ].filter(Boolean) as KanbanCardData["tags"],
        };
      });

      // IDs de leads existentes no banco (TODOS — incl. já convertidos) para
      // limpar órfãos do localStorage sem remover cards já promovidos a Cliente.
      const { data: allLeadIds } = await supabase.from("leads").select("id").limit(1000);
      if (cancelled) return;
      const validLeadIds = new Set((allLeadIds ?? []).map((l: any) => `lead-${l.id}`));

      // Busca também os IDs de cotações existentes para limpar cards quote-* órfãos
      const { data: quotesData } = await supabase
        .from("quotes")
        .select("id")
        .limit(1000);
      if (cancelled) return;
      const validQuoteIds = new Set((quotesData ?? []).map((q: any) => `quote-${q.id}`));

      // Busca contacts para identificar quais leads já viraram Cliente e se
      // têm dados pendentes (needs_complementary_data).
      const { data: contactsData } = await (supabase as any)
        .from("contacts")
        .select("lead_id, level, needs_complementary_data")
        .not("lead_id", "is", null)
        .limit(2000);
      if (cancelled) return;
      const contactByLeadId = new Map<string, { level: string; needsData: boolean }>();
      (contactsData ?? []).forEach((c: any) => {
        if (c.lead_id) {
          contactByLeadId.set(c.lead_id, {
            level: c.level,
            needsData: !!c.needs_complementary_data,
          });
        }
      });

      const isCardStillValid = (cardId: string): boolean => {
        if (cardId.startsWith("lead-")) return validLeadIds.has(cardId);
        if (cardId.startsWith("quote-")) return validQuoteIds.has(cardId);
        if (cardId.startsWith("manual-")) return true; // mantém cards manuais
        return false;
      };

      // Aplica nível de contato + alerta de cadastro incompleto a um card
      const enrichCard = (c: KanbanCardData): KanbanCardData => {
        if (!c.id.startsWith("lead-")) return c;
        const leadId = c.id.slice("lead-".length);
        const info = contactByLeadId.get(leadId);
        if (!info) return c;
        const level = info.level === "cliente" ? "cliente" : info.level === "lead" ? "lead" : "prospect";
        const alert = info.level === "cliente" && info.needsData
          ? { label: "Cadastro incompleto", tone: "warning" as const }
          : c.alert?.label === "Cadastro incompleto"
            ? undefined
            : c.alert;
        return { ...c, contactLevel: level as KanbanCardData["contactLevel"], alert };
      };

      setSalesColumns((prev) => {
        // IDs de leads que já estão em OUTRAS colunas (não devem voltar para "Novos Contatos")
        // EXCETO os marcados como is_returning (devem voltar para a primeira coluna)
        const returningLeadIds = new Set(
          leadCards.filter((c) => c.isReturning).map((c) => c.id),
        );
        const idsInOtherColumns = new Set<string>();
        prev.forEach((col) => {
          if (col.id !== "new-leads") {
            col.cards.forEach((c) => {
              if (c.id.startsWith("lead-") && !returningLeadIds.has(c.id)) {
                idsInOtherColumns.add(c.id);
              }
            });
          }
        });
        const filteredLeadCards = leadCards
          .filter((c) => !idsInOtherColumns.has(c.id))
          .map(enrichCard);

        return prev.map((col) => {
          if (col.id === "new-leads") {
            return { ...col, cards: filteredLeadCards };
          }
          // Outras colunas: remove órfãos (leads/cotações excluídos) + cards retornados (foram para new-leads) + enriquece
          return {
            ...col,
            cards: col.cards
              .filter((c) => isCardStillValid(c.id) && !returningLeadIds.has(c.id))
              .map(enrichCard),
          };
        });
      });

      // Também sanitiza o kanban de Operações (ops)
      setOpsColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.filter((c) => isCardStillValid(c.id)).map(enrichCard),
        })),
      );

      // Processa sinais de auto-move (ex.: criada cotação a partir do CTA do modal de validação)
      try {
        const raw = localStorage.getItem("crm:autoMove");
        if (raw) {
          const signals: Array<{ leadId: string; toColumnId: string }> = JSON.parse(raw);
          if (Array.isArray(signals) && signals.length > 0) {
            // Só consome sinais cujo lead realmente possui cotação vinculada agora
            const leadIdsToCheck = signals.map((s) => s.leadId).filter(Boolean);
            const leadsWithQuote = new Set<string>();
            if (leadIdsToCheck.length > 0) {
              const { data: linkedQuotes } = await supabase
                .from("quotes")
                .select("lead_id")
                .in("lead_id", leadIdsToCheck);
              (linkedQuotes ?? []).forEach((q: any) => {
                if (q.lead_id) leadsWithQuote.add(q.lead_id);
              });
            }
            const consumed: typeof signals = [];
            const remaining: typeof signals = [];
            signals.forEach((s) => {
              if (leadsWithQuote.has(s.leadId)) consumed.push(s);
              else remaining.push(s);
            });
            if (consumed.length > 0) {
              setSalesColumns((prev) => {
                let next = prev;
                consumed.forEach(({ leadId, toColumnId }) => {
                  const cardId = `lead-${leadId}`;
                  let moving: KanbanCardData | null = null;
                  let fromTitle = "";
                  const stripped = next.map((col) => {
                    const idx = col.cards.findIndex((c) => c.id === cardId);
                    if (idx === -1) return col;
                    if (col.id === toColumnId) {
                      moving = col.cards[idx];
                      return col;
                    }
                    moving = col.cards[idx];
                    fromTitle = col.title;
                    return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
                  });
                  if (!moving) return;
                  const moved: KanbanCardData = {
                    ...(moving as KanbanCardData),
                    stageEnteredAt: new Date().toISOString(),
                  };
                  next = stripped.map((col) => {
                    if (col.id !== toColumnId) return col;
                    if (col.cards.some((c) => c.id === cardId)) return col;
                    return { ...col, cards: [moved, ...col.cards] };
                  });
                  const targetCol = next.find((c) => c.id === toColumnId);
                  if (targetCol && fromTitle) {
                    void logLeadHistory(leadId, fromTitle, targetCol.title, false);
                  }
                });
                return next;
              });
              toast.success("Card movido para \"Cotação\" automaticamente.");
            }
            localStorage.setItem("crm:autoMove", JSON.stringify(remaining));
          }
        }
      } catch (err) {
        console.error("[crm:autoMove] error:", err);
      }
      if (!cancelled) setIsLoadingLeads(false);
    };
    fetchLeads();
    const interval = setInterval(fetchLeads, 30_000);

    // Realtime: novo lead chegou pelo webhook → atualiza Kanban imediatamente.
    const channel = supabase
      .channel("crm-leads-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          console.log("[CRM] novo lead detectado via realtime:", payload.new);
          fetchLeads();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        () => fetchLeads(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [leadsRefreshTick]);

  // Add column dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [insertIndex, setInsertIndex] = useState<number | null>(null);


  // Rename column dialog
  const [columnToRename, setColumnToRename] = useState<KanbanColumn | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Delete confirmation
  const [columnToDelete, setColumnToDelete] = useState<KanbanColumn | null>(null);

  // ─── Promoção a Cliente (ao mover para "Fechado") ──────────
  const [promotionLeadId, setPromotionLeadId] = useState<string | null>(null);
  const [promotionPendingMove, setPromotionPendingMove] = useState<PendingMove | null>(null);
  const [promotionOpen, setPromotionOpen] = useState(false);

  // ─── Excluir card direto do CRM ─────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<DeleteContactTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleCardDelete = async (card: KanbanCardData) => {
    const leadId = card.id.startsWith("lead-") ? card.id.slice("lead-".length) : null;
    if (!leadId) {
      toast.error("Este card não está vinculado a um lead no banco e não pode ser excluído por aqui.");
      return;
    }
    // Busca o contact correspondente para construir o target
    const { data: contact } = await (supabase as any)
      .from("contacts")
      .select("id, level, client_id, full_name")
      .eq("lead_id", leadId)
      .maybeSingle();
    const level = (contact?.level as DeleteContactTarget["level"]) ?? "lead";
    setDeleteTarget({
      contactId: contact?.id ?? null,
      clientId: contact?.client_id ?? null,
      leadId,
      fullName: contact?.full_name ?? card.clientName,
      level,
    });
    setDeleteOpen(true);
  };

  const handleAfterDelete = () => {
    if (!deleteTarget?.leadId) return;
    const cardId = `lead-${deleteTarget.leadId}`;
    setSalesColumns((prev) =>
      prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
    );
    setOpsColumns((prev) =>
      prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
    );
    setDeleteTarget(null);
  };

  const setColumns = tab === "sales" ? setSalesColumns : setOpsColumns;
  const columns = tab === "sales" ? salesColumns : opsColumns;

  // ─── Drag & Drop ─────────────────────────────────────────
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [draggedFromColumnId, setDraggedFromColumnId] = useState<string | null>(null);

  const handleCardDragStart = (card: KanbanCardData) => {
    setDraggedCardId(card.id);
    const src = columns.find((c) => c.cards.some((k) => k.id === card.id));
    setDraggedFromColumnId(src?.id ?? null);
  };
  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    setDraggedFromColumnId(null);
  };

  // Compute valid drop targets: same column (reorder) or adjacent ±1.
  // The "lost" column is always a valid target in sales funnel.
  const validTargetColumnIds = useMemo(() => {
    if (!draggedFromColumnId) return null as Set<string> | null;
    const fromIdx = columns.findIndex((c) => c.id === draggedFromColumnId);
    if (fromIdx === -1) return null;
    const set = new Set<string>();
    set.add(columns[fromIdx].id);
    if (fromIdx - 1 >= 0) set.add(columns[fromIdx - 1].id);
    if (fromIdx + 1 < columns.length) set.add(columns[fromIdx + 1].id);
    if (tab === "sales") set.add("lost");
    return set;
  }, [draggedFromColumnId, columns, tab]);

  // ─── Validation modal state ───────────────────────────────
  type PendingMove = {
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    fromTitle: string;
    toTitle: string;
    leadId: string | null;
  };
  type Issue = { title: string; detail: string; cta?: { label: string; onClick: () => void } };
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingIssues, setPendingIssues] = useState<Issue[]>([]);
  const [validating, setValidating] = useState(false);

  // Modal: atribuir responsável (bloqueia entrada em "Em Qualificação" sem agente)
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCardId, setAssignCardId] = useState<string | null>(null);
  const [assignTargetColumn, setAssignTargetColumn] = useState<string | null>(null);
  const [responsibleOptions, setResponsibleOptions] = useState<{ user_id: string; full_name: string; avatar_url?: string | null }[]>([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState<string>("");

  // Modal: motivo de perda (ao mover para "Perdidos")
  const [lostOpen, setLostOpen] = useState(false);
  const [lostMove, setLostMove] = useState<PendingMove | null>(null);
  const [lostReason, setLostReason] = useState<string>("Sem resposta");
  const [lostDetails, setLostDetails] = useState<string>("");

  // Colapso de colunas (Perdidos colapsada por padrão)
  const COLLAPSE_KEY = "crm:columns:collapsed:v1";
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(["lost"]);
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (!raw) return new Set(["lost"]);
      const parsed = JSON.parse(raw) as string[];
      return new Set(Array.isArray(parsed) ? parsed : ["lost"]);
    } catch {
      return new Set(["lost"]);
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(collapsedCols)));
    } catch {
      /* ignore */
    }
  }, [collapsedCols]);
  const toggleColumnCollapse = (columnId: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  };
  const COLLAPSIBLE_COLUMN_IDS = useMemo(() => new Set(["lost"]), []);

  useEffect(() => {
    // carrega lista de responsáveis (usuários) do sistema
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles_basic")
        .select("user_id, full_name, email, avatar_url")
        .order("full_name");
      if (!cancelled && data) {
        setResponsibleOptions(
          (data as any[]).map((u) => ({
            user_id: u.user_id,
            full_name: u.full_name || u.email || "Usuário",
            avatar_url: u.avatar_url ?? null,
          })),
        );
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const extractLeadId = (cardId: string): string | null =>
    cardId.startsWith("lead-") ? cardId.slice("lead-".length) : null;

  const logLeadHistory = async (
    leadId: string | null,
    fromTitle: string,
    toTitle: string,
    forced: boolean,
  ) => {
    if (!leadId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userName = user?.email ?? null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (prof?.full_name) userName = prof.full_name;
      }
      await supabase.from("lead_history").insert({
        lead_id: leadId,
        user_id: user?.id ?? null,
        user_name: userName,
        action: "stage_moved",
        description: forced
          ? `Movido de "${fromTitle}" para "${toTitle}" (movimentação forçada)`
          : `Movido de "${fromTitle}" para "${toTitle}"`,
        from_stage: fromTitle,
        to_stage: toTitle,
        forced,
      });
    } catch (err) {
      console.error("[lead_history] insert error:", err);
    }
  };

  // Move o card de fato no estado e registra no histórico
  const performMove = (move: PendingMove, forced: boolean) => {
    setColumns((prev) => {
      let moving: KanbanCardData | null = null;
      const stripped = prev.map((col) => {
        const idx = col.cards.findIndex((c) => c.id === move.cardId);
        if (idx === -1) return col;
        moving = col.cards[idx];
        if (col.id === move.toColumnId) return col;
        return { ...col, cards: col.cards.filter((c) => c.id !== move.cardId) };
      });
      if (!moving) return prev;
      const wasReturning = (moving as KanbanCardData).isReturning;
      const movedCard: KanbanCardData = {
        ...(moving as KanbanCardData),
        // Saindo de "Novos Contatos": consultor já viu, limpa o badge "Retornou"
        isReturning: move.toColumnId === "new-leads" ? (moving as KanbanCardData).isReturning : false,
        stageEnteredAt: new Date().toISOString(),
      };
      const next = stripped.map((col) =>
        col.id === move.toColumnId ? { ...col, cards: [movedCard, ...col.cards] } : col,
      );
      return next;
    });
    if (forced) {
      toast.warning(`Lead movido para "${move.toTitle}" (movimentação forçada).`);
    } else {
      toast.success(`Lead movido para "${move.toTitle}".`);
    }
    void logLeadHistory(move.leadId, move.fromTitle, move.toTitle, forced);
    // Persiste limpeza do retorno no banco se saiu de Novos Contatos
    if (move.toColumnId !== "new-leads" && move.leadId) {
      void supabase.from("leads").update({ is_returning: false }).eq("id", move.leadId);
      // Também limpa no contact (via lead_id)
      void (supabase as any)
        .from("contacts")
        .update({ is_returning: false })
        .eq("lead_id", move.leadId);
    }
  };

  // Confirma a perda: registra motivo no banco e move o card para "Perdidos"
  const confirmLost = async () => {
    if (!lostMove) {
      setLostOpen(false);
      return;
    }
    const reason = lostReason.trim();
    if (!reason) {
      toast.error("Selecione um motivo da perda.");
      return;
    }
    if (reason === "Outro" && !lostDetails.trim()) {
      toast.error("Descreva o motivo no campo de texto.");
      return;
    }
    if (lostMove.leadId) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let userName = user?.email ?? null;
        if (user?.id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();
          if (prof?.full_name) userName = prof.full_name;
        }
        await (supabase as any).from("lead_loss_reasons").insert({
          lead_id: lostMove.leadId,
          reason,
          details: lostDetails.trim() || null,
          user_id: user?.id ?? null,
          user_name: userName,
        });
      } catch (err) {
        console.error("[lead_loss_reasons] insert error:", err);
        toast.error("Não foi possível registrar o motivo. O card será movido mesmo assim.");
      }
    }
    performMove(lostMove, false);
    setLostOpen(false);
    setLostMove(null);
    setLostReason("Sem resposta");
    setLostDetails("");
  };

  // Avalia restrições por coluna de destino. Devolve a lista de issues; vazia = pode mover.
  const validateMove = async (
    card: KanbanCardData,
    toColumnId: string,
    leadId: string | null,
  ): Promise<Issue[]> => {
    const issues: Issue[] = [];

    if (toColumnId === "qualifying") {
      if (!card.agent) {
        // tratado por modal próprio (assign), não pelo modal de issues
        return [{ title: "Sem responsável atribuído", detail: "Esta etapa exige um consultor responsável." }];
      }
    }

    if (!leadId) {
      // cards sem lead_id (ex.: legado/manual sem prefix) não podem validar quotes
      if (toColumnId === "quote" || toColumnId === "proposal-sent" || toColumnId === "closed") {
        issues.push({
          title: "Lead não vinculado",
          detail: "Este card não está vinculado a um lead no banco — não foi possível validar cotações ou pagamentos.",
        });
      }
      return issues;
    }

    if (toColumnId === "quote") {
      const { data, error } = await supabase
        .from("quotes")
        .select("id")
        .eq("lead_id", leadId)
        .limit(1);
      if (!error && (!data || data.length === 0)) {
        issues.push({
          title: "Nenhuma cotação vinculada",
          detail: "Para mover para Cotação, é necessário ter ao menos uma cotação criada para este lead.",
          cta: {
            label: "Criar cotação para este lead",
            onClick: () => {
              // Sinaliza ao CRM para mover este card para "Cotação" assim que a
              // cotação for salva e vinculada ao lead.
              try {
                const raw = localStorage.getItem("crm:autoMove");
                const list: Array<{ leadId: string; toColumnId: string }> = raw ? JSON.parse(raw) : [];
                const filtered = list.filter((x) => x.leadId !== leadId);
                filtered.push({ leadId, toColumnId: "quote" });
                localStorage.setItem("crm:autoMove", JSON.stringify(filtered));
              } catch {
                /* ignore */
              }
              navigate("/quotes", { state: { newQuote: true, leadId } });
            },
          },
        });
      }
    }

    if (toColumnId === "proposal-sent") {
      const sentStages = ["sent", "negotiation", "confirmed", "issued", "completed", "post_sale"] as const;
      const { data, error } = await supabase
        .from("quotes")
        .select("id, stage")
        .eq("lead_id", leadId)
        .in("stage", sentStages)
        .limit(1);
      if (!error && (!data || data.length === 0)) {
        issues.push({
          title: "Nenhuma proposta enviada",
          detail: "Nenhuma cotação deste lead foi marcada como enviada (Enviada/Negociação/Confirmada).",
        });
      }
    }

    if (toColumnId === "closed") {
      const { data: quotesData } = await supabase
        .from("quotes")
        .select("id")
        .eq("lead_id", leadId);
      const quoteIds = (quotesData ?? []).map((q: any) => q.id);
      let hasPaid = false;
      if (quoteIds.length > 0) {
        const { data: paid } = await supabase
          .from("financial_transactions")
          .select("id")
          .eq("type", "income")
          .eq("status", "paid")
          .in("quote_id", quoteIds)
          .limit(1);
        hasPaid = !!(paid && paid.length > 0);
      }
      if (!hasPaid) {
        issues.push({
          title: "Sem pagamento confirmado",
          detail: "Para mover para Fechado, é necessário ao menos uma receita paga vinculada a uma cotação deste lead.",
        });
      }
    }

    return issues;
  };

  // Reorder cards within the same column (drag-to-prioritize)
  const reorderWithinColumn = (columnId: string, cardId: string, targetIndex: number) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id !== columnId) return col;
        const fromIdx = col.cards.findIndex((c) => c.id === cardId);
        if (fromIdx === -1) return col;
        const next = col.cards.slice();
        const [moved] = next.splice(fromIdx, 1);
        const insertAt = Math.max(0, Math.min(next.length, targetIndex > fromIdx ? targetIndex - 1 : targetIndex));
        next.splice(insertAt, 0, moved);
        return { ...col, cards: next };
      }),
    );
  };

  const handleDropOnColumn = async (targetColumnId: string, targetIndex?: number) => {
    if (!draggedCardId) return;
    const draggedId = draggedCardId;
    setDraggedCardId(null);
    setDraggedFromColumnId(null);

    const sourceColumn = columns.find((c) => c.cards.some((k) => k.id === draggedId));
    if (!sourceColumn) return;
    // Same column: reorder (drag-to-prioritize)
    if (sourceColumn.id === targetColumnId) {
      if (typeof targetIndex === "number") {
        reorderWithinColumn(sourceColumn.id, draggedId, targetIndex);
      }
      return;
    }
    // Block invalid (non-adjacent) cross-column moves silently
    if (validTargetColumnIds && !validTargetColumnIds.has(targetColumnId)) {
      toast.warning("Movimento inválido: arraste para uma etapa adjacente.");
      return;
    }
    const card = sourceColumn.cards.find((c) => c.id === draggedId);
    const targetColumn = columns.find((c) => c.id === targetColumnId);
    if (!card || !targetColumn) return;

    const leadId = extractLeadId(card.id);
    const move: PendingMove = {
      cardId: card.id,
      fromColumnId: sourceColumn.id,
      toColumnId: targetColumnId,
      fromTitle: sourceColumn.title,
      toTitle: targetColumn.title,
      leadId,
    };

    // Caso especial: "Em Qualificação" sem responsável → modal próprio
    if (tab === "sales" && targetColumnId === "qualifying" && !card.agent) {
      setAssignCardId(card.id);
      setAssignTargetColumn(targetColumnId);
      setSelectedResponsibleId("");
      setAssignOpen(true);
      return;
    }

    // Caso especial: "Perdidos" → abre modal pedindo motivo da perda
    if (tab === "sales" && targetColumnId === "lost") {
      setLostMove(move);
      setLostReason("Sem resposta");
      setLostDetails("");
      setLostOpen(true);
      return;
    }

    // Validações específicas só para o funil de vendas
    if (tab !== "sales") {
      performMove(move, false);
      return;
    }

    setValidating(true);
    try {
      const issues = await validateMove(card, targetColumnId, leadId);
      if (issues.length === 0) {
        // Caso especial: mover para "Fechado" → promove Lead em Cliente
        if (targetColumnId === "closed" && leadId) {
          setPromotionLeadId(leadId);
          setPromotionPendingMove(move);
          setPromotionOpen(true);
        } else {
          performMove(move, false);
        }
      } else {
        setPendingMove(move);
        setPendingIssues(issues);
      }
    } finally {
      setValidating(false);
    }
  };

  // Após promoção bem-sucedida no modal: move o card para "Fechado",
  // adiciona ao Kanban de Operações em "Pré-Viagem" e atualiza badge/alertas.
  const handlePromotionDone = (result: {
    clientId: string;
    contactId: string | null;
    needsComplementaryData: boolean;
  }) => {
    const move = promotionPendingMove;
    setPromotionPendingMove(null);
    setPromotionLeadId(null);
    if (!move) return;

    const incompleteAlert = result.needsComplementaryData
      ? { label: "Cadastro incompleto", tone: "warning" as const }
      : undefined;

    // 1. Mover o card para "Fechado" no funil de vendas e marcar como Cliente
    setSalesColumns((prev) => {
      let moving: KanbanCardData | null = null;
      const stripped = prev.map((col) => {
        const idx = col.cards.findIndex((c) => c.id === move.cardId);
        if (idx === -1) return col;
        moving = col.cards[idx];
        if (col.id === move.toColumnId) return col;
        return { ...col, cards: col.cards.filter((c) => c.id !== move.cardId) };
      });
      if (!moving) return prev;
      const movedCard: KanbanCardData = {
        ...(moving as KanbanCardData),
        contactLevel: "cliente",
        alert: incompleteAlert,
        stageEnteredAt: new Date().toISOString(),
      };
      return stripped.map((col) =>
        col.id === move.toColumnId
          ? {
              ...col,
              cards: col.cards.some((c) => c.id === move.cardId)
                ? col.cards.map((c) => (c.id === move.cardId ? movedCard : c))
                : [movedCard, ...col.cards],
            }
          : col,
      );
    });

    // 2. Espelhar o card no Kanban de Operações em "Pré-Viagem"
    setOpsColumns((prev) => {
      const sourceCard =
        salesColumns.flatMap((c) => c.cards).find((c) => c.id === move.cardId) ?? null;
      if (!sourceCard) return prev;
      const opsCard: KanbanCardData = {
        ...sourceCard,
        contactLevel: "cliente",
        alert: incompleteAlert,
        stageEnteredAt: new Date().toISOString(),
      };
      return prev.map((col) => {
        if (col.id !== "pre-trip") {
          return { ...col, cards: col.cards.filter((c) => c.id !== move.cardId) };
        }
        if (col.cards.some((c) => c.id === move.cardId)) {
          return {
            ...col,
            cards: col.cards.map((c) => (c.id === move.cardId ? opsCard : c)),
          };
        }
        return { ...col, cards: [opsCard, ...col.cards] };
      });
    });

    toast.success(`Lead promovido a Cliente e movido para "${move.toTitle}".`);
    void logLeadHistory(move.leadId, move.fromTitle, move.toTitle, false);
  };

  const handleTemperatureChange = async (card: KanbanCardData, next: LeadTemperature) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? { ...c, temperature: next } : c)),
      })),
    );
    const leadId = extractLeadId(card.id);
    if (!leadId) return;
    const { error } = await supabase
      .from("leads")
      .update({ lead_temperature: next } as any)
      .eq("id", leadId);
    if (error) {
      console.error("[CRM] update temperature error:", error);
      toast.error("Não foi possível salvar a temperatura.");
    }
  };

  // ─── Quick actions do menu de 3 pontos do card ─────────────
  const handleCardAssignAgent = async (card: KanbanCardData, userId: string) => {
    const responsible = responsibleOptions.find((r) => r.user_id === userId);
    if (!responsible) return;
    const leadId = extractLeadId(card.id);
    if (leadId) {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_user_id: userId } as any)
        .eq("id", leadId);
      if (error) {
        console.error("[CRM] quick assign error:", error);
        toast.error("Não foi possível atribuir o responsável.");
        return;
      }
    }
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) =>
          c.id === card.id
            ? {
                ...c,
                agent: {
                  id: responsible.user_id,
                  name: responsible.full_name,
                  avatarUrl: responsible.avatar_url ?? undefined,
                },
              }
            : c,
        ),
      })),
    );
    toast.success(`Responsável atribuído: ${responsible.full_name}`);
  };

  const handleCardCreateQuote = (card: KanbanCardData) => {
    const leadId = extractLeadId(card.id);
    if (!leadId) {
      toast.error("Lead inválido para criar cotação.");
      return;
    }
    navigate(`/quotes?new=1&lead_id=${leadId}`);
  };

  const handleCardViewConversation = (card: KanbanCardData) => {
    if (!card.phone) {
      toast.error("Este lead não tem telefone vinculado a uma conversa.");
      return;
    }
    navigate(`/service-center?phone=${encodeURIComponent(card.phone)}`);
  };

  const handleCardEdit = (card: KanbanCardData) => {
    navigate(`/crm/lead/${card.id}`);
  };

  const [archiveTarget, setArchiveTarget] = useState<KanbanCardData | null>(null);
  const handleCardArchive = (card: KanbanCardData) => {
    setArchiveTarget(card);
  };
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const leadId = extractLeadId(archiveTarget.id);
    if (!leadId) {
      toast.error("Card sem lead vinculado.");
      setArchiveTarget(null);
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({ archived: true, archived_at: new Date().toISOString() } as any)
      .eq("id", leadId);
    if (error) {
      console.error("[CRM] archive error:", error);
      toast.error("Não foi possível arquivar.");
      return;
    }
    const cardId = archiveTarget.id;
    setSalesColumns((prev) => prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })));
    setOpsColumns((prev) => prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })));
    toast.success("Card arquivado.");
    setArchiveTarget(null);
  };

  // Renomear o contato inline no card. Atualiza leads.full_name (trigger
  // sync_contact_from_lead propaga para contacts → reflete na Central, CRM e
  // listagens). Para o nome aparecer imediatamente, também atualizamos o estado
  // local do board.
  const handleCardRenameClient = async (card: KanbanCardData, newName: string) => {
    const finalName = newName.trim();
    if (!finalName) return;
    const leadId = extractLeadId(card.id);
    if (!leadId) {
      toast.error("Card sem lead vinculado.");
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({ full_name: finalName } as any)
      .eq("id", leadId);
    if (error) {
      console.error("[CRM] rename lead error:", error);
      toast.error("Não foi possível salvar o nome.");
      throw error;
    }
    setSalesColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? { ...c, clientName: finalName } : c)),
      })),
    );
    setOpsColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? { ...c, clientName: finalName } : c)),
      })),
    );
    toast.success("Nome atualizado.");
  };


  const handleConfirmAssign = async () => {
    if (!assignCardId || !assignTargetColumn) return;
    const responsible = responsibleOptions.find((r) => r.user_id === selectedResponsibleId);
    if (!responsible) {
      toast.error("Selecione um responsável.");
      return;
    }
    // Atualiza o card (atribui agente) + move
    const sourceColumn = columns.find((c) => c.cards.some((k) => k.id === assignCardId));
    const targetColumn = columns.find((c) => c.id === assignTargetColumn);
    if (!sourceColumn || !targetColumn) {
      setAssignOpen(false);
      return;
    }
    const card = sourceColumn.cards.find((c) => c.id === assignCardId);
    if (!card) {
      setAssignOpen(false);
      return;
    }
    // Persiste no banco (assigned_user_id) — trigger registra evento na timeline
    const leadId = extractLeadId(assignCardId);
    if (leadId) {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_user_id: responsible.user_id } as any)
        .eq("id", leadId);
      if (error) {
        console.error("[CRM] assign user error:", error);
        toast.error("Não foi possível salvar o responsável.");
        return;
      }
    }
    // Atribui agente no estado
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) =>
          c.id === assignCardId
            ? {
                ...c,
                agent: {
                  id: responsible.user_id,
                  name: responsible.full_name,
                  avatarUrl: responsible.avatar_url ?? undefined,
                },
              }
            : c,
        ),
      })),
    );
    const move: PendingMove = {
      cardId: assignCardId,
      fromColumnId: sourceColumn.id,
      toColumnId: assignTargetColumn,
      fromTitle: sourceColumn.title,
      toTitle: targetColumn.title,
      leadId,
    };
    // Move imediatamente (consultor já atribuído satisfaz a regra)
    setTimeout(() => performMove(move, false), 0);
    setAssignOpen(false);
    setAssignCardId(null);
    setAssignTargetColumn(null);
  };


  // ─── Toolbar state (search + filters) ─────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterTemp, setFilterTemp] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  // Filtros específicos da aba Operações
  const [filterBoarding, setFilterBoarding] = useState<"all" | "7" | "15" | "30">("all");
  const [filterOpsStatus, setFilterOpsStatus] = useState<"all" | "normal" | "urgent" | "waiting">("all");
  const [filterDestination, setFilterDestination] = useState<string>("all");

  // View mode (kanban | table) — persistido em localStorage
  const [viewMode, setViewMode] = useState<"kanban" | "table">(() => {
    if (typeof window === "undefined") return "kanban";
    const saved = window.localStorage.getItem("crm:viewMode");
    return saved === "table" ? "table" : "kanban";
  });
  const handleViewModeChange = (mode: "kanban" | "table") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("crm:viewMode", mode);
    }
  };

  const agentOptions = useMemo(() => {
    // Lista de consultores cadastrados na plataforma + nomes que já aparecem
    const map = new Map<string, string>();
    responsibleOptions.forEach((r) => map.set(r.full_name, r.full_name));
    columns.forEach((c) =>
      c.cards.forEach((k) => k.agent?.name && map.set(k.agent.name, k.agent.name)),
    );
    return Array.from(map.values()).sort();
  }, [columns, responsibleOptions]);

  // Contagem de leads ativos (não perdidos / fechados) por consultor
  const activeLeadsByUser = useMemo(() => {
    const counts = new Map<string, number>();
    columns.forEach((c) => {
      if (c.id === "lost" || c.id === "closed") return;
      c.cards.forEach((k) => {
        const id = k.agent?.id;
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      });
    });
    return counts;
  }, [columns]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    columns.forEach((c) => c.cards.forEach((k) => k.tags?.forEach((t) => set.add(t.label))));
    return Array.from(set).sort();
  }, [columns]);

  const destinationOptions = useMemo(() => {
    const set = new Set<string>();
    columns.forEach((c) =>
      c.cards.forEach((k) => {
        if (k.destination) set.add(k.destination);
      }),
    );
    return Array.from(set).sort();
  }, [columns]);

  // Mapeia `source` técnico → label legível para filtro
  const SOURCE_LABEL: Record<string, string> = {
    whatsapp: "WhatsApp",
    whatsapp_ai: "WhatsApp",
    manual: "Manual",
    phone: "Telefone",
    email: "E-mail",
    referral: "Indicação",
  };
  const normalizeSource = (s?: string): string => {
    if (!s) return "manual";
    return SOURCE_LABEL[s] ?? s;
  };

  const filteredColumns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        if (filterAgent === "__none__") {
          if (card.agent?.name) return false;
        } else if (filterAgent !== "all" && card.agent?.name !== filterAgent) {
          return false;
        }

        if (tab === "sales") {
          if (filterTag !== "all" && !card.tags?.some((t) => t.label === filterTag)) return false;
          if (filterTemp !== "all") {
            const t = card.temperature ?? "cold";
            if (filterTemp === "undefined") return false;
            if (t !== filterTemp) return false;
          }
          if (filterLevel !== "all" && (card.contactLevel ?? "prospect") !== filterLevel) return false;
          if (filterSource !== "all" && normalizeSource(card.source) !== filterSource) return false;
        } else {
          // Aba Operações: filtros operacionais
          if (filterBoarding !== "all") {
            if (!card.travelDateISO) return false;
            const t = new Date(card.travelDateISO).getTime();
            if (!Number.isFinite(t)) return false;
            const diffDays = (t - now) / day;
            const limit = Number(filterBoarding);
            if (diffDays < 0 || diffDays > limit) return false;
          }
          if (filterOpsStatus !== "all") {
            const isUrgent = card.alert?.tone === "destructive";
            const lastTs = card.lastContactAt ? new Date(card.lastContactAt).getTime() : NaN;
            const isWaiting =
              !isUrgent && Number.isFinite(lastTs) && (now - lastTs) / day >= 3;
            const status = isUrgent ? "urgent" : isWaiting ? "waiting" : "normal";
            if (status !== filterOpsStatus) return false;
          }
          if (filterDestination !== "all" && card.destination !== filterDestination) return false;
        }

        if (!q) return true;
        return (
          card.clientName.toLowerCase().includes(q) ||
          card.destination?.toLowerCase().includes(q) ||
          card.tags?.some((t) => t.label.toLowerCase().includes(q))
        );
      }),
    }));
  }, [columns, searchTerm, tab, filterAgent, filterTag, filterTemp, filterLevel, filterSource, filterBoarding, filterOpsStatus, filterDestination]);

  // ─── KPIs ────────────────────────────────────────────────
  const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);
  const totalLeads = allCards.length;
  const aiLeads = allCards.filter((c) => c.isAILead).length;
  const pipelineValue = allCards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  // Métricas: novos leads esta semana vs semana anterior (com base em stageEnteredAt como proxy de criação)
  const { newThisWeek, weekDeltaPct, weekDeltaPositive } = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const startThis = now - 7 * day;
    const startLast = now - 14 * day;
    let thisW = 0;
    let lastW = 0;
    allCards.forEach((c) => {
      const ts = c.stageEnteredAt ? new Date(c.stageEnteredAt).getTime() : NaN;
      if (!Number.isFinite(ts)) return;
      if (ts >= startThis) thisW += 1;
      else if (ts >= startLast) lastW += 1;
    });
    let pct = 0;
    let positive = true;
    if (lastW === 0 && thisW > 0) {
      pct = 100;
      positive = true;
    } else if (lastW > 0) {
      pct = Math.round(((thisW - lastW) / lastW) * 100);
      positive = pct >= 0;
    }
    return { newThisWeek: thisW, weekDeltaPct: pct, weekDeltaPositive: positive };
  }, [allCards]);

  // Métricas operacionais (aba Operações em Viagem)
  const opsMetrics = useMemo(() => {
    const inTripCol = opsColumns.find((c) => c.id === "in-trip");
    const preTripCol = opsColumns.find((c) => c.id === "pre-trip");
    const supportCol = opsColumns.find((c) => c.id === "support");
    const inTripCount = inTripCol?.cards.length ?? 0;
    const supportCount = supportCol?.cards.length ?? 0;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const boardingSoon =
      preTripCol?.cards.filter((c) => {
        if (!c.travelDateISO) return false;
        const t = new Date(c.travelDateISO).getTime();
        if (!Number.isFinite(t)) return false;
        const diff = t - now;
        return diff >= 0 && diff <= sevenDays;
      }).length ?? 0;
    return { inTripCount, boardingSoon, supportCount };
  }, [opsColumns]);

  const hasActiveFilters =
    searchTerm !== "" ||
    filterAgent !== "all" ||
    (tab === "sales" &&
      (filterTag !== "all" ||
        filterTemp !== "all" ||
        filterLevel !== "all" ||
        filterSource !== "all")) ||
    (tab === "ops" &&
      (filterBoarding !== "all" ||
        filterOpsStatus !== "all" ||
        filterDestination !== "all"));

  const handleCardClick = (card: KanbanCardData) => {
    const stage = columns.find((c) => c.cards.some((k) => k.id === card.id));
    try {
      sessionStorage.setItem(`crm:lead:${card.id}`, JSON.stringify(card));
    } catch {
      /* ignore */
    }
    const params = stage ? `?stage=${encodeURIComponent(stage.id)}` : "";
    navigate(`/crm/lead/${card.id}${params}`);
  };

  const openAddAt = (index: number | null) => {
    setInsertIndex(index);
    setNewColumnTitle("");
    setAddOpen(true);
  };

  const handleAddColumn = () => {
    const title = newColumnTitle.trim();
    if (!title) {
      toast.error("Informe um nome para a etapa.");
      return;
    }
    const newColumn: KanbanColumn = {
      id: `col-${Date.now()}`,
      title,
      cards: [],
    };
    setColumns((prev) => {
      if (insertIndex === null) return [...prev, newColumn];
      const next = [...prev];
      next.splice(insertIndex, 0, newColumn);
      return next;
    });
    setNewColumnTitle("");
    setInsertIndex(null);
    setAddOpen(false);
    toast.success(`Etapa "${title}" adicionada.`);
  };

  const handleAddBefore = (columnId: string) => {
    const idx = columns.findIndex((c) => c.id === columnId);
    if (idx >= 0) openAddAt(idx);
  };

  const handleAddAfter = (columnId: string) => {
    const idx = columns.findIndex((c) => c.id === columnId);
    if (idx >= 0) openAddAt(idx + 1);
  };

  const handleRequestRename = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (col) {
      setColumnToRename(col);
      setRenameTitle(col.title);
    }
  };

  const confirmRename = () => {
    const title = renameTitle.trim();
    if (!columnToRename) return;
    if (!title) {
      toast.error("Informe um nome para a etapa.");
      return;
    }
    setColumns((prev) =>
      prev.map((c) => (c.id === columnToRename.id ? { ...c, title } : c))
    );
    toast.success(`Etapa renomeada para "${title}".`);
    setColumnToRename(null);
    setRenameTitle("");
  };

  const handleRequestDelete = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (col) setColumnToDelete(col);
  };

  const confirmDelete = () => {
    if (!columnToDelete) return;
    setColumns((prev) => prev.filter((c) => c.id !== columnToDelete.id));
    toast.success(`Etapa "${columnToDelete.title}" removida.`);
    setColumnToDelete(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] min-h-0 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="px-6 pt-5 pb-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            CRM
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe leads, qualificações e operações em viagem em um só lugar.
          </p>

          {/* Linha: mini cards de métricas (esq) + seletor Funil/Operações (dir) */}
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div key={tab} className="flex flex-wrap items-stretch gap-2 animate-fade-in flex-1 min-w-0">
              {tab === "sales" ? (
                <>
                  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 min-w-[160px]">
                    <div className="p-1.5 rounded-md bg-background border border-border/50">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold text-foreground font-display tabular-nums">
                        {totalLeads}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Contatos no funil</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 min-w-[180px]">
                    <div className="p-1.5 rounded-md bg-background border border-border/50">
                      <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-semibold text-foreground font-display tabular-nums">
                          {newThisWeek}
                        </span>
                        {weekDeltaPct !== 0 && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                              weekDeltaPositive
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive",
                            )}
                            title="Variação vs. semana anterior"
                          >
                            {weekDeltaPositive ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                            {Math.abs(weekDeltaPct)}%
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">Novos esta semana</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 min-w-[180px]">
                    <div className="p-1.5 rounded-md bg-background border border-border/50">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold text-foreground font-display tabular-nums">
                        {formatCurrency(pipelineValue)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Pipeline estimado</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 min-w-[180px]">
                    <div className="p-1.5 rounded-md bg-background border border-border/50">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold text-foreground font-display tabular-nums">
                        {opsMetrics.inTripCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Clientes em viagem agora</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 min-w-[200px]">
                    <div className="p-1.5 rounded-md bg-background border border-border/50">
                      <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold text-foreground font-display tabular-nums">
                        {opsMetrics.boardingSoon}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Embarques nos próximos 7 dias</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 min-w-[200px]">
                    <div className="p-1.5 rounded-md bg-background border border-border/50">
                      <LifeBuoy className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold text-foreground font-display tabular-nums">
                        {opsMetrics.supportCount}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Chamados de suporte abertos</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Segmented control: Funil / Operações */}
            <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-card p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTab("sales")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium transition-colors",
                  tab === "sales"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-label="Funil de Vendas"
                aria-pressed={tab === "sales"}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Funil de Vendas
              </button>
              <button
                type="button"
                onClick={() => setTab("ops")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium transition-colors",
                  tab === "ops"
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                aria-label="Operações em Viagem"
                aria-pressed={tab === "ops"}
              >
                <Plane className="w-3.5 h-3.5" />
                Operações em Viagem
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar (gestão acima do Kanban) */}
      <section className="px-6 pt-2 pb-2 bg-background border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente, destino, tag..."
              className="pl-8 h-8 text-xs rounded-full"
            />
          </div>

          <FilterChip
            label="Responsável"
            value={
              filterAgent === "all"
                ? "Responsável"
                : filterAgent === "__none__"
                ? "Resp.: Sem responsável"
                : `Resp.: ${filterAgent}`
            }
            active={filterAgent !== "all"}
            onClear={() => setFilterAgent("all")}
            width={240}
          >
            <SearchableList
              items={[
                { id: "all", label: "Todos os responsáveis" },
                { id: "__none__", label: "Sem responsável" },
                ...agentOptions.map((n) => ({ id: n, label: n })),
              ]}
              selected={filterAgent}
              onSelect={setFilterAgent}
              placeholder="Buscar responsável..."
            />
          </FilterChip>

          {tab === "sales" ? (
            <>
              <FilterChip
                label="Temperatura"
                value={
                  filterTemp === "all"
                    ? "Temperatura"
                    : `Temp.: ${
                        { hot: "Quente", warm: "Morno", cold: "Frio", undefined: "Não definida" }[
                          filterTemp as "hot" | "warm" | "cold" | "undefined"
                        ] ?? filterTemp
                      }`
                }
                active={filterTemp !== "all"}
                onClear={() => setFilterTemp("all")}
                width={200}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todas temperaturas" },
                    { id: "hot", label: "Quente" },
                    { id: "warm", label: "Morno" },
                    { id: "cold", label: "Frio" },
                    { id: "undefined", label: "Não definida" },
                  ]}
                  selected={filterTemp}
                  onSelect={setFilterTemp}
                  placeholder="Buscar..."
                />
              </FilterChip>

              <FilterChip
                label="Nível"
                value={
                  filterLevel === "all"
                    ? "Nível"
                    : `Nível: ${
                        { prospect: "Prospect", lead: "Lead", cliente: "Cliente" }[
                          filterLevel as "prospect" | "lead" | "cliente"
                        ] ?? filterLevel
                      }`
                }
                active={filterLevel !== "all"}
                onClear={() => setFilterLevel("all")}
                width={200}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todos os níveis" },
                    { id: "prospect", label: "Prospect" },
                    { id: "lead", label: "Lead" },
                    { id: "cliente", label: "Cliente" },
                  ]}
                  selected={filterLevel}
                  onSelect={setFilterLevel}
                  placeholder="Buscar..."
                />
              </FilterChip>

              <FilterChip
                label="Origem"
                value={filterSource === "all" ? "Origem" : `Origem: ${filterSource}`}
                active={filterSource !== "all"}
                onClear={() => setFilterSource("all")}
                width={220}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todas as origens" },
                    { id: "WhatsApp", label: "WhatsApp" },
                    { id: "Manual", label: "Manual" },
                    { id: "Telefone", label: "Telefone" },
                    { id: "E-mail", label: "E-mail" },
                    { id: "Indicação", label: "Indicação" },
                  ]}
                  selected={filterSource}
                  onSelect={setFilterSource}
                  placeholder="Buscar origem..."
                />
              </FilterChip>

              <FilterChip
                label="Tags"
                value={filterTag === "all" ? "Tags" : `Tag: ${filterTag}`}
                active={filterTag !== "all"}
                onClear={() => setFilterTag("all")}
                width={240}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todas as tags" },
                    ...tagOptions.map((t) => ({ id: t, label: t })),
                  ]}
                  selected={filterTag}
                  onSelect={setFilterTag}
                  placeholder="Buscar tag..."
                />
              </FilterChip>
            </>
          ) : (
            <>
              <FilterChip
                label="Embarque"
                value={
                  filterBoarding === "all"
                    ? "Embarque"
                    : `Embarque: Próx. ${filterBoarding} dias`
                }
                active={filterBoarding !== "all"}
                onClear={() => setFilterBoarding("all")}
                width={220}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todos" },
                    { id: "7", label: "Próximos 7 dias" },
                    { id: "15", label: "Próximos 15 dias" },
                    { id: "30", label: "Próximos 30 dias" },
                  ]}
                  selected={filterBoarding}
                  onSelect={(v) => setFilterBoarding(v as "all" | "7" | "15" | "30")}
                  placeholder="Buscar..."
                />
              </FilterChip>

              <FilterChip
                label="Status"
                value={
                  filterOpsStatus === "all"
                    ? "Status"
                    : `Status: ${
                        { normal: "Normal", urgent: "Urgente", waiting: "Aguardando retorno" }[
                          filterOpsStatus
                        ]
                      }`
                }
                active={filterOpsStatus !== "all"}
                onClear={() => setFilterOpsStatus("all")}
                width={240}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todos os status" },
                    { id: "normal", label: "Normal" },
                    { id: "urgent", label: "Urgente" },
                    { id: "waiting", label: "Aguardando retorno" },
                  ]}
                  selected={filterOpsStatus}
                  onSelect={(v) => setFilterOpsStatus(v as "all" | "normal" | "urgent" | "waiting")}
                  placeholder="Buscar..."
                />
              </FilterChip>

              <FilterChip
                label="Destino"
                value={filterDestination === "all" ? "Destino" : `Destino: ${filterDestination}`}
                active={filterDestination !== "all"}
                onClear={() => setFilterDestination("all")}
                width={260}
              >
                <SearchableList
                  items={[
                    { id: "all", label: "Todos os destinos" },
                    ...destinationOptions.map((d) => ({ id: d, label: d })),
                  ]}
                  selected={filterDestination}
                  onSelect={setFilterDestination}
                  placeholder="Buscar destino..."
                />
              </FilterChip>
            </>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1 text-xs"
              onClick={() => {
                setSearchTerm("");
                setFilterAgent("all");
                setFilterTag("all");
                setFilterTemp("all");
                setFilterLevel("all");
                setFilterSource("all");
                setFilterBoarding("all");
                setFilterOpsStatus("all");
                setFilterDestination("all");
              }}
            >
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => handleViewModeChange("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors",
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              aria-label="Visualização em Kanban"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("table")}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              aria-label="Visualização em Tabela"
            >
              <Rows3 className="w-3.5 h-3.5" />
              Tabela
            </button>
          </div>

          {tab === "sales" && (
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => navigate("/crm/lead/new")}
            >
              <Plus className="w-3.5 h-3.5" /> Novo Lead
            </Button>
          )}
        </div>
      </section>

      {/* Board area */}
      <main className="flex-1 min-h-0 flex flex-col">
        {viewMode === "kanban" ? (
          <KanbanBoard
            columns={filteredColumns}
            onCardClick={handleCardClick}
            onDeleteColumn={tab === "sales" ? handleRequestDelete : undefined}
            onAddColumn={tab === "sales" ? () => openAddAt(null) : undefined}
            onRenameColumn={tab === "sales" ? handleRequestRename : undefined}
            onAddBefore={tab === "sales" ? handleAddBefore : undefined}
            onAddAfter={tab === "sales" ? handleAddAfter : undefined}
            draggedCardId={draggedCardId}
            draggedFromColumnId={draggedFromColumnId}
            validTargetColumnIds={validTargetColumnIds}
            onCardDragStart={handleCardDragStart}
            onCardDragEnd={handleCardDragEnd}
            onDropOnColumn={handleDropOnColumn}
            onTemperatureChange={handleTemperatureChange}
            onCardDelete={handleCardDelete}
            onCardAssignAgent={handleCardAssignAgent}
            onCardCreateQuote={handleCardCreateQuote}
            onCardViewConversation={handleCardViewConversation}
            onCardEdit={handleCardEdit}
            onCardArchive={handleCardArchive}
            onCardRenameClient={handleCardRenameClient}
            agentOptions={responsibleOptions}
            focusCardId={focusCardId}
            isLoading={tab === "sales" && isLoadingLeads}
            collapsibleColumnIds={tab === "sales" ? COLLAPSIBLE_COLUMN_IDS : undefined}
            collapsedColumnIds={collapsedCols}
            onToggleColumnCollapse={toggleColumnCollapse}
          />
        ) : (
          <CRMTableView
            columns={filteredColumns}
            onCardClick={handleCardClick}
            onCardAssignAgent={handleCardAssignAgent}
            onCardCreateQuote={handleCardCreateQuote}
            onCardViewConversation={handleCardViewConversation}
            onCardEdit={handleCardEdit}
            onCardArchive={handleCardArchive}
            onCardRenameClient={handleCardRenameClient}
            agentOptions={responsibleOptions}
          />
        )}
      </main>



      {/* Add column dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Adicionar nova etapa</DialogTitle>
            <DialogDescription>
              Defina o nome da etapa que será criada no funil atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-column-title">Nome da etapa</Label>
            <Input
              id="new-column-title"
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              placeholder="Ex: Negociação, Follow-up..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddColumn();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddColumn}>Criar etapa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename column dialog */}
      <Dialog
        open={!!columnToRename}
        onOpenChange={(open) => {
          if (!open) {
            setColumnToRename(null);
            setRenameTitle("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Renomear etapa</DialogTitle>
            <DialogDescription>
              Atualize o nome desta etapa do funil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rename-column-title">Nome da etapa</Label>
            <Input
              id="rename-column-title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setColumnToRename(null);
                setRenameTitle("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={confirmRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!columnToDelete}
        onOpenChange={(open) => !open && setColumnToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar esta etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa "{columnToDelete?.title}" e todos os {columnToDelete?.cards.length ?? 0} card(s) contidos nela serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de arquivamento */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar este card?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget
                ? `O card de "${archiveTarget.clientName}" será movido para a área de arquivados e deixará de aparecer no funil. Você poderá restaurá-lo depois.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Atribuir responsável (bloqueia entrada em "Em Qualificação") */}
      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignOpen(false);
            setAssignCardId(null);
            setAssignTargetColumn(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Atribuir consultor responsável</DialogTitle>
            <DialogDescription className="text-center">
              Para mover este lead para "Em Qualificação", selecione o consultor responsável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="assign-responsible">Responsável</Label>
            <UserPicker
              users={responsibleOptions.map((r) => {
                const count = activeLeadsByUser.get(r.user_id) ?? 0;
                return {
                  id: r.user_id,
                  name: r.full_name,
                  avatarUrl: r.avatar_url ?? null,
                  meta: `${count} ${count === 1 ? "lead" : "leads"}`,
                };
              })}
              value={selectedResponsibleId || null}
              onChange={(v) => setSelectedResponsibleId(v ?? "")}
              placeholder="Selecione um consultor"
              allowClear={false}
            />
            <p className="text-xs text-muted-foreground">
              O número entre parênteses indica leads ativos atualmente sob responsabilidade do consultor.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setAssignOpen(false);
                setAssignCardId(null);
                setAssignTargetColumn(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleConfirmAssign}
              disabled={!selectedResponsibleId}
            >
              Atribuir e mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validações: avisa o que falta e oferece "Mover mesmo assim" */}
      <Dialog
        open={!!pendingMove && pendingIssues.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null);
            setPendingIssues([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
              <Info className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-center">
              Mover para "{pendingMove?.toTitle}"?
            </DialogTitle>
            <DialogDescription className="text-center">
              Identificamos pendências para esta etapa. Resolva as pendências ou avance manualmente em situações excepcionais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingIssues.map((iss, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-4 flex gap-3"
              >
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{iss.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{iss.detail}</p>
                  {iss.cta && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-9 rounded-lg border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() => {
                        iss.cta!.onClick();
                        setPendingMove(null);
                        setPendingIssues([]);
                      }}
                    >
                      <FilePlus className="h-4 w-4" />
                      {iss.cta.label}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setPendingMove(null);
                setPendingIssues([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              className="rounded-lg bg-muted text-muted-foreground hover:bg-muted/80"
              onClick={() => {
                if (pendingMove) {
                  if (pendingMove.toColumnId === "closed" && pendingMove.leadId) {
                    setPromotionLeadId(pendingMove.leadId);
                    setPromotionPendingMove(pendingMove);
                    setPromotionOpen(true);
                  } else {
                    performMove(pendingMove, true);
                  }
                }
                setPendingMove(null);
                setPendingIssues([]);
              }}
            >
              Mover mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientPromotionDialog
        open={promotionOpen}
        onOpenChange={(v) => {
          setPromotionOpen(v);
          if (!v) {
            setPromotionPendingMove(null);
            setPromotionLeadId(null);
          }
        }}
        leadId={promotionLeadId}
        onPromoted={handlePromotionDone}
      />

      {/* Motivo da perda — ao mover para "Perdidos" */}
      <Dialog
        open={lostOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLostOpen(false);
            setLostMove(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Marcar lead como perdido</DialogTitle>
            <DialogDescription className="text-center">
              Selecione o motivo da perda. Esta informação ficará registrada para análise futura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <RadioGroup value={lostReason} onValueChange={setLostReason} className="grid gap-2">
              {[
                "Sem resposta",
                "Escolheu concorrente",
                "Preço acima do orçamento",
                "Desistiu da viagem",
                "Outro",
              ].map((r) => {
                const selected = lostReason === r;
                return (
                  <label
                    key={r}
                    htmlFor={`lost-${r}`}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all",
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value={r} id={`lost-${r}`} className="shrink-0" />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selected ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {r}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
            <div className="space-y-1.5">
              <Label htmlFor="lost-details" className="text-xs">
                {lostReason === "Outro" ? "Descreva o motivo" : "Observações (opcional)"}
              </Label>
              <Textarea
                id="lost-details"
                value={lostDetails}
                onChange={(e) => setLostDetails(e.target.value)}
                placeholder={lostReason === "Outro" ? "Explique o motivo da perda..." : "Detalhes adicionais..."}
                rows={3}
                className="text-sm rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => { setLostOpen(false); setLostMove(null); }}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={confirmLost}
            >
              Marcar como perdido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteContactDialog
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setDeleteTarget(null);
        }}
        target={deleteTarget}
        onDeleted={handleAfterDelete}
      />

    </div>
  );
}
