import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { KanbanCardData } from "@/components/crm/KanbanCard";

type ContactClient = {
  id: string; // contact id (or client id when no contact)
  clientId: string; // resolved client id
  fullName: string;
  level: "prospect" | "lead" | "cliente" | string;
};

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

const FINISHED_STAGES = ["confirmed", "issued", "completed", "post_sale"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  responsibleOptions: Responsible[];
  onCreated: (card: KanbanCardData, columnId: string) => void;
}

export function NewOpsDialog({ open, onOpenChange, responsibleOptions, onCreated }: Props) {
  const [contacts, setContacts] = useState<ContactClient[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  // form state
  const [contactId, setContactId] = useState<string>("");
  const [quoteId, setQuoteId] = useState<string>("none");
  const [stageId, setStageId] = useState<string>("pre-trip");
  const [departureDate, setDepartureDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [responsibleId, setResponsibleId] = useState<string>("none");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setContactId("");
      setQuoteId("none");
      setStageId("pre-trip");
      setDepartureDate("");
      setReturnDate("");
      setDestination("");
      setResponsibleId("none");
      setNotes("");
      setQuotes([]);
    }
  }, [open]);

  // Load contacts (Cliente level only). We try contacts table first, fall back to clients.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingContacts(true);
      // Buscar de "contacts" todos os níveis (para validação) — mas exibimos só "cliente"
      const { data: contactRows } = await supabase
        .from("contacts")
        .select("id, full_name, level, client_id")
        .order("full_name", { ascending: true })
        .limit(500);

      const list: ContactClient[] = [];
      const seenClientIds = new Set<string>();

      (contactRows || []).forEach((c: any) => {
        if (c.level === "cliente" && c.client_id) {
          list.push({
            id: c.id,
            clientId: c.client_id,
            fullName: c.full_name,
            level: c.level,
          });
          seenClientIds.add(c.client_id);
        }
      });

      // Também buscar clientes "soltos" (sem contact correspondente)
      const { data: clientRows } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true })
        .limit(500);

      (clientRows || []).forEach((c: any) => {
        if (!seenClientIds.has(c.id)) {
          list.push({
            id: `client-${c.id}`,
            clientId: c.id,
            fullName: c.full_name,
            level: "cliente",
          });
        }
      });

      if (!cancelled) {
        // Ordenar alfabeticamente
        list.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));
        setContacts(list);
        setLoadingContacts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) || null,
    [contacts, contactId],
  );

  // Load quotes for selected client (only finished stages)
  useEffect(() => {
    if (!selectedContact) {
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
        if (error) {
          setQuotes([]);
        } else {
          setQuotes((data || []) as QuoteOption[]);
        }
        setQuoteId("none");
        setLoadingQuotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedContact]);

  // Pre-fill from selected quote
  useEffect(() => {
    if (quoteId === "none") return;
    const q = quotes.find((x) => x.id === quoteId);
    if (!q) return;
    if (q.destination) setDestination(q.destination);
    if (q.travel_date_start) setDepartureDate(q.travel_date_start);
    if (q.travel_date_end) setReturnDate(q.travel_date_end);
  }, [quoteId, quotes]);

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
    const cardId = `manual-ops-${crypto.randomUUID()}`;

    const card: KanbanCardData = {
      id: cardId,
      clientName: selectedContact.fullName,
      destination: destination || undefined,
      travelDate: departureDate
        ? new Date(departureDate).toLocaleDateString("pt-BR")
        : undefined,
      travelDateISO: departureDate || undefined,
      contactLevel: "cliente",
      isManualLead: true,
      stageEnteredAt: new Date().toISOString(),
      agent: responsible
        ? {
            id: responsible.user_id,
            name: responsible.full_name,
            avatarUrl: responsible.avatar_url || undefined,
          }
        : undefined,
      tags: notes
        ? [{ label: "Com observações", tone: "slate" }]
        : undefined,
    };

    onCreated(card, stageId);

    toast.success(`Operação criada em "${OPS_STAGES.find((s) => s.id === stageId)?.title}".`);
    setSubmitting(false);
    onOpenChange(false);
  };

  const isLeadOrProspectAttempt =
    selectedContact && selectedContact.level !== "cliente";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova Operação de Viagem</SheetTitle>
          <SheetDescription>
            Crie um novo card no Kanban de Operações vinculado a um cliente.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingContacts ? "Carregando..." : "Selecione um cliente"}
                />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {contacts.length === 0 && !loadingContacts ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum cliente encontrado.
                  </div>
                ) : (
                  contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
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
            <p className="text-xs text-muted-foreground">
              Apenas contatos com nível "Cliente" são listados.
            </p>
          </div>

          {/* Cotação vinculada */}
          <div className="space-y-1.5">
            <Label>Cotação vinculada</Label>
            <Select
              value={quoteId}
              onValueChange={setQuoteId}
              disabled={!selectedContact || loadingQuotes}
            >
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
              <p className="text-xs text-muted-foreground">
                Este cliente não possui cotações concluídas.
              </p>
            )}
          </div>

          {/* Etapa inicial */}
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

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de embarque</Label>
              <Input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de retorno</Label>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
          </div>

          {/* Destino */}
          <div className="space-y-1.5">
            <Label>Destino</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex.: Paris, França"
            />
          </div>

          {/* Responsável */}
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

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre a operação..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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
      </SheetContent>
    </Sheet>
  );
}
