import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageIds: string[];
  clientId?: string | null;
  leadId?: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  new: "Nova",
  sent: "Enviada",
  negotiation: "Negociação",
  confirmed: "Confirmada",
  issued: "Emitida",
  completed: "Concluída",
  post_sale: "Pós-venda",
};

export function MessageLinkDialog({ open, onOpenChange, messageIds, clientId, leadId }: Props) {
  const qc = useQueryClient();
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Carrega cotações disponíveis (cliente ou lead)
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["msg-link-quotes", clientId, leadId],
    enabled: open && (!!clientId || !!leadId),
    queryFn: async () => {
      let q = supabase
        .from("quotes")
        .select("id, title, stage, total_value, destination, created_at, client_id, lead_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (clientId && leadId) {
        q = q.or(`client_id.eq.${clientId},lead_id.eq.${leadId}`);
      } else if (clientId) {
        q = q.eq("client_id", clientId);
      } else if (leadId) {
        q = q.eq("lead_id", leadId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Carrega vínculos existentes para pré-selecionar
  const { data: existingLinks = [] } = useQuery({
    queryKey: ["msg-link-existing", messageIds],
    enabled: open && messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_message_links" as any)
        .select("quote_id")
        .in("message_id", messageIds);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      const ids = new Set<string>(
        (existingLinks as any[])
          .map((l) => l.quote_id)
          .filter(Boolean)
      );
      setSelectedQuoteIds(ids);
    }
  }, [open, existingLinks]);

  const toggleQuote = (id: string) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (messageIds.length === 0) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 1) Apaga vínculos antigos das mensagens
      await supabase
        .from("wa_message_links" as any)
        .delete()
        .in("message_id", messageIds);

      // 2) Insere novos
      const rows: any[] = [];
      for (const mid of messageIds) {
        for (const qid of selectedQuoteIds) {
          rows.push({
            message_id: mid,
            quote_id: qid,
            link_kind: "quote",
            created_by: user?.id ?? null,
          });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("wa_message_links" as any).insert(rows);
        if (error) throw error;
      }

      toast.success(
        rows.length > 0
          ? `${messageIds.length} mensagem(ns) vinculada(s) a ${selectedQuoteIds.size} cotação(ões).`
          : "Vínculos removidos.",
      );
      qc.invalidateQueries({ queryKey: ["wa-message-links"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar vínculos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular mensagens</DialogTitle>
          <DialogDescription>
            {messageIds.length} mensagem(ns) selecionada(s). Escolha as cotações para vincular.
          </DialogDescription>
        </DialogHeader>

        {!clientId && !leadId ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Este contato ainda não tem cliente nem lead associado.
          </p>
        ) : isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma cotação encontrada para este contato.
          </p>
        ) : (
          <ScrollArea className="max-h-[360px] pr-3">
            <div className="space-y-2">
              {quotes.map((q: any) => (
                <label
                  key={q.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedQuoteIds.has(q.id)}
                    onCheckedChange={() => toggleQuote(q.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">
                        {q.title || q.destination || "Cotação sem título"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {STAGE_LABELS[q.stage] || q.stage}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {q.destination ? `${q.destination} · ` : ""}
                      {q.total_value
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(q.total_value))
                        : "—"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Salvar vínculos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
