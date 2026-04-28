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
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { KanbanCard, type KanbanCardData } from "@/components/crm/KanbanCard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type KanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCardData[];
};

const INITIAL_SALES_COLUMNS: KanbanColumn[] = [
  { id: "new-leads", title: "Novos Leads (IA)", cards: [] },
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
            column.cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onClick={onCardClick}
                stageBorderClass={dotColor.replace("bg-", "border-l-")}
                draggable
                isDragging={draggedCardId === card.id}
                onDragStart={(c) => onCardDragStart(c)}
                onDragEnd={() => onCardDragEnd()}
              />
            ))
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
        .select("id, full_name, phone, source, destination, travel_date_start, travel_date_end, flexible_dates_description, travelers_count, budget_estimate, ai_summary, created_at")
        .is("converted_client_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error || cancelled || !data) return;

      const leadCards: KanbanCardData[] = data.map((l: any) => {
        const hasTravelData =
          !!l.destination &&
          (!!l.travel_date_start || !!l.travel_date_end || !!l.flexible_dates_description) &&
          !!l.travelers_count;
        const isAI = l.source === "whatsapp_ai";
        return {
          id: `lead-${l.id}`,
          clientName: l.full_name,
          destination: l.destination ?? undefined,
          travelDate: l.travel_date_start
            ? new Date(l.travel_date_start).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
            : (l.flexible_dates_description ?? undefined),
          estimatedValue: l.budget_estimate ? Number(l.budget_estimate) : undefined,
          isAILead: isAI,
          isManualLead: !isAI,
          aiSummary: l.ai_summary ?? undefined,
          contactLevel: hasTravelData ? "lead" : "prospect",
          tags: [
            l.travelers_count ? { label: `${l.travelers_count} viajante(s)`, tone: "blue" as const } : null,
            isAI ? { label: "WhatsApp", tone: "green" as const } : null,
          ].filter(Boolean) as KanbanCardData["tags"],
        };
      });

      setSalesColumns((prev) => {
        const newLeadsCol = prev.find((c) => c.id === "new-leads");
        if (!newLeadsCol) return prev;
        return prev.map((col) =>
          col.id === "new-leads" ? { ...col, cards: leadCards } : col,
        );
      });
    };
    fetchLeads();
    const interval = setInterval(fetchLeads, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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

  const setColumns = tab === "sales" ? setSalesColumns : setOpsColumns;
  const columns = tab === "sales" ? salesColumns : opsColumns;

  // ─── Drag & Drop ─────────────────────────────────────────
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  const handleCardDragStart = (card: KanbanCardData) => setDraggedCardId(card.id);
  const handleCardDragEnd = () => setDraggedCardId(null);

  const handleDropOnColumn = (targetColumnId: string) => {
    if (!draggedCardId) return;
    setColumns((prev) => {
      let moving: KanbanCardData | null = null;
      const stripped = prev.map((col) => {
        const idx = col.cards.findIndex((c) => c.id === draggedCardId);
        if (idx === -1) return col;
        moving = col.cards[idx];
        if (col.id === targetColumnId) return col; // mesmo destino, não mexe
        return { ...col, cards: col.cards.filter((c) => c.id !== draggedCardId) };
      });
      if (!moving) return prev;
      const sourceColumn = prev.find((c) => c.cards.some((k) => k.id === draggedCardId));
      if (sourceColumn?.id === targetColumnId) return prev;
      const next = stripped.map((col) =>
        col.id === targetColumnId ? { ...col, cards: [moving as KanbanCardData, ...col.cards] } : col,
      );
      const target = next.find((c) => c.id === targetColumnId);
      if (target) toast.success(`Lead movido para "${target.title}".`);
      return next;
    });
    setDraggedCardId(null);
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

      {/* New Lead dialog (manual) */}
      <Dialog
        open={newLeadOpen}
        onOpenChange={(open) => {
          setNewLeadOpen(open);
          if (!open) resetLeadForm();
        }}
      >
        <DialogContent className="md:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Novo lead</DialogTitle>
            <DialogDescription>
              Preencha os dados básicos. Se incluir destino, período e número de viajantes, o contato é criado já como Lead. Caso contrário, fica como Prospect em "Novos Leads".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lead-name">Nome completo *</Label>
                <Input
                  id="lead-name"
                  value={leadForm.full_name}
                  onChange={(e) => setLeadForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Ex: Ana Souza"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-phone">Telefone *</Label>
                  <Input
                    id="lead-phone"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="(11) 99999-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email">E-mail</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="opcional"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-source">Origem do lead</Label>
                <Select
                  value={leadForm.source}
                  onValueChange={(v) => setLeadForm((f) => ({ ...f, source: v }))}
                >
                  <SelectTrigger id="lead-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="referral">Indicação</SelectItem>
                    <SelectItem value="event">Evento</SelectItem>
                    <SelectItem value="social">Redes Sociais</SelectItem>
                    <SelectItem value="in_person">Presencial</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                Interesse (opcional) — preencha para promover automaticamente a Lead
              </p>
              <div className="grid gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-destination">Destino</Label>
                    <Input
                      id="lead-destination"
                      value={leadForm.destination}
                      onChange={(e) => setLeadForm((f) => ({ ...f, destination: e.target.value }))}
                      placeholder="Ex: Paris"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-period">Período pretendido</Label>
                    <Input
                      id="lead-period"
                      value={leadForm.travel_period}
                      onChange={(e) => setLeadForm((f) => ({ ...f, travel_period: e.target.value }))}
                      placeholder="Ex: 2025-07 ou Jul/2025 (flexível)"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-travelers">Número de viajantes</Label>
                  <Input
                    id="lead-travelers"
                    type="number"
                    min={1}
                    value={leadForm.travelers_count}
                    onChange={(e) => setLeadForm((f) => ({ ...f, travelers_count: e.target.value }))}
                    placeholder="Ex: 2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-notes">Observações</Label>
                  <Textarea
                    id="lead-notes"
                    rows={3}
                    value={leadForm.notes}
                    onChange={(e) => setLeadForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Preferências, restrições, contexto..."
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLeadOpen(false)} disabled={savingLead}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLead} disabled={savingLead}>
              {savingLead ? "Criando..." : "Criar lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
