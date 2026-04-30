import { useEffect, useMemo, useRef, useState } from "react";
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
  Check,
  X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KanbanCardData, LeadTemperature } from "@/components/crm/KanbanCard";
import { ContactLevelBadge } from "@/components/contacts/ContactLevelBadge";
import { Checkbox } from "@/components/ui/checkbox";
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

export type CRMTableRow = KanbanCardData & {
  columnId: string;
  columnTitle: string;
};

interface CRMTableViewProps {
  columns: { id: string; title: string; cards: KanbanCardData[] }[];
  onCardClick: (card: KanbanCardData) => void;
  onCardAssignAgent?: (card: KanbanCardData, userId: string) => void;
  onCardCreateQuote?: (card: KanbanCardData) => void;
  onCardViewConversation?: (card: KanbanCardData) => void;
  onCardEdit?: (card: KanbanCardData) => void;
  onCardArchive?: (card: KanbanCardData) => void;
  onCardRenameClient?: (card: KanbanCardData, newName: string) => Promise<void> | void;
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
  hot: "text-rose-500 fill-rose-500/30",
  warm: "text-amber-500 fill-amber-500/25",
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

/**
 * Detecta se o "nome" do contato é, na verdade, apenas um número de telefone.
 * Mesma heurística usada no KanbanCard.
 */
function isPhoneLikeName(name?: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (/[A-Za-zÀ-ÿ]/.test(trimmed)) return false;
  return /\d/.test(trimmed) && /^[+\d\s().\-]+$/.test(trimmed);
}

/**
 * Formata um telefone E.164 (ex: 5521964447436) com máscara visual.
 * - BR (55): "+55 21 96444-7436"
 * - US/CA (1): "+1 (415) 555-1234"
 * - Outros: "+DDI restante" com agrupamentos genéricos.
 */
function formatPhone(raw?: string): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "—";

  // Brasil: 55 + DDD(2) + 8 ou 9 dígitos
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }

  // EUA/Canadá: 1 + 10 dígitos
  if (digits.startsWith("1") && digits.length === 11) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Genérico: agrupa em blocos de 3-4 dígitos
  if (digits.length > 10) {
    const ddi = digits.slice(0, digits.length - 10);
    const rest = digits.slice(-10);
    return `+${ddi} ${rest.slice(0, 2)} ${rest.slice(2, 6)}-${rest.slice(6)}`;
  }
  return `+${digits}`;
}

function formatRelative(iso?: string): { label: string; isStale: boolean } {
  if (!iso) return { label: "—", isStale: false };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { label: "—", isStale: false };
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  const isStale = days > 7;

  if (days <= 0) {
    const hours = Math.floor(diffMs / 3600000);
    if (hours <= 0) {
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return { label: `há ${mins}min`, isStale: false };
    }
    return { label: `há ${hours}h`, isStale: false };
  }
  if (days === 1) return { label: "há 1 dia", isStale: false };
  if (days < 7) return { label: `há ${days} dias`, isStale: false };
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return { label: weeks === 1 ? "há 1 semana" : `há ${weeks} semanas`, isStale };
  }
  const months = Math.floor(days / 30);
  if (months === 1) return { label: "há 1 mês", isStale };
  return { label: `há ${months} meses`, isStale };
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

/**
 * Edição inline do nome do contato (acionada quando o nome ainda é apenas um telefone).
 * Aparece dentro da própria célula de "Contato".
 */
function InlineNameEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: string;
  saving: boolean;
  onSave: (next: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={saving}
        placeholder="Nome do contato"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            const next = value.trim();
            if (next) onSave(next);
            else onCancel();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className="text-sm font-medium bg-background border border-primary/40 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-primary/30 max-w-[180px]"
      />
      <button
        type="button"
        aria-label="Salvar"
        disabled={saving || !value.trim()}
        onClick={() => {
          const next = value.trim();
          if (next) onSave(next);
          else onCancel();
        }}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-success hover:bg-success/10 disabled:opacity-40"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        aria-label="Cancelar"
        disabled={saving}
        onClick={onCancel}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:bg-muted/60"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
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
  onCardRenameClient,
  agentOptions,
}: CRMTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [savingNameId, setSavingNameId] = useState<string | null>(null);

  const rows: CRMTableRow[] = useMemo(() => {
    const all: CRMTableRow[] = [];
    for (const col of columns) {
      for (const card of col.cards) {
        all.push({ ...card, columnId: col.id, columnTitle: col.title });
      }
    }
    return all;
  }, [columns]);

  // Limpa seleção de IDs que sumiram (após filtro/atualização)
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(rows.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

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

  const allSelected = sortedRows.length > 0 && sortedRows.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedRows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAssign = (userId: string) => {
    if (!onCardAssignAgent) return;
    const selected = rows.filter((r) => selectedIds.has(r.id));
    selected.forEach((r) => onCardAssignAgent(r, userId));
    setSelectedIds(new Set());
  };

  const handleBulkArchive = () => {
    if (!onCardArchive) return;
    const selected = rows.filter((r) => selectedIds.has(r.id));
    selected.forEach((r) => onCardArchive(r));
    setSelectedIds(new Set());
  };

  const handleSaveName = async (row: CRMTableRow, next: string) => {
    if (!onCardRenameClient) {
      setEditingNameId(null);
      return;
    }
    try {
      setSavingNameId(row.id);
      await onCardRenameClient(row, next);
      setEditingNameId(null);
    } finally {
      setSavingNameId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-background">
      {/* Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-primary/20 animate-fade-in">
          <span className="text-xs font-medium text-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <div className="h-4 w-px bg-border" />
          {onCardAssignAgent && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Atribuir responsável
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-auto">
                <DropdownMenuLabel className="text-xs">Selecionar consultor</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {agentOptions.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhum usuário disponível
                  </div>
                ) : (
                  agentOptions.map((u) => (
                    <DropdownMenuItem key={u.user_id} onClick={() => handleBulkAssign(u.user_id)}>
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mr-2">
                        {initials(u.full_name)}
                      </div>
                      <span className="truncate">{u.full_name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onCardArchive && (
            <button
              type="button"
              onClick={handleBulkArchive}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Arquivar
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
            Limpar seleção
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur border-b border-border">
            <tr>
              <th className="w-10 px-3 py-2">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
              <HeaderCell label="Contato" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
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
                <td colSpan={14} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  Nenhum contato encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              sortedRows.map((r) => {
                const stageClass =
                  STAGE_TONE[r.columnId] ?? "bg-slate-100 text-slate-700 border-slate-200";
                const nameIsPhone = isPhoneLikeName(r.clientName);
                const isSelected = selectedIds.has(r.id);
                const isEditing = editingNameId === r.id;
                const lastContact = formatRelative(r.lastContactAt || r.stageEnteredAt);
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-border/60 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40",
                    )}
                    onClick={() => {
                      if (isEditing) return;
                      onCardClick(r);
                    }}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label={`Selecionar ${r.clientName}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <InlineNameEditor
                            initial=""
                            saving={savingNameId === r.id}
                            onSave={(next) => handleSaveName(r, next)}
                            onCancel={() => setEditingNameId(null)}
                          />
                        ) : (
                          <>
                            <span
                              className={cn(
                                "truncate max-w-[200px]",
                                nameIsPhone
                                  ? "italic text-muted-foreground"
                                  : "font-medium text-foreground",
                              )}
                              title={
                                nameIsPhone
                                  ? "Nome do contato ainda não informado — clique no lápis para atualizar"
                                  : undefined
                              }
                            >
                              {r.clientName || "—"}
                            </span>
                            {nameIsPhone && onCardRenameClient && (
                              <button
                                type="button"
                                aria-label="Editar nome do contato"
                                title="Editar nome do contato"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNameId(r.id);
                                }}
                                className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            {r.contactLevel && <ContactLevelBadge level={r.contactLevel} />}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatPhone(r.phone)}
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
                          <span className="text-foreground/90 truncate max-w-[140px]">
                            {r.agent.name}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
                          Não atribuído
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.temperature ? (
                        <span
                          className="inline-flex items-center gap-1.5"
                          title={TEMP_LABEL[r.temperature]}
                        >
                          <Flame className={cn("w-4 h-4", TEMP_COLOR[r.temperature])} />
                          <span className="text-xs text-foreground/80">
                            {TEMP_LABEL[r.temperature]}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {r.source || "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 whitespace-nowrap",
                        lastContact.isStale ? "text-destructive font-medium" : "text-muted-foreground",
                      )}
                    >
                      {lastContact.label}
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
    </div>
  );
}
