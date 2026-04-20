import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Mail, Phone, IdCard, Clock, Copy, Globe, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Acceptance {
  id: string;
  accepter_name: string;
  accepter_email: string;
  accepter_phone: string;
  accepter_cpf: string;
  accepted_at: string;
  selected_item_ids: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface Props {
  quoteId: string;
}

const formatDateTimeBR = (iso: string) => {
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
};

const formatPhoneBR = (raw: string) => {
  const d = String(raw ?? "").replace(/\D/g, "");
  // strip BR DDI if present
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw;
};

const formatCPF = (raw: string) => {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const waLink = (raw: string) => {
  const d = String(raw ?? "").replace(/\D/g, "");
  const intl = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${intl}`;
};

const copy = async (value: string, label: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
};

export default function QuoteAcceptanceInfo({ quoteId }: Props) {
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("quote_acceptances")
        .select(
          "id, accepter_name, accepter_email, accepter_phone, accepter_cpf, accepted_at, selected_item_ids, ip_address, user_agent"
        )
        .eq("quote_id", quoteId)
        .order("accepted_at", { ascending: true });
      if (!active) return;
      if (error) {
        console.error("Erro ao buscar aceites:", error);
        setAcceptances([]);
      } else {
        setAcceptances((data as Acceptance[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [quoteId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando aceites...</div>;
  }
  if (acceptances.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Esta cotação ainda não foi aceita pelo cliente.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {acceptances.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border-2 border-emerald-300 bg-emerald-50/70 p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-500/15 p-2 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-emerald-900 font-body">
                  Proposta aceita
                </h3>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-800/80">
                  <Clock className="w-3 h-3" />
                  {formatDateTimeBR(a.accepted_at)}
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground mt-0.5 font-body">
                {a.accepter_name}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Email */}
            <div className="rounded-md bg-background border border-border p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide font-body mb-1">
                <Mail className="w-3 h-3" /> E-mail
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`mailto:${a.accepter_email}`}
                  className="text-sm text-foreground hover:underline truncate flex-1 font-body"
                  title={a.accepter_email}
                >
                  {a.accepter_email}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copy(a.accepter_email, "E-mail")}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Phone */}
            <div className="rounded-md bg-background border border-border p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide font-body mb-1">
                <Phone className="w-3 h-3" /> Telefone / WhatsApp
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={waLink(a.accepter_phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:underline flex-1 font-body"
                >
                  {formatPhoneBR(a.accepter_phone)}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copy(formatPhoneBR(a.accepter_phone), "Telefone")}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* CPF */}
            <div className="rounded-md bg-background border border-border p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide font-body mb-1">
                <IdCard className="w-3 h-3" /> CPF
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-foreground flex-1 font-body">
                  {formatCPF(a.accepter_cpf)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copy(formatCPF(a.accepter_cpf), "CPF")}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Auditoria */}
          {(a.ip_address || a.user_agent) && (
            <div className="pt-2 border-t border-emerald-200/60 space-y-0.5">
              {a.ip_address && (
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground font-body">
                  <Globe className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>IP: {a.ip_address}</span>
                </div>
              )}
              {a.user_agent && (
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground font-body">
                  <Monitor className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="break-all">{a.user_agent}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
