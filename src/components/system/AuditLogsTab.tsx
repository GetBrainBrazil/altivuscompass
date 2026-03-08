import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowUp, ArrowDown, ArrowUpDown, CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type AuditLog = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
};

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;
type DatePreset = "all" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Criação", UPDATE: "Alteração", DELETE: "Remoção",
  CREATE: "Criação", create: "Criação", update: "Alteração", delete: "Remoção",
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-success/10 text-success", UPDATE: "bg-soft-blue/10 text-soft-blue", DELETE: "bg-destructive/10 text-destructive",
  CREATE: "bg-success/10 text-success", create: "bg-success/10 text-success", update: "bg-soft-blue/10 text-soft-blue", delete: "bg-destructive/10 text-destructive",
};

const TABLE_LABELS: Record<string, string> = {
  clients: "Clientes", quotes: "Cotações", financial_transactions: "Transações",
  bank_accounts: "Contas Bancárias", bank_account_credentials: "Acessos Bancários",
  campaigns: "Campanhas", miles_programs: "Milhas", passengers: "Passageiros",
  profiles: "Perfis", user_roles: "Funções", financial_categories: "Categorias Financeiras",
  financial_parties: "Partes Financeiras", airports: "Aeroportos", airlines: "Companhias Aéreas",
  tags: "Tags", sessions: "Sessão",
};

const SESSION_EVENT_LABELS: Record<string, string> = {
  LOGIN: "Login", LOGOUT: "Logout", LOGOUT_INACTIVITY: "Logout (inatividade)",
};

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "Todas as datas",
  today: "Hoje",
  yesterday: "Ontem",
  this_week: "Esta semana",
  this_month: "Este mês",
  last_month: "Mês passado",
  custom: "Personalizado",
};

function getDateRange(preset: DatePreset, customFrom?: Date, customTo?: Date): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "this_week": return { from: startOfWeek(now, { locale: ptBR }), to: endOfDay(now) };
    case "this_month": return { from: startOfMonth(now), to: endOfDay(now) };
    case "last_month": { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case "custom": return { from: customFrom ? startOfDay(customFrom) : null, to: customTo ? endOfDay(customTo) : null };
    default: return { from: null, to: null };
  }
}

function toggleSort(sort: SortState, key: string): SortState {
  if (sort?.key === key) {
    if (sort.dir === "asc") return { key, dir: "desc" };
    return null;
  }
  return { key, dir: "asc" };
}

