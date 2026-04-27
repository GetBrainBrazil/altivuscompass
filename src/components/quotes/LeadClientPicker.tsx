import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ChevronsUpDown, Check, Search, UserPlus, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput, formatBrazilPhone, stripBrazilPhone } from "@/components/ui/phone-input";
import { toast } from "sonner";

export type LeadRecord = {
  id: string;
  full_name: string;
  phone: string | null;
  destination: string | null;
  travel_date_start: string | null;
  travel_date_end: string | null;
  flexible_dates: boolean;
  flexible_dates_description: string | null;
  travelers_count: number | null;
  preferences: string | null;
  ai_summary: string | null;
  source: string | null;
};

type ClientOption = { id: string; full_name: string };

type Props = {
  clients: ClientOption[];
  selectedClientId?: string;
  selectedLeadId?: string;
  onSelectClient: (clientId: string) => void;
  onSelectLead: (lead: LeadRecord) => void;
};

export function LeadClientPicker({
  clients,
  selectedClientId,
  selectedLeadId,
  onSelectClient,
  onSelectLead,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-not-converted"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, phone, destination, travel_date_start, travel_date_end, flexible_dates, flexible_dates_description, travelers_count, preferences, ai_summary, source")
        .is("converted_client_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadRecord[];
    },
  });

  // Apenas leads qualificados (com destino + período + nº viajantes) são selecionáveis.
  // Prospects não recebem cotação.
  const qualifiedLeads = useMemo(() => {
    return leads.filter(
      (l) =>
        !!l.destination &&
        (!!l.travel_date_start || !!l.travel_date_end || !!l.flexible_dates) &&
        !!l.travelers_count,
    );
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return qualifiedLeads;
    return qualifiedLeads.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.destination ?? "").toLowerCase().includes(q),
    );
  }, [qualifiedLeads, query]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.full_name.toLowerCase().includes(q));
  }, [clients, query]);

  const selectedLabel = useMemo(() => {
    if (selectedLeadId) {
      const l = leads.find((x) => x.id === selectedLeadId);
      if (l) return { name: l.full_name, type: "lead" as const };
    }
    if (selectedClientId) {
      const c = clients.find((x) => x.id === selectedClientId);
      if (c) return { name: c.full_name, type: "client" as const };
    }
    return null;
  }, [selectedLeadId, selectedClientId, leads, clients]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full h-9 justify-between font-normal text-sm"
          >
            {selectedLabel ? (
              <span className="flex items-center gap-1.5 truncate">
                <Badge
                  variant={selectedLabel.type === "lead" ? "outline" : "secondary"}
                  className={cn(
                    "text-[9px] h-4 px-1.5 shrink-0",
                    selectedLabel.type === "lead" &&
                      "border-amber-500/40 text-amber-700 bg-amber-500/10",
                  )}
                >
                  {selectedLabel.type === "lead" ? "Lead" : "Cliente"}
                </Badge>
                <span className="truncate">{selectedLabel.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Selecionar lead ou cliente</span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              placeholder="Buscar por nome, telefone ou destino..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 border-0 shadow-none focus-visible:ring-0 px-0 text-xs"
              autoFocus
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            {/* CLIENTS — exibidos primeiro */}
            <div className="px-2 pt-1 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Clientes
                <span className="text-muted-foreground/60 font-normal normal-case">
                  ({filteredClients.length})
                </span>
              </span>
            </div>
            {filteredClients.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-2">
                Nenhum cliente encontrado.
              </p>
            ) : (
              filteredClients.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    onSelectClient(c.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                    selectedClientId === c.id && "bg-accent/60",
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      selectedClientId === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate flex-1">{c.full_name}</span>
                  <ContactLevelBadge level="cliente" size="xs" />
                </button>
              ))
            )}

            <div className="my-1 h-px bg-border" />

            {/* LEADS — exibidos em seguida (apenas leads qualificados; prospects ficam de fora) */}
            <div className="px-2 pt-1 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Bot className="h-3 w-3" /> Leads
                <span className="text-muted-foreground/60 font-normal normal-case">
                  ({filteredLeads.length})
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-primary hover:text-primary"
                onClick={() => {
                  setOpen(false);
                  setQuickOpen(true);
                }}
              >
                <UserPlus className="h-3 w-3 mr-1" /> Criar lead rápido
              </Button>
            </div>
            {filteredLeads.length === 0 ? (
              <p className="text-[11px] text-muted-foreground px-3 py-2">
                Nenhum lead qualificado disponível.
              </p>
            ) : (
              filteredLeads.map((lead) => (
                <button
                  type="button"
                  key={lead.id}
                  onClick={() => {
                    onSelectLead(lead);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left flex items-start gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                    selectedLeadId === lead.id && "bg-accent/60",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      selectedLeadId === lead.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{lead.full_name}</span>
                      <ContactLevelBadge level="lead" size="xs" />
                    </div>
                    {lead.phone && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatBrazilPhone(lead.phone)}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <QuickLeadDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onCreated={(lead) => {
          queryClient.invalidateQueries({ queryKey: ["leads-not-converted"] });
          onSelectLead(lead);
        }}
      />
    </>
  );
}

function QuickLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (lead: LeadRecord) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Nome obrigatório");
      const { data, error } = await supabase
        .from("leads")
        .insert({
          full_name: trimmedName,
          phone: phone ? stripBrazilPhone(phone) : null,
          source: "manual",
          status: "new",
        })
        .select("id, full_name, phone, destination, travel_date_start, travel_date_end, flexible_dates, flexible_dates_description, travelers_count, preferences, ai_summary, source")
        .single();
      if (error) throw error;
      return data as LeadRecord;
    },
    onSuccess: (lead) => {
      toast.success("Lead criado com sucesso");
      onCreated(lead);
      setName("");
      setPhone("");
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao criar lead");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar lead rápido</DialogTitle>
          <DialogDescription>
            Cadastre um lead apenas com nome e telefone. Você poderá completar os dados depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Almeida"
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "Criando..." : "Criar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
