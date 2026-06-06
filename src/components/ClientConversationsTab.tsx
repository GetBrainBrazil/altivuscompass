import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ExternalLink, Bot, User as UserIcon, Check } from "lucide-react";

interface Props {
  clientId: string;
}

interface ConvoRow {
  id: string;
  phone: string;
  contact_name: string | null;
  status: string | null;
  ai_enabled: boolean | null;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_from: string | null;
  created_at: string;
  contact_id: string | null;
}

function digits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status, ai }: { status: string | null; ai: boolean | null }) {
  if (status === "resolved")
    return (
      <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600/40">
        <Check className="h-3 w-3" /> Resolvida
      </Badge>
    );
  if (status === "human")
    return (
      <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600/40">
        <UserIcon className="h-3 w-3" /> Humano
      </Badge>
    );
  if (ai)
    return (
      <Badge variant="outline" className="gap-1 text-blue-600 border-blue-600/40">
        <Bot className="h-3 w-3" /> IA
      </Badge>
    );
  return <Badge variant="outline">Aberta</Badge>;
}

export default function ClientConversationsTab({ clientId }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ConvoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1) Contacts pertencentes a este cliente
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id")
          .eq("client_id", clientId);
        const contactIds = (contacts ?? []).map((c: any) => c.id);

        // 2) Telefones cadastrados do cliente (fallback de matching)
        const { data: phones } = await supabase
          .from("client_phones")
          .select("phone")
          .eq("client_id", clientId);
        const phoneTails = (phones ?? [])
          .map((p: any) => digits(p.phone).slice(-9))
          .filter((t: string) => t.length >= 8);

        // 3) Busca conversas pelo contact_id; depois complementa por sufixo do telefone
        const byContact: ConvoRow[] = [];
        if (contactIds.length > 0) {
          const { data } = await supabase
            .from("wa_conversations" as any)
            .select(
              "id, phone, contact_name, status, ai_enabled, last_message_at, last_message_text, last_message_from, created_at, contact_id",
            )
            .in("contact_id", contactIds)
            .order("last_message_at", { ascending: false });
          if (data) byContact.push(...(data as any));
        }

        let byPhone: ConvoRow[] = [];
        if (phoneTails.length > 0) {
          const ors = phoneTails.map((t) => `phone.ilike.%${t}`).join(",");
          const { data } = await supabase
            .from("wa_conversations" as any)
            .select(
              "id, phone, contact_name, status, ai_enabled, last_message_at, last_message_text, last_message_from, created_at, contact_id",
            )
            .or(ors)
            .order("last_message_at", { ascending: false });
          if (data) byPhone = (data as any[]).filter((c) =>
            phoneTails.some((t) => digits(c.phone).endsWith(t)),
          );
        }

        const merged = new Map<string, ConvoRow>();
        [...byContact, ...byPhone].forEach((c) => merged.set(c.id, c));
        const all = Array.from(merged.values()).sort((a, b) => {
          const ta = a.last_message_at ?? a.created_at;
          const tb = b.last_message_at ?? b.created_at;
          return new Date(tb).getTime() - new Date(ta).getTime();
        });
        if (!cancelled) setRows(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando conversas...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          Nenhuma conversa de WhatsApp encontrada para este cliente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((c) => (
        <div
          key={c.id}
          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm font-body">{c.phone}</span>
              <StatusBadge status={c.status} ai={c.ai_enabled} />
              <span className="text-xs text-muted-foreground ml-auto">
                {formatDateTime(c.last_message_at ?? c.created_at)}
              </span>
            </div>
            {c.last_message_text && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {c.last_message_from === "agent" || c.last_message_from === "ai"
                  ? "Você: "
                  : ""}
                {c.last_message_text}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 gap-1"
            onClick={() => navigate(`/service-center?conversation=${c.id}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </Button>
        </div>
      ))}
    </div>
  );
}
