import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, MessageSquare, FileEdit, Plus, Trash2, ArrowRightLeft, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTION_META: Record<string, { label: string; icon: any; color: string }> = {
  created: { label: "Criação", icon: Plus, color: "bg-emerald-500/20 text-emerald-700" },
  updated: { label: "Alteração", icon: FileEdit, color: "bg-blue-500/20 text-blue-700" },
  deleted: { label: "Exclusão", icon: Trash2, color: "bg-destructive/20 text-destructive" },
  stage_change: { label: "Mudança de Etapa", icon: ArrowRightLeft, color: "bg-amber-500/20 text-amber-700" },
  interaction: { label: "Interação", icon: MessageSquare, color: "bg-violet-500/20 text-violet-700" },
};

interface QuoteHistoryTabProps {
  quoteId: string;
}

export default function QuoteHistoryTab({ quoteId }: QuoteHistoryTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["quote-history", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_history")
        .select("*")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveInteraction = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      // Get user name from profile
      let userName = user?.email ?? "Usuário";
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();
        if (profile?.full_name) userName = profile.full_name;
      }

      const { error } = await supabase.from("quote_history").insert({
        quote_id: quoteId,
        user_id: user?.id ?? null,
        user_name: userName,
        action: "interaction",
        description: note.trim(),
      });
      if (error) throw error;
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["quote-history", quoteId] });
      toast({ title: "Interação registrada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter((entry: any) => {
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchDesc = entry.description?.toLowerCase().includes(q);
        const matchUser = entry.user_name?.toLowerCase().includes(q);
        if (!matchDesc && !matchUser) return false;
      }
      return true;
    });
  }, [history, actionFilter, search]);

  return (
    <div className="space-y-4">
      {/* Input for client interaction */}
      <div className="space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Registrar interação com cliente (ligação, e-mail, reunião, observação...)"
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="font-body gap-1.5 text-xs"
            disabled={!note.trim() || saving}
            onClick={saveInteraction}
          >
            <Send className="w-3.5 h-3.5" />
            Registrar Interação
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no histórico..."
            className="pl-8 h-8 text-xs font-body"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="interaction">Interações</SelectItem>
            <SelectItem value="stage_change">Mudanças de Etapa</SelectItem>
            <SelectItem value="updated">Alterações</SelectItem>
            <SelectItem value="created">Criações</SelectItem>
            <SelectItem value="deleted">Exclusões</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground font-body animate-pulse py-4 text-center">Carregando histórico...</p>
      ) : history.length === 0 ? (
        <p className="text-xs text-muted-foreground font-body py-4 text-center">Nenhum registro no histórico.</p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          {history.map((entry: any) => {
            const meta = ACTION_META[entry.action] || ACTION_META.updated;
            const Icon = meta.icon;
            const ts = new Date(entry.created_at);

            return (
              <div key={entry.id} className="relative flex items-start gap-3 py-2.5 pl-0">
                {/* Icon dot */}
                <div className={`relative z-10 flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 ${meta.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                      {meta.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-body">
                      {entry.user_name ?? "Sistema"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-body ml-auto whitespace-nowrap">
                      {format(ts, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {entry.description && (
                    <p className="text-xs text-foreground font-body mt-0.5 whitespace-pre-line">{entry.description}</p>
                  )}
                  {/* Show changed fields for updates */}
                  {entry.action === "updated" && entry.details && Object.keys(entry.details).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.keys(entry.details).map((field) => (
                        <Badge key={field} variant="secondary" className="text-[9px] h-4 px-1">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
