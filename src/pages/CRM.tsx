import { useState } from "react";
import {
  Plus,
  MoreVertical,
  Trash2,
  ArrowLeftToLine,
  ArrowRightToLine,
  Pencil,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { LeadDetailPanel } from "@/components/crm/LeadDetailPanel";
import { toast } from "sonner";

type KanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCardData[];
};

const INITIAL_SALES_COLUMNS: KanbanColumn[] = [
  {
    id: "new-leads",
    title: "Novos Leads (IA)",
    cards: [
      {
        id: "1",
        clientName: "Marina e Rafael Costa",
        destination: "Paris, França",
        travelDate: "Set/2026",
        tags: [
          { label: "Casal", tone: "purple" },
          { label: "Lua de Mel", tone: "rose" },
          { label: "Europa", tone: "blue" },
        ],
        estimatedValue: 28000,
        agent: { name: "Ana Paula" },
        isAILead: true,
        aiSummary:
          "Casal planejando lua de mel de 10 dias em Paris em setembro, busca hotel boutique no centro e jantares românticos.",
      },
      {
        id: "2",
        clientName: "Família Mendonça",
        destination: "Orlando, EUA",
        travelDate: "Jul/2026",
        tags: [
          { label: "Família", tone: "amber" },
          { label: "Disney", tone: "blue" },
        ],
        estimatedValue: 45000,
        agent: { name: "Daniel Souza" },
        isAILead: true,
        aiSummary:
          "Família com 2 crianças (6 e 9 anos) quer pacote de 12 dias incluindo Disney e Universal, com transfer e ingressos.",
      },
    ],
  },
  {
    id: "qualifying",
    title: "Em Qualificação",
    cards: [
      {
        id: "3",
        clientName: "Carlos Eduardo Lima",
        destination: "Tóquio, Japão",
        travelDate: "Mar/2026",
        tags: [
          { label: "Solo", tone: "slate" },
          { label: "Ásia", tone: "rose" },
        ],
        estimatedValue: 22000,
        agent: { name: "Beatriz Rocha" },
      },
    ],
  },
  {
    id: "quote",
    title: "Cotação",
    cards: [
      {
        id: "4",
        clientName: "Juliana Pereira",
        destination: "Maldivas",
        travelDate: "Dez/2025",
        tags: [
          { label: "Luxo", tone: "amber" },
          { label: "Praia", tone: "blue" },
        ],
        estimatedValue: 62000,
        agent: { name: "Ana Paula" },
      },
      {
        id: "5",
        clientName: "Roberto e Silvia Andrade",
        destination: "Patagônia, Argentina",
        travelDate: "Fev/2026",
        tags: [
          { label: "Casal", tone: "purple" },
          { label: "Aventura", tone: "green" },
        ],
        estimatedValue: 18500,
        agent: { name: "Marcos Lima" },
      },
    ],
  },
  {
    id: "proposal-sent",
    title: "Proposta Enviada",
    cards: [
      {
        id: "6",
        clientName: "Família Tavares",
        destination: "Roma, Itália",
        travelDate: "Jun/2026",
        tags: [
          { label: "Família", tone: "amber" },
          { label: "Europa", tone: "blue" },
          { label: "Cultural", tone: "purple" },
        ],
        estimatedValue: 38000,
        agent: { name: "Daniel Souza" },
      },
    ],
  },
  {
    id: "closed",
    title: "Fechado",
    cards: [
      {
        id: "7",
        clientName: "Patrícia Nogueira",
        destination: "Cancún, México",
        travelDate: "Nov/2025",
        tags: [
          { label: "Resort", tone: "green" },
          { label: "All-Inclusive", tone: "blue" },
        ],
        estimatedValue: 15000,
        agent: { name: "Beatriz Rocha" },
      },
    ],
  },
];

const INITIAL_OPS_COLUMNS: KanbanColumn[] = [
  { id: "pre-trip", title: "Pré-Viagem", cards: [] },
  { id: "in-trip", title: "Em Viagem", cards: [] },
  { id: "support", title: "Suporte Ativo", cards: [] },
  { id: "post-trip", title: "Pós-Viagem", cards: [] },
];

function KanbanBoard({
  columns,
  onCardClick,
  onDeleteColumn,
  onAddColumn,
}: {
  columns: KanbanColumn[];
  onCardClick: (card: KanbanCardData) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: () => void;
}) {
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Convert vertical wheel scroll to horizontal scroll when there's no
    // horizontal intent (typical mouse wheel). Trackpads already provide
    // deltaX, so we leave those alone.
    if (e.deltaY !== 0 && e.deltaX === 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
      onWheel={handleWheel}
    >
      <div className="flex gap-4 px-6 py-6 min-w-max">
        {columns.map((col) => (
          <KanbanColumnCard
            key={col.id}
            column={col}
            onCardClick={onCardClick}
            onDelete={() => onDeleteColumn(col.id)}
          />
        ))}
        <AddColumnButton onClick={onAddColumn} />
      </div>
    </div>
  );
}

function KanbanColumnCard({
  column,
  onCardClick,
  onDelete,
}: {
  column: KanbanColumn;
  onCardClick: (card: KanbanCardData) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col w-[320px] shrink-0 rounded-xl",
        "bg-slate-100/50 dark:bg-slate-900/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground/80 tracking-tight truncate">
            {column.title}
          </h3>
          <span className="text-xs font-medium text-muted-foreground/70 bg-slate-200/60 dark:bg-slate-800/60 px-2.5 py-0.5 rounded-full shrink-0">
            {column.cards.length}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:text-foreground opacity-60 hover:opacity-100"
              aria-label="Opções da etapa"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Deletar etapa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Column body */}
      <div className="flex-1 px-3 pb-3">
        <div className="space-y-3 min-h-[200px]">
          {column.cards.length === 0 ? (
            <EmptyColumnHint />
          ) : (
            column.cards.map((card) => (
              <KanbanCard key={card.id} card={card} onClick={onCardClick} />
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
  const [tab, setTab] = useState<"sales" | "ops">("sales");
  const [salesColumns, setSalesColumns] = useState<KanbanColumn[]>(INITIAL_SALES_COLUMNS);
  const [opsColumns, setOpsColumns] = useState<KanbanColumn[]>(INITIAL_OPS_COLUMNS);
  const [selectedCard, setSelectedCard] = useState<KanbanCardData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Add column dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  // Delete confirmation
  const [columnToDelete, setColumnToDelete] = useState<KanbanColumn | null>(null);

  const handleCardClick = (card: KanbanCardData) => {
    setSelectedCard(card);
    setPanelOpen(true);
  };

  const setColumns = tab === "sales" ? setSalesColumns : setOpsColumns;
  const columns = tab === "sales" ? salesColumns : opsColumns;

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
    setColumns((prev) => [...prev, newColumn]);
    setNewColumnTitle("");
    setAddOpen(false);
    toast.success(`Etapa "${title}" adicionada.`);
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

      {/* Board area */}
      <main className="flex-1 min-h-0 flex flex-col">
        <KanbanBoard
          columns={columns}
          onCardClick={handleCardClick}
          onDeleteColumn={handleRequestDelete}
          onAddColumn={() => setAddOpen(true)}
        />
      </main>

      {/* Lead detail slide-over */}
      <LeadDetailPanel
        card={selectedCard}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />

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
    </div>
  );
}
