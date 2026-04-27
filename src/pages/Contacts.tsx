import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Phone, Mail, Plus, Sparkles } from "lucide-react";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import { PromoteToLeadDialog } from "@/components/contacts/PromoteToLeadDialog";
import { cn } from "@/lib/utils";

type ContactRow = {
  id: string;
  level: ContactLevel;
  full_name: string;
  phone: string | null;
  email: string | null;
  lead_id: string | null;
  client_id: string | null;
  source: string | null;
  promoted_to_lead_at: string | null;
  promoted_to_cliente_at: string | null;
  created_at: string;
};

const FILTERS: Array<{ key: "all" | ContactLevel; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "prospect", label: "Prospects" },
  { key: "lead", label: "Leads" },
  { key: "cliente", label: "Clientes" },
];

export default function Contacts() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ContactLevel>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        console.error("[Contacts] fetch error", error);
        setRows([]);
      } else {
        setRows((data ?? []) as ContactRow[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { all: rows.length, prospect: 0, lead: 0, cliente: 0 };
    rows.forEach((r) => {
      c[r.level] = (c[r.level] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.level !== filter) return false;
      if (!term) return true;
      return (
        r.full_name.toLowerCase().includes(term) ||
        (r.phone ?? "").toLowerCase().includes(term) ||
        (r.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, filter, search]);

  const handleRowClick = (row: ContactRow) => {
    if (row.level === "cliente" && row.client_id) {
      navigate(`/clients?id=${row.client_id}`);
    } else if (row.lead_id) {
      navigate(`/crm/lead/${row.lead_id}`);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display text-foreground">Contatos</h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Prospects, Leads e Clientes em uma única visão.
          </p>
        </div>
        <Button onClick={() => navigate("/clients?new=1")} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo cliente
        </Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            const count = counts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-body border transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted/50 border-border text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold",
                    isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <div className="ml-auto relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_140px_220px_220px_140px] gap-3 px-4 py-3 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground font-body">
          <span>Nome</span>
          <span>Nível</span>
          <span>Telefone</span>
          <span>E-mail</span>
          <span>Origem</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum contato encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <li
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(r);
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_220px_220px_140px] gap-2 md:gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground font-body truncate">
                    {r.full_name}
                  </span>
                  <span className="md:hidden">
                    <ContactLevelBadge level={r.level} size="xs" />
                  </span>
                </div>
                <div className="hidden md:flex items-center">
                  <ContactLevelBadge level={r.level} />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-0">
                  {r.phone ? (
                    <>
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{r.phone}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body min-w-0">
                  {r.email ? (
                    <>
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{r.email}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-body capitalize">
                  {r.source ?? "manual"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
