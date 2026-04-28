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
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPicker } from "@/components/ui/user-picker";
import { MetricCard } from "@/components/MetricCard";
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
  onCardDragStart,
  onCardDragEnd,
  onDropOnColumn,
  onTemperatureChange,
  onCardDelete,
  focusCardId,
}: {
  columns: KanbanColumn[];
  onCardClick: (card: KanbanCardData) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: () => void;
  onRenameColumn: (columnId: string) => void;
  onAddBefore: (columnId: string) => void;
  onAddAfter: (columnId: string) => void;
  draggedCardId: string | null;
  onCardDragStart: (card: KanbanCardData) => void;
  onCardDragEnd: () => void;
  onDropOnColumn: (columnId: string) => void;
  onTemperatureChange: (card: KanbanCardData, next: LeadTemperature) => void;
  onCardDelete?: (card: KanbanCardData) => void;
  focusCardId?: string | null;
}) {
  return (
    <div className="flex-1 min-h-0 mt-4 pb-5 overflow-x-auto overflow-y-hidden scrollbar-elegant [transform:scaleY(-1)]">
      <div className="flex gap-2 px-6 py-2 min-w-max h-full items-stretch [transform:scaleY(-1)]">
        {columns.map((col, idx) => (
          <KanbanColumnCard
            key={col.id}
            column={col}
            dotColor={STAGE_DOT_COLORS[idx % STAGE_DOT_COLORS.length]}
            onCardClick={onCardClick}
            onDelete={() => onDeleteColumn(col.id)}
            onRename={() => onRenameColumn(col.id)}
            onAddBefore={() => onAddBefore(col.id)}
            onAddAfter={() => onAddAfter(col.id)}
            draggedCardId={draggedCardId}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            onDropOnColumn={onDropOnColumn}
            onTemperatureChange={onTemperatureChange}
            onCardDelete={onCardDelete}
            focusCardId={focusCardId}
          />
        ))}
        <AddColumnButton onClick={onAddColumn} />
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
  onCardDragStart,
  onCardDragEnd,
  onDropOnColumn,
  onTemperatureChange,
  onCardDelete,
  focusCardId,
}: {
  column: KanbanColumn;
  dotColor: string;
  onCardClick: (card: KanbanCardData) => void;
  onDelete: () => void;
  onRename: () => void;
  onAddBefore: () => void;
  onAddAfter: () => void;
  draggedCardId: string | null;
  onCardDragStart: (card: KanbanCardData) => void;
  onCardDragEnd: () => void;
  onDropOnColumn: (columnId: string) => void;
  onTemperatureChange: (card: KanbanCardData, next: LeadTemperature) => void;
  onCardDelete?: (card: KanbanCardData) => void;
  focusCardId?: string | null;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div className="flex flex-col w-[320px] shrink-0 max-h-full">
      {/* Column header (fixed) — flat, dot + title + count */}
      <div className="flex items-center gap-2 px-1 py-2 mb-1 shrink-0">
        <div className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <span className="text-xs font-medium text-foreground font-body truncate">
          {column.title}
        </span>
        <span className="text-xs text-muted-foreground font-body ml-auto">
          {column.cards.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/60 hover:text-foreground opacity-60 hover:opacity-100"
              aria-label="Opções da etapa"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onAddBefore}>
              <ArrowLeftToLine className="h-4 w-4 mr-2" />
              Adicionar etapa à esquerda
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddAfter}>
              <ArrowRightToLine className="h-4 w-4 mr-2" />
              Adicionar etapa à direita
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4 mr-2" />
              Renomear etapa
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir etapa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Column body — scrolls vertically and acts as the drop zone */}
      <div
        onDragOver={(e) => {
          if (!draggedCardId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!isOver) setIsOver(true);
        }}
        onDragLeave={(e) => {
          // só limpa quando o cursor sai realmente do contêiner
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          onDropOnColumn(column.id);
        }}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin pr-1 rounded-lg transition-colors",
          isOver && "bg-primary/10 ring-2 ring-primary/40 ring-inset",
        )}
      >
        <div className="space-y-3 min-h-[120px] p-1">
          {column.cards.length === 0 ? (
            <EmptyColumnHint />
          ) : (
            column.cards.map((card) => {
              const isFocused = focusCardId && focusCardId === card.id;
              return (
                <div
                  key={card.id}
                  data-card-id={card.id}
                  ref={(el) => {
                    if (el && isFocused) {
                      try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch { /* noop */ }
                    }
                  }}
                  className={cn(
                    "transition-all rounded-lg",
                    isFocused && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background animate-pulse",
                  )}
                >
                  <KanbanCard
                    card={card}
                    onClick={onCardClick}
                    stageBorderClass={dotColor.replace("bg-", "border-l-")}
                    draggable
                    isDragging={draggedCardId === card.id}
                    onDragStart={(c) => onCardDragStart(c)}
                    onDragEnd={() => onCardDragEnd()}
                    onTemperatureChange={onTemperatureChange}
                    onDelete={onCardDelete}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


function AddColumnButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center w-[320px] shrink-0 rounded-xl",
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
      return parsed.map((col) => ({
        ...col,
        cards: col.cards.filter(
          (c) => c.id.startsWith("lead-") || c.id.startsWith("quote-") || c.id.startsWith("manual-"),
        ),
      }));
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
  useEffect(() => {
    let cancelled = false;
    const fetchLeads = async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone, source, destination, travel_date_start, travel_date_end, flexible_dates_description, travelers_count, budget_estimate, ai_summary, created_at, is_returning, returned_at, assigned_user_id")
        .is("converted_client_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error || cancelled || !data) return;

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
          .from("profiles")
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
          estimatedValue: l.budget_estimate ? Number(l.budget_estimate) : undefined,
          isAILead: isAI,
          isManualLead: !isAI,
          aiSummary: l.ai_summary ?? undefined,
          contactLevel: hasTravelData ? "lead" : "prospect",
          isReturning: !!l.is_returning,
          stageEnteredAt: existing?.stageEnteredAt ?? l.created_at ?? new Date().toISOString(),
          temperature: existing?.temperature ?? "cold",
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

  const handleCardDragStart = (card: KanbanCardData) => setDraggedCardId(card.id);
  const handleCardDragEnd = () => setDraggedCardId(null);

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

  useEffect(() => {
    // carrega lista de responsáveis (usuários) do sistema
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
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

  const handleDropOnColumn = async (targetColumnId: string) => {
    if (!draggedCardId) return;
    const draggedId = draggedCardId;
    setDraggedCardId(null);

    const sourceColumn = columns.find((c) => c.cards.some((k) => k.id === draggedId));
    if (!sourceColumn || sourceColumn.id === targetColumnId) return;
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

  const handleTemperatureChange = (card: KanbanCardData, next: LeadTemperature) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === card.id ? { ...c, temperature: next } : c)),
      })),
    );
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

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    columns.forEach((c) => c.cards.forEach((k) => k.agent?.name && set.add(k.agent.name)));
    return Array.from(set).sort();
  }, [columns]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    columns.forEach((c) => c.cards.forEach((k) => k.tags?.forEach((t) => set.add(t.label))));
    return Array.from(set).sort();
  }, [columns]);

  const filteredColumns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        if (filterAgent !== "all" && card.agent?.name !== filterAgent) return false;
        if (filterTag !== "all" && !card.tags?.some((t) => t.label === filterTag)) return false;
        if (!q) return true;
        return (
          card.clientName.toLowerCase().includes(q) ||
          card.destination?.toLowerCase().includes(q) ||
          card.tags?.some((t) => t.label.toLowerCase().includes(q))
        );
      }),
    }));
  }, [columns, searchTerm, filterAgent, filterTag]);

  // ─── KPIs ────────────────────────────────────────────────
  const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns]);
  const totalLeads = allCards.length;
  const aiLeads = allCards.filter((c) => c.isAILead).length;
  const pipelineValue = allCards.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const hasActiveFilters = searchTerm !== "" || filterAgent !== "all" || filterTag !== "all";

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
        <div className="px-6 pt-6 pb-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            CRM
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe leads, qualificações e operações em viagem em um só lugar.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "sales" | "ops")}
          className="px-6"
        >
          <TabsList className="h-10 bg-transparent p-0 gap-2 border-b-0 rounded-none justify-start">
            <TabsTrigger
              value="sales"
              className={cn(
                "relative h-10 px-4 rounded-none bg-transparent",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=active]:text-primary",
                "data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              Funil de Vendas
            </TabsTrigger>
            <TabsTrigger
              value="ops"
              className={cn(
                "relative h-10 px-4 rounded-none bg-transparent",
                "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                "data-[state=active]:text-primary",
                "data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              Operações em Viagem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="hidden" />
          <TabsContent value="ops" className="hidden" />
        </Tabs>
      </header>

      {/* KPIs + Toolbar (gestão acima do Kanban) */}
      <section className="px-6 pt-5 pb-2 bg-background border-b border-border space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, destino ou tag..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="h-9 w-full sm:w-[180px] text-sm">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os responsáveis</SelectItem>
              {agentOptions.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="h-9 w-full sm:w-[170px] text-sm">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {tagOptions.map((label) => (
                <SelectItem key={label} value={label}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => { setSearchTerm(""); setFilterAgent("all"); setFilterTag("all"); }}
            >
              <X className="w-3.5 h-3.5" /> Limpar
            </Button>
          )}
          {tab === "sales" && (
            <Button
              size="sm"
              className="h-9 gap-1.5 sm:ml-auto"
              onClick={() => navigate("/crm/lead/new")}
            >
              <Plus className="w-4 h-4" /> Novo Lead
            </Button>
          )}
        </div>
      </section>

      {/* Board area */}
      <main className="flex-1 min-h-0 flex flex-col">
        <KanbanBoard
          columns={filteredColumns}
          onCardClick={handleCardClick}
          onDeleteColumn={handleRequestDelete}
          onAddColumn={() => openAddAt(null)}
          onRenameColumn={handleRequestRename}
          onAddBefore={handleAddBefore}
          onAddAfter={handleAddAfter}
          draggedCardId={draggedCardId}
          onCardDragStart={handleCardDragStart}
          onCardDragEnd={handleCardDragEnd}
          onDropOnColumn={handleDropOnColumn}
          onTemperatureChange={handleTemperatureChange}
          onCardDelete={handleCardDelete}
          focusCardId={focusCardId}
        />
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
            <DialogTitle>Atribuir consultor responsável</DialogTitle>
            <DialogDescription>
              Para mover este lead para "Em Qualificação", selecione o consultor responsável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="assign-responsible">Responsável</Label>
            <Select value={selectedResponsibleId} onValueChange={setSelectedResponsibleId}>
              <SelectTrigger id="assign-responsible" className="h-10">
                <SelectValue placeholder="Selecione um consultor" />
              </SelectTrigger>
              <SelectContent>
                {responsibleOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>Nenhum usuário disponível</SelectItem>
                ) : (
                  responsibleOptions.map((r) => (
                    <SelectItem key={r.user_id} value={r.user_id}>
                      {r.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignOpen(false);
                setAssignCardId(null);
                setAssignTargetColumn(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmAssign} disabled={!selectedResponsibleId}>
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
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Mover para "{pendingMove?.toTitle}"?
            </DialogTitle>
            <DialogDescription>
              Identificamos pendências para esta etapa. Resolva as pendências ou avance manualmente em situações excepcionais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingIssues.map((iss, i) => (
              <div
                key={i}
                className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1.5"
              >
                <p className="text-sm font-medium text-foreground">{iss.title}</p>
                <p className="text-xs text-muted-foreground">{iss.detail}</p>
                {iss.cta && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 mt-1"
                    onClick={() => {
                      iss.cta!.onClick();
                      setPendingMove(null);
                      setPendingIssues([]);
                    }}
                  >
                    {iss.cta.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPendingMove(null);
                setPendingIssues([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
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
