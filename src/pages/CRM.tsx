import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { KanbanCard, type KanbanCardData } from "@/components/crm/KanbanCard";

type KanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCardData[];
};

const SALES_COLUMNS: KanbanColumn[] = [
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

const OPS_COLUMNS: KanbanColumn[] = [
  { id: "pre-trip", title: "Pré-Viagem", cards: [] },
  { id: "in-trip", title: "Em Viagem", cards: [] },
  { id: "support", title: "Suporte Ativo", cards: [] },
  { id: "post-trip", title: "Pós-Viagem", cards: [] },
];

function KanbanBoard({ columns }: { columns: KanbanColumn[] }) {
  return (
    <ScrollArea className="flex-1">
      <div className="flex gap-4 p-6 h-full min-h-0">
        {columns.map((col) => (
          <KanbanColumnCard key={col.id} column={col} />
        ))}
      </div>
    </ScrollArea>
  );
}

function KanbanColumnCard({ column }: { column: KanbanColumn }) {
  return (
    <div
      className={cn(
        "flex flex-col w-[300px] shrink-0 rounded-xl border border-border/60",
        "bg-[#F9FAFB] dark:bg-muted/30",
        "max-h-full"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          {column.title}
        </h3>
        <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full border border-border/50">
          {column.cards.length}
        </span>
      </div>

      {/* Column body — scrollable when long */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2 min-h-[200px]">
          {column.cards.length === 0 ? (
            <EmptyColumnHint />
          ) : (
            column.cards.map((card) => <KanbanCard key={card.id} card={card} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyColumnHint() {
  return (
    <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
      Nenhum item
    </div>
  );
}

export default function CRM() {
  const [tab, setTab] = useState<"sales" | "ops">("sales");

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] min-h-0 bg-background">
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

          {/* Hidden TabsContent placeholders — board rendered below for full-height layout */}
          <TabsContent value="sales" className="hidden" />
          <TabsContent value="ops" className="hidden" />
        </Tabs>
      </header>

      {/* Board area — fills remaining height */}
      <main className="flex-1 min-h-0 flex flex-col">
        {tab === "sales" ? (
          <KanbanBoard columns={SALES_COLUMNS} />
        ) : (
          <KanbanBoard columns={OPS_COLUMNS} />
        )}
      </main>
    </div>
  );
}
