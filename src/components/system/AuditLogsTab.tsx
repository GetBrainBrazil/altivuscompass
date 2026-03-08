import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Criou",
  UPDATE: "Alterou",
  DELETE: "Removeu",
  create: "Criou",
  update: "Alterou",
  delete: "Removeu",
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-success/10 text-success",
  UPDATE: "bg-soft-blue/10 text-soft-blue",
  DELETE: "bg-destructive/10 text-destructive",
  create: "bg-success/10 text-success",
  update: "bg-soft-blue/10 text-soft-blue",
  delete: "bg-destructive/10 text-destructive",
};

const TABLE_LABELS: Record<string, string> = {
  clients: "Clientes",
  quotes: "Cotações",
  financial_transactions: "Transações",
  bank_accounts: "Contas Bancárias",
  bank_account_credentials: "Acessos Bancários",
  campaigns: "Campanhas",
  miles_programs: "Milhas",
  passengers: "Passageiros",
  profiles: "Perfis",
  user_roles: "Funções",
  financial_categories: "Categorias Financeiras",
  financial_parties: "Partes Financeiras",
  airports: "Aeroportos",
  airlines: "Companhias Aéreas",
  tags: "Tags",
};

export default function AuditLogsTab() {
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

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

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (tableFilter !== "all" && log.table_name !== tableFilter) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesUser = log.user_name?.toLowerCase().includes(q);
        const matchesTable = (TABLE_LABELS[log.table_name] ?? log.table_name).toLowerCase().includes(q);
        const matchesData = JSON.stringify(log.new_data ?? log.old_data ?? "").toLowerCase().includes(q);
        if (!matchesUser && !matchesTable && !matchesData) return false;
      }
      return true;
    });
  }, [logs, tableFilter, actionFilter, search]);

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário, tabela ou conteúdo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
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

      {/* Results */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando logs...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground font-body">Nenhum log encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const changes = log.action === "UPDATE" ? getChangedFields(log.old_data, log.new_data) : null;
            return (
              <div key={log.id} className="glass-card rounded-lg p-3 sm:p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] font-body ${ACTION_COLORS[log.action] ?? ""}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                    <span className="text-sm font-body font-medium text-foreground">
                      {log.user_name ?? "Sistema"}
                    </span>
                    <span className="text-xs text-muted-foreground font-body">
                      em <span className="font-medium">{TABLE_LABELS[log.table_name] ?? log.table_name}</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>

                {/* Show changes for UPDATE */}
                {changes && changes.length > 0 && (
                  <div className="bg-muted/30 rounded-md p-2 space-y-1">
                    {changes.slice(0, 5).map((c, i) => (
                      <div key={i} className="text-xs font-body text-muted-foreground">
                        <span className="font-medium text-foreground">{c.field}</span>:{" "}
                        <span className="line-through text-destructive/70">{String(c.from ?? "—")}</span>
                        {" → "}
                        <span className="text-success">{String(c.to ?? "—")}</span>
                      </div>
                    ))}
                    {changes.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">+{changes.length - 5} alterações</p>
                    )}
                  </div>
                )}

                {/* Show data for INSERT */}
                {log.action === "INSERT" && log.new_data && (
                  <div className="bg-muted/30 rounded-md p-2">
                    <p className="text-xs font-body text-muted-foreground truncate">
                      {Object.entries(log.new_data)
                        .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${String(v ?? "—")}`)
                        .join(" | ")}
                    </p>
                  </div>
                )}

                {/* Show data for DELETE */}
                {log.action === "DELETE" && log.old_data && (
                  <div className="bg-destructive/5 rounded-md p-2">
                    <p className="text-xs font-body text-muted-foreground truncate">
                      {Object.entries(log.old_data)
                        .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${String(v ?? "—")}`)
                        .join(" | ")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