function SortIcon({ sort, column }: { sort: SortState; column: string }) {
  if (sort?.key !== column) return <ArrowUpDown size={12} className="opacity-30" />;
  return sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export default function AuditLogsTab() {
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [sort, setSort] = useState<SortState>({ key: "created_at", dir: "desc" });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const tables = useMemo(() => {
    const set = new Set(logs.map((l) => l.table_name));
    return Array.from(set).sort();
  }, [logs]);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.user_name && l.user_id) map.set(l.user_id, l.user_name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [logs]);

  const filtered = useMemo(() => {
    const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo);

    let result = logs.filter((log) => {
      if (tableFilter !== "all" && log.table_name !== tableFilter) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (userFilter !== "all" && log.user_id !== userFilter) return false;
      // Date filter
      if (dateFrom || dateTo) {
        const logDate = new Date(log.created_at);
        if (dateFrom && logDate < dateFrom) return false;
        if (dateTo && logDate > dateTo) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesUser = log.user_name?.toLowerCase().includes(q);
        const matchesTable = (TABLE_LABELS[log.table_name] ?? log.table_name).toLowerCase().includes(q);
        const matchesData = JSON.stringify(log.new_data ?? log.old_data ?? "").toLowerCase().includes(q);
        if (!matchesUser && !matchesTable && !matchesData) return false;
      }
      return true;
    });

    if (sort) {
      result = [...result].sort((a, b) => {
        let va = "", vb = "";
        if (sort.key === "created_at") {
          va = a.created_at; vb = b.created_at;
        } else if (sort.key === "user_name") {
          va = (a.user_name ?? "").toLowerCase(); vb = (b.user_name ?? "").toLowerCase();
        } else if (sort.key === "action") {
          va = a.action.toLowerCase(); vb = b.action.toLowerCase();
        } else if (sort.key === "table_name") {
          va = (TABLE_LABELS[a.table_name] ?? a.table_name).toLowerCase();
          vb = (TABLE_LABELS[b.table_name] ?? b.table_name).toLowerCase();
        }
        return sort.dir === "asc" ? va.localeCompare(vb) : -va.localeCompare(vb);
      });
    }

    return result;
  }, [logs, tableFilter, actionFilter, userFilter, search, sort, datePreset, customFrom, customTo]);

  const getChangedFields = (oldData: Record<string, any> | null, newData: Record<string, any> | null) => {
    if (!oldData || !newData) return null;
    const changes: { field: string; from: any; to: any }[] = [];
    for (const key of Object.keys(newData)) {
      if (["updated_at", "created_at"].includes(key)) continue;
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push({ field: key, from: oldData[key], to: newData[key] });
      }
    }
    return changes.length > 0 ? changes : null;
  };

  const getActionLabel = (log: AuditLog) => {
    if (log.table_name === "sessions") {
      const event = (log.new_data as Record<string, any>)?.event;
      return SESSION_EVENT_LABELS[event] ?? event ?? "Sessão";
    }
    return ACTION_LABELS[log.action] ?? log.action;
  };

  const getActionColor = (log: AuditLog) => {
    if (log.table_name === "sessions") {
      const event = (log.new_data as Record<string, any>)?.event;
      if (event === "LOGIN") return "bg-success/10 text-success";
      if (event === "LOGOUT_INACTIVITY") return "bg-warning/10 text-warning";
      return "bg-muted text-muted-foreground";
    }
    return ACTION_COLORS[log.action] ?? "";
  };

  const getSummary = (log: AuditLog) => {
    if (log.table_name === "sessions") return "";
    const changes = log.action === "UPDATE" ? getChangedFields(log.old_data, log.new_data) : null;
    if (changes) return changes.map(c => c.field).join(", ");
    const data = log.new_data ?? log.old_data;
    if (!data) return "";
    return Object.entries(data)
      .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${String(v ?? "—").substring(0, 30)}`)
      .join(" | ");
  };

  const handleDatePresetChange = (value: string) => {
    setDatePreset(value as DatePreset);
    if (value !== "custom") {
      setCustomFrom(undefined);
      setCustomTo(undefined);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters row 1 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            {users.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
            <Filter size={14} className="mr-1" />
            <SelectValue placeholder="Tabela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tabelas</SelectItem>
            {tables.map((t) => (
              <SelectItem key={t} value={t}>{TABLE_LABELS[t] ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            <SelectItem value="INSERT">Criação</SelectItem>
            <SelectItem value="UPDATE">Alteração</SelectItem>
            <SelectItem value="DELETE">Remoção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filters row 2 - date */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Select value={datePreset} onValueChange={handleDatePresetChange}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
            <CalendarIcon size={14} className="mr-1" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DATE_PRESET_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {datePreset === "custom" && (
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 text-sm justify-start gap-2 w-36", !customFrom && "text-muted-foreground")}>
                  <CalendarIcon size={14} />
                  {customFrom ? format(customFrom, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-9 text-sm justify-start gap-2 w-36", !customTo && "text-muted-foreground")}>
                  <CalendarIcon size={14} />
                  {customTo ? format(customTo, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando logs...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground font-body">Nenhum log encontrado.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-3 font-medium font-body text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => setSort(toggleSort(sort, "created_at"))}>
                    <span className="flex items-center gap-1">Data/Hora <SortIcon sort={sort} column="created_at" /></span>
                  </th>
                  <th className="text-left p-3 font-medium font-body text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => setSort(toggleSort(sort, "user_name"))}>
                    <span className="flex items-center gap-1">Usuário <SortIcon sort={sort} column="user_name" /></span>
                  </th>
                  <th className="text-left p-3 font-medium font-body text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => setSort(toggleSort(sort, "action"))}>
                    <span className="flex items-center gap-1">Ação <SortIcon sort={sort} column="action" /></span>
                  </th>
                  <th className="text-left p-3 font-medium font-body text-muted-foreground cursor-pointer select-none whitespace-nowrap" onClick={() => setSort(toggleSort(sort, "table_name"))}>
                    <span className="flex items-center gap-1">Módulo <SortIcon sort={sort} column="table_name" /></span>
                  </th>
                  <th className="text-left p-3 font-medium font-body text-muted-foreground whitespace-nowrap hidden md:table-cell">Resumo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  const changes = log.action === "UPDATE" ? getChangedFields(log.old_data, log.new_data) : null;
                  const isSession = log.table_name === "sessions";

                  return (
                    <>
                      <tr
                        key={log.id}
                        className={cn(
                          "border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors",
                          isExpanded && "bg-muted/20"
                        )}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td className="p-3 whitespace-nowrap font-body text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                        </td>
                        <td className="p-3 font-body text-sm text-foreground whitespace-nowrap">
                          {log.user_name ?? "Sistema"}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] font-body ${getActionColor(log)}`}>
                            {getActionLabel(log)}
                          </Badge>
                        </td>
                        <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">
                          {isSession ? "" : (TABLE_LABELS[log.table_name] ?? log.table_name)}
                        </td>
                        <td className="p-3 font-body text-xs text-muted-foreground truncate max-w-[300px] hidden md:table-cell">
                          {getSummary(log)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${log.id}-detail`}>
                          <td colSpan={5} className="p-0">
                            <div className="bg-muted/20 border-b border-border px-4 py-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-body font-medium text-foreground">Detalhes do registro</span>
                                <span className="text-[10px] font-body text-muted-foreground">
                                  {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                </span>
                              </div>

                              {isSession && (
                                <p className="text-xs font-body text-muted-foreground">
                                  E-mail: {(log.new_data as any)?.email ?? "—"}
                                </p>
                              )}

                              {changes && changes.length > 0 && (
                                <div className="space-y-1">
                                  {changes.map((c, i) => (
                                    <div key={i} className="text-xs font-body text-muted-foreground">
                                      <span className="font-medium text-foreground">{c.field}</span>:{" "}
                                      <span className="line-through text-destructive/70">{String(c.from ?? "—")}</span>
                                      {" → "}
                                      <span className="text-success">{String(c.to ?? "—")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {!isSession && !changes && log.new_data && (
                                <div className="text-xs font-body text-muted-foreground space-y-0.5">
                                  {Object.entries(log.new_data)
                                    .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
                                    .map(([k, v]) => (
                                      <div key={k}><span className="font-medium text-foreground">{k}</span>: {String(v ?? "—")}</div>
                                    ))}
                                </div>
                              )}

                              {!isSession && log.action === "DELETE" && log.old_data && (
                                <div className="text-xs font-body text-muted-foreground space-y-0.5">
                                  {Object.entries(log.old_data)
                                    .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
                                    .map(([k, v]) => (
                                      <div key={k}><span className="font-medium text-foreground">{k}</span>: {String(v ?? "—")}</div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground font-body text-right">
        {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
