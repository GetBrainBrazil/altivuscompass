import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  MoreVertical,
  UserPlus,
  FileText,
  MessageCircle,
  Pencil,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KanbanCardData, LeadTemperature } from "@/components/crm/KanbanCard";
import { ContactLevelBadge } from "@/components/contacts/ContactLevelBadge";
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

type ColumnMeta = { id: string; title: string };

export type CRMTableRow = KanbanCardData & {
  columnId: string;
  columnTitle: string;
  lastContactAt?: string;
};

interface CRMTableViewProps {
  columns: { id: string; title: string; cards: KanbanCardData[] }[];
  onCardClick: (card: KanbanCardData) => void;
  onCardAssignAgent?: (card: KanbanCardData, userId: string) => void;
  onCardCreateQuote?: (card: KanbanCardData) => void;
  onCardViewConversation?: (card: KanbanCardData) => void;
  onCardEdit?: (card: KanbanCardData) => void;
  onCardArchive?: (card: KanbanCardData) => void;
  agentOptions: { user_id: string; full_name: string; avatar_url?: string | null }[];
}

type SortKey =
  | "name"
  | "phone"
  | "destination"
  | "travelDate"
  | "travelers"
  | "value"
  | "stage"
  | "agent"
  | "temperature"
  | "source"
  | "lastContact"
  | "daysInStage";

type SortDir = "asc" | "desc" | null;

const STAGE_TONE: Record<string, string> = {
  "new-leads": "bg-blue-100 text-blue-700 border-blue-200",
  qualification: "bg-violet-100 text-violet-700 border-violet-200",
  quote: "bg-amber-100 text-amber-700 border-amber-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-rose-100 text-rose-700 border-rose-200",
};

const TEMP_COLOR: Record<LeadTemperature, string> = {
  hot: "text-rose-500",
  warm: "text-amber-500",
  cold: "text-sky-500",
};

const TEMP_LABEL: Record<LeadTemperature, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) {
    const hours = Math.floor(diffMs / 3600000);
    if (hours <= 0) return "agora";
    return `há ${hours}h`;
  }
  if (days === 1) return "há 1 dia";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months === 1) return "há 1 mês";
  return `há ${months} meses`;
}

function formatCurrency(v?: number): string {
  if (typeof v !== "number") return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function daysInStage(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function HeaderCell({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey && currentDir;
  return (
    <th
      className={cn(
        "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground select-none",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {active === "asc" ? (
          <ArrowUp className="w-3 h-3" />
        ) : active === "desc" ? (
          <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

export function CRMTableView({
  columns,
  onCardClick,
  onCardAssignAgent,
  onCardCreateQuote,
  onCardViewConversation,
  onCardEdit,
  onCardArchive,
  agentOptions,
}: CRMTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const rows: CRMTableRow[] = useMemo(() => {
    const all: CRMTableRow[] = [];
    for (const col of columns) {
      for (const card of col.cards) {
        all.push({ ...card, columnId: col.id, columnTitle: col.title });
      }
    }
    return all;
  }, [columns]);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: CRMTableRow): string | number => {
      switch (sortKey) {
        case "name":
          return (r.clientName || "").toLowerCase();
        case "phone":
          return r.phone || "";
        case "destination":
          return (r.destination || "").toLowerCase();
        case "travelDate":
          return r.travelDateISO || r.travelDate || "";
        case "travelers":
          return r.travelersCount ?? -1;
        case "value":
          return r.estimatedValue ?? -1;
        case "stage":
          return r.columnTitle.toLowerCase();
        case "agent":
          return (r.agent?.name || "").toLowerCase();
        case "temperature": {
          const order: Record<LeadTemperature, number> = { hot: 3, warm: 2, cold: 1 };
          return r.temperature ? order[r.temperature] : 0;
        }
        case "source":
          return (r.source || "").toLowerCase();
        case "lastContact":
          return r.lastContactAt ? new Date(r.lastContactAt).getTime() : 0;
        case "daysInStage":
          return daysInStage(r.stageEnteredAt);
      }
    };
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir("asc");
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-background">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur border-b border-border">
          <tr>
            <HeaderCell label="Contato" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Telefone" sortKey="phone" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Destino" sortKey="destination" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Data" sortKey="travelDate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Pax" sortKey="travelers" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right" />
            <HeaderCell label="Orçamento" sortKey="value" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right" />
            <HeaderCell label="Etapa" sortKey="stage" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Responsável" sortKey="agent" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Temp." sortKey="temperature" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Origem" sortKey="source" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Último contato" sortKey="lastContact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
            <HeaderCell label="Dias na etapa" sortKey="daysInStage" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right" />
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-3 py-12 text-center text-sm text-muted-foreground">
                Nenhum contato encontrado com os filtros atuais.
              </td>
            </tr>
          ) : (
            sortedRows.map((r) => {
              const stageClass =
                STAGE_TONE[r.columnId] ?? "bg-slate-100 text-slate-700 border-slate-200";
              return (
                <tr
                  key={r.id}
                  className="border-b border-border/60 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => onCardClick(r)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {r.clientName || "—"}
                      </span>
                      {r.contactLevel && <ContactLevelBadge level={r.contactLevel} />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                    {r.phone || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-foreground/90 truncate max-w-[180px]">
                    {r.destination || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {r.travelDate || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.travelersCount ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground/90 whitespace-nowrap">
                    {formatCurrency(r.estimatedValue)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap",
                        stageClass,
                      )}
                    >
                      {r.columnTitle}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.agent?.name ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                          {initials(r.agent.name)}
                        </div>
                        <span className="text-foreground/90 truncate max-w-[140px]">{r.agent.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Sem responsável</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.temperature ? (
                      <span className="inline-flex items-center gap-1" title={TEMP_LABEL[r.temperature]}>
                        <Flame className={cn("w-4 h-4", TEMP_COLOR[r.temperature])} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {r.source || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatRelative(r.lastContactAt || r.stageEnteredAt)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {daysInStage(r.stageEnteredAt)}d
                  </td>
                  <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Ações"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs">Ações rápidas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {onCardAssignAgent && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Atribuir responsável
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56 max-h-72 overflow-auto">
                              {agentOptions.length === 0 ? (
                                <div className="px-2 py-2 text-xs text-muted-foreground">
                                  Nenhum usuário disponível
                                </div>
                              ) : (
                                agentOptions.map((u) => (
                                  <DropdownMenuItem
                                    key={u.user_id}
                                    onClick={() => onCardAssignAgent(r, u.user_id)}
                                  >
                                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mr-2">
                                      {initials(u.full_name)}
                                    </div>
                                    <span className="truncate">{u.full_name}</span>
                                  </DropdownMenuItem>
                                ))
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        {onCardCreateQuote && (
                          <DropdownMenuItem onClick={() => onCardCreateQuote(r)}>
                            <FileText className="w-4 h-4 mr-2" />
                            Criar cotação
                          </DropdownMenuItem>
                        )}
                        {onCardViewConversation && (
                          <DropdownMenuItem onClick={() => onCardViewConversation(r)}>
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Ver conversa
                          </DropdownMenuItem>
                        )}
                        {onCardEdit && (
                          <DropdownMenuItem onClick={() => onCardEdit(r)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {onCardArchive && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onCardArchive(r)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              Arquivar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
