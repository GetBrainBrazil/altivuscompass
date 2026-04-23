import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type KanbanColumn = {
  id: string;
  title: string;
  count?: number;
};

const SALES_COLUMNS: KanbanColumn[] = [
  { id: "new-leads", title: "Novos Leads (IA)", count: 0 },
  { id: "qualifying", title: "Em Qualificação", count: 0 },
  { id: "quote", title: "Cotação", count: 0 },
  { id: "proposal-sent", title: "Proposta Enviada", count: 0 },
  { id: "closed", title: "Fechado", count: 0 },
];

const OPS_COLUMNS: KanbanColumn[] = [
  { id: "pre-trip", title: "Pré-Viagem", count: 0 },
  { id: "in-trip", title: "Em Viagem", count: 0 },
  { id: "support", title: "Suporte Ativo", count: 0 },
  { id: "post-trip", title: "Pós-Viagem", count: 0 },
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
          {column.count ?? 0}
        </span>
      </div>

      {/* Column body — scrollable when long */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2 min-h-[200px]">
          <EmptyColumnHint />
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
