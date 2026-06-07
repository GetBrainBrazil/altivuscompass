import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KanbanCardData } from "@/components/crm/KanbanCard";

type ContactLevel = "prospect" | "lead" | "cliente";

type ContactClient = {
  id: string;
  clientId: string | null;
  fullName: string;
  level: ContactLevel | string;
};

const LEVEL_META: Record<string, { label: string; className: string }> = {
  cliente: {
    label: "Cliente",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  },
  lead: {
    label: "Lead",
    className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  },
  prospect: {
    label: "Prospect",
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  },
};

function LevelBadge({ level, className }: { level: string; className?: string }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.prospect;
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0 h-5", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}

type QuoteOption = {
  id: string;
  title: string | null;
  destination: string | null;
  travel_date_start: string | null;
  travel_date_end: string | null;
  stage: string;
};

type Responsible = { user_id: string; full_name: string; avatar_url?: string | null };

const OPS_STAGES: { id: string; title: string }[] = [
  { id: "pre-trip", title: "Pré-Viagem" },
  { id: "in-trip", title: "Em Viagem" },
  { id: "support", title: "Suporte Ativo" },
  { id: "post-trip", title: "Pós-Viagem" },
];

const FINISHED_STAGES = ["confirmed", "issued", "completed", "post_sale"] as const;

export const PENDING_OPS_CARD_KEY = "crm:pending_ops_card";

export default function OpsNew() {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<ContactClient[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [responsibleOptions, setResponsibleOptions] = useState<Responsible[]>([]);

  const [contactId, setContactId] = useState<string>("");
  const [quoteId, setQuoteId] = useState<string>("none");
  const [stageId, setStageId] = useState<string>("pre-trip");
  const [departureDate, setDepartureDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [responsibleId, setResponsibleId] = useState<string>("none");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Load responsibles (active profiles)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .order("full_name", { ascending: true })
        .limit(200);
      setResponsibleOptions((data || []) as Responsible[]);
    })();
  }, []);

  // Load contacts (Cliente only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingContacts(true);
      const { data: contactRows } = await supabase
        .from("contacts")
        .select("id, full_name, level, client_id")
        .order("full_name", { ascending: true })
        .limit(500);

      const list: ContactClient[] = [];
      const seenClientIds = new Set<string>();
      (contactRows || []).forEach((c: any) => {
        list.push({
          id: c.id,
          clientId: c.client_id ?? null,
          fullName: c.full_name,
          level: c.level,
        });
        if (c.client_id) seenClientIds.add(c.client_id);
      });

      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true })
        .limit(500);

      (clientRows || []).forEach((c: any) => {
        if (!seenClientIds.has(c.id)) {
          list.push({ id: `client-${c.id}`, clientId: c.id, fullName: c.full_name, level: "cliente" });
        }
      });

      if (!cancelled) {
        list.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
        setContacts(list);
        setLoadingContacts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) || null,
    [contacts, contactId],
  );

  useEffect(() => {
    if (!selectedContact || !selectedContact.clientId) {
      setQuotes([]);
      setQuoteId("none");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQuotes(true);
      const { data, error } = await supabase
        .from("quotes")
        .select("id, title, destination, travel_date_start, travel_date_end, stage")
        .eq("client_id", selectedContact.clientId)
        .in("stage", FINISHED_STAGES)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setQuotes(error ? [] : ((data || []) as QuoteOption[]));
        setQuoteId("none");
        setLoadingQuotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedContact]);

  useEffect(() => {
    if (quoteId === "none") return;
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return;
    if (q.destination) setDestination(q.destination);
    if (q.travel_date_start) setDepartureDate(q.travel_date_start);
    if (q.travel_date_end) setReturnDate(q.travel_date_end);
  }, [quoteId, quotes]);

  const isLeadOrProspectAttempt = selectedContact && selectedContact.level !== "cliente";

  const handleCancel = () => navigate("/crm/ops?tab=ops");

  const handleSubmit = async () => {
    if (!selectedContact) {
      toast.error("Selecione um cliente.");
      return;
    }
    if (selectedContact.level !== "cliente") {
      toast.error("Apenas clientes com venda fechada podem ter operações de viagem.");
      return;
    }
    if (!stageId) {
      toast.error("Selecione a etapa inicial.");
      return;
    }

    setSubmitting(true);
    const responsible = responsibleOptions.find((r) => r.user_id === responsibleId);
    const card: KanbanCardData = {
      id: `manual-ops-${crypto.randomUUID()}`,
      clientName: selectedContact.fullName,
      destination: destination || undefined,
      travelDate: departureDate ? new Date(departureDate).toLocaleDateString("pt-BR") : undefined,
      travelDateISO: departureDate || undefined,
      contactLevel: "cliente",
      isManualLead: true,
      stageEnteredAt: new Date().toISOString(),
      agent: responsible
        ? { id: responsible.user_id, name: responsible.full_name, avatarUrl: responsible.avatar_url || undefined }
        : undefined,
      tags: notes ? [{ label: "Com observações", tone: "slate" }] : undefined,
    };

    try {
      sessionStorage.setItem(
        PENDING_OPS_CARD_KEY,
        JSON.stringify({ card, columnId: stageId }),
      );
    } catch {
      /* ignore */
    }

    toast.success(`Operação criada em "${OPS_STAGES.find((s) => s.id === stageId)?.title}".`);
    setSubmitting(false);
    navigate("/crm/ops?tab=ops");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nova Operação de Viagem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crie um novo card no Kanban de Operações vinculado a um cliente.
        </p>
      </header>

      <div className="rounded-2xl border bg-card p-5 sm:p-7 space-y-5">
        <div className="space-y-1.5">
          <Label>Cliente *</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger>
              {selectedContact ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{selectedContact.fullName}</span>
                  <LevelBadge level={selectedContact.level} />
                </span>
              ) : (
                <SelectValue placeholder={loadingContacts ? "Carregando..." : "Selecione um cliente"} />
              )}
            </SelectTrigger>
            <SelectContent className="max-h-[260px]">
              {contacts.length === 0 && !loadingContacts ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum contato encontrado.</div>
              ) : (
                contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2 w-full">
                      <span className="truncate">{c.fullName}</span>
                      <LevelBadge level={c.level} className="ml-auto" />
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {isLeadOrProspectAttempt && (
            <p className="text-xs text-destructive">
              Apenas clientes com venda fechada podem ter operações de viagem.
            </p>
          )}
          {!selectedContact && (
            <p className="text-xs text-muted-foreground">
              A categoria de cada contato é exibida ao lado do nome (Prospect, Lead ou Cliente).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Cotação vinculada</Label>
          <Select value={quoteId} onValueChange={setQuoteId} disabled={!selectedContact || loadingQuotes}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !selectedContact
                    ? "Selecione um cliente primeiro"
                    : loadingQuotes
                      ? "Carregando cotações..."
                      : "Nenhuma (opcional)"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-[260px]">
              <SelectItem value="none">Nenhuma</SelectItem>
              {quotes.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.title || q.destination || `Cotação ${q.id.slice(0, 6)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedContact && quotes.length === 0 && !loadingQuotes && (
            <p className="text-xs text-muted-foreground">Este cliente não possui cotações concluídas.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Etapa inicial *</Label>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPS_STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Data de embarque</Label>
            <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de retorno</Label>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Destino</Label>
          <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex.: Paris, França" />
        </div>

        <div className="space-y-1.5">
          <Label>Responsável operacional</Label>
          <Select value={responsibleId} onValueChange={setResponsibleId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent className="max-h-[260px]">
              <SelectItem value="none">Sem responsável</SelectItem>
              {responsibleOptions.map((r) => (
                <SelectItem key={r.user_id} value={r.user_id}>
                  {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalhes adicionais sobre a operação..."
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedContact || isLeadOrProspectAttempt === true}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Criar Operação
          </Button>
        </div>
      </div>
    </div>
  );
}
