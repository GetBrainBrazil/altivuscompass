import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUserPreference } from "@/hooks/useUserPreference";

type Category = "nova_funcionalidade" | "melhoria" | "correcao" | "remocao";

interface ChangelogEntry {
  id: string;
  version: string | null;
  date: string;
  title: string;
  description: string;
  category: Category;
  module: string;
}

const CATEGORY_META: Record<Category, { label: string; dot: string; bg: string; text: string }> = {
  nova_funcionalidade: { label: "Nova funcionalidade", dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
  melhoria: { label: "Melhoria", dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
  correcao: { label: "Correção", dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  remocao: { label: "Remoção", dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
};

const MODULES = ["Todos", "CRM", "Agentes IA", "Central de Atendimento", "Financeiro", "Geral"];

const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${PT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[entry.category];
  const isLong = entry.description.length > 320;

  return (
    <div className="relative pl-8 pb-6 animate-fade-in">
      <span className={`absolute left-[7px] top-4 h-3 w-3 rounded-full ring-4 ring-background ${meta.dot}`} />
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
            {entry.module}
          </span>
          {entry.version && (
            <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[11px] font-mono text-gray-500">
              v{entry.version}
            </span>
          )}
          <span className="ml-auto text-[12px] text-gray-400">{formatDate(entry.date)}</span>
        </div>
        <h4 className="text-[15px] font-semibold text-gray-800">{entry.title}</h4>
        <p
          className={`mt-1 text-[13px] text-gray-600 whitespace-pre-wrap ${
            !expanded && isLong ? "line-clamp-4" : ""
          }`}
        >
          {entry.description}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-[12px] font-medium text-primary hover:underline"
          >
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Changelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("Todos");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const { setValue: setSeen } = useUserPreference<{ lastSeenAt?: string }>(
    "changelog_last_seen",
    {},
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("platform_changelog")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (data) setEntries(data as ChangelogEntry[]);
      setLoading(false);
    })();
  }, []);

  // Mark as seen on visit
  useEffect(() => {
    setSeen({ lastSeenAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = moduleFilter === "Todos" ? entries : entries.filter((e) => e.module === moduleFilter);
  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">
          Atualizações da Plataforma
        </h1>
        <p className="text-muted-foreground font-body mt-1 text-sm">
          Histórico de mudanças, novas funcionalidades e correções.
        </p>
      </div>

      <div className="flex justify-end">
        <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue placeholder="Filtrar por módulo" />
          </SelectTrigger>
          <SelectContent>
            {MODULES.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-muted-foreground">
          Nenhuma atualização encontrada.
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gray-200" />
          {visible.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
          {hasMore && (
            <div className="pl-8">
              <Button
                variant="outline"
                className="w-full border-gray-200 text-gray-600"
                onClick={() => setPage((p) => p + 1)}
              >
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
