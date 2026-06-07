import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ContactLevelBadge } from "@/components/contacts/ContactLevelBadge";
import { formatCpfCnpj } from "@/lib/validators";
import { User, Plane, Loader2 } from "lucide-react";

export type ClientSuggestion = {
  id: string;
  full_name: string;
  cpf_cnpj: string | null;
  phone: string | null;
  email: string | null;
};

export type PassengerSuggestion = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  client_id: string | null;
  client: { id: string; full_name: string } | null;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPickClient: (clientId: string, fullName: string) => void;
  onPickPassengerLinked: (clientId: string, clientName: string) => void;
  onPickPassengerFree: (p: PassengerSuggestion) => void;
  inputClassName?: string;
  required?: boolean;
};

export function ClientNameSuggest({
  value,
  onChange,
  onPickClient,
  onPickPassengerLinked,
  onPickPassengerFree,
  inputClassName,
  required,
}: Props) {
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(t);
  }, [value]);

  const { data, isFetching } = useQuery({
    queryKey: ["client-name-suggest", debounced],
    enabled: debounced.length >= 3,
    staleTime: 30_000,
    queryFn: async () => {
      const pattern = `%${debounced}%`;
      const [clientsRes, passengersRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, cpf_cnpj, phone, email")
          .ilike("full_name", pattern)
          .order("full_name")
          .limit(5),
        supabase
          .from("passengers")
          .select(
            "id, full_name, cpf, birth_date, nationality, passport_number, passport_expiry, client_id, client:clients!passengers_client_id_fkey(id, full_name)",
          )
          .ilike("full_name", pattern)
          .order("full_name")
          .limit(5),
      ]);
      const clients = (clientsRes.data ?? []) as ClientSuggestion[];
      const passengers = (passengersRes.data ?? []) as unknown as PassengerSuggestion[];
      // Hide passenger rows whose client_id is already present in clients results
      // and whose full_name matches that client — they'd be redundant.
      const clientIds = new Set(clients.map((c) => c.id));
      const filteredPassengers = passengers.filter(
        (p) => !p.client_id || !clientIds.has(p.client_id),
      );
      return { clients, passengers: filteredPassengers };
    },
  });

  const clients = data?.clients ?? [];
  const passengers = data?.passengers ?? [];
  const hasResults = clients.length > 0 || passengers.length > 0;
  const shouldOpen = focused && debounced.length >= 3 && (isFetching || hasResults);

  useEffect(() => {
    setOpen(shouldOpen);
  }, [shouldOpen]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so click on a suggestion can fire first
            setTimeout(() => setFocused(false), 150);
          }}
          required={required}
          className={inputClassName}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-[340px] overflow-y-auto py-1">
          {isFetching && !hasResults && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
            </div>
          )}

          {clients.length > 0 && (
            <>
              <div className="px-3 pt-1.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Clientes existentes
                  <span className="text-muted-foreground/60 font-normal normal-case">
                    ({clients.length})
                  </span>
                </span>
              </div>
              {clients.map((c) => (
                <button
                  type="button"
                  key={`c-${c.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPickClient(c.id, c.full_name);
                  }}
                  className="w-full text-left flex items-start gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-xs truncate">{c.full_name}</span>
                      <ContactLevelBadge level="cliente" size="xs" />
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {[c.cpf_cnpj ? `CPF ${formatCpfCnpj(c.cpf_cnpj)}` : null, c.phone, c.email]
                        .filter(Boolean)
                        .join(" • ") || "Sem dados de contato"}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {passengers.length > 0 && (
            <>
              {clients.length > 0 && <div className="my-1 h-px bg-border" />}
              <div className="px-3 pt-1.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Plane className="h-3 w-3" /> Viajantes
                  <span className="text-muted-foreground/60 font-normal normal-case">
                    ({passengers.length})
                  </span>
                </span>
              </div>
              {passengers.map((p) => {
                const linked = p.client_id && p.client;
                return (
                  <button
                    type="button"
                    key={`p-${p.id}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (linked) {
                        onPickPassengerLinked(p.client!.id, p.client!.full_name);
                      } else {
                        onPickPassengerFree(p);
                      }
                    }}
                    className="w-full text-left flex items-start gap-2 px-3 py-1.5 hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-xs truncate">{p.full_name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-soft-blue/40 text-soft-blue bg-soft-blue/10">
                          Viajante
                        </Badge>
                        {linked && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            de {p.client!.full_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {[
                          p.cpf ? `CPF ${formatCpfCnpj(p.cpf)}` : null,
                          p.passport_number ? `Passaporte ${p.passport_number}` : null,
                          p.nationality,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "Sem documentos"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {!isFetching && !hasResults && debounced.length >= 3 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Nenhum cliente ou viajante encontrado com este nome.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
