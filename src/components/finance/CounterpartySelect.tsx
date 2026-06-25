import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CounterpartyKind = "client" | "supplier" | "party";

export type CounterpartyValue = {
  kind: CounterpartyKind | null;
  id: string | null; // null para "party" (texto livre vindo de financial_parties.name)
  name: string | null;
};

export const EMPTY_COUNTERPARTY: CounterpartyValue = { kind: null, id: null, name: null };

type Props = {
  value: CounterpartyValue;
  onChange: (v: CounterpartyValue) => void;
  /** Tipo "natural" do contexto — vai aparecer primeiro na lista. */
  preferred?: CounterpartyKind;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const kindLabel: Record<CounterpartyKind, string> = {
  client: "Cliente",
  supplier: "Fornecedor",
  party: "Outro",
};

const kindCls: Record<CounterpartyKind, string> = {
  client: "bg-soft-blue/15 text-soft-blue border-soft-blue/30",
  supplier: "bg-gold/15 text-gold border-gold/30",
  party: "bg-muted text-muted-foreground border-border",
};

export function CounterpartyTypeBadge({ kind, className }: { kind: CounterpartyKind | null; className?: string }) {
  const k = kind ?? "party";
  return (
    <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5 h-4", kindCls[k], className)}>
      {kindLabel[k]}
    </Badge>
  );
}

export default function CounterpartySelect({
  value, onChange, preferred, placeholder = "Selecione...", disabled, className,
}: Props) {
  const [open, setOpen] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["counterparty-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients").select("id, full_name").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["counterparty-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers").select("id, name, trade_name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: parties = [] } = useQuery({
    queryKey: ["counterparty-parties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_parties").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const groups = useMemo(() => {
    const clientGrp = {
      kind: "client" as const,
      heading: "Clientes",
      items: clients.map((c: any) => ({ id: c.id, name: c.full_name as string })),
    };
    const supplierGrp = {
      kind: "supplier" as const,
      heading: "Fornecedores",
      items: suppliers.map((s: any) => ({
        id: s.id,
        name: (s.trade_name ? `${s.name} (${s.trade_name})` : s.name) as string,
        rawName: (s.trade_name || s.name) as string,
      })),
    };
    const partyGrp = {
      kind: "party" as const,
      heading: "Outras partes",
      items: parties.map((p: any) => ({ id: p.id, name: p.name as string })),
    };
    const order: Array<typeof clientGrp | typeof supplierGrp | typeof partyGrp> =
      preferred === "supplier"
        ? [supplierGrp, clientGrp, partyGrp]
        : preferred === "party"
        ? [partyGrp, clientGrp, supplierGrp]
        : [clientGrp, supplierGrp, partyGrp];
    return order;
  }, [clients, suppliers, parties, preferred]);

  const select = (kind: CounterpartyKind, id: string | null, name: string) => {
    onChange({ kind, id, name });
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(EMPTY_COUNTERPARTY);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 min-w-0">
            {value.name ? (
              <>
                <span className="truncate">{value.name}</span>
                <CounterpartyTypeBadge kind={value.kind} />
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value.name && (
              <span
                role="button"
                onClick={clear}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                aria-label="Limpar"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente, fornecedor ou outra parte..." />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum resultado.</CommandEmpty>

            <CommandGroup heading="Cadastrar novo">
              <CommandItem
                value="__new_client"
                onSelect={() => { window.open("/clients", "_blank"); }}
                className="text-primary"
              >
                <Plus className="h-3.5 w-3.5 mr-2" /> Novo cliente
              </CommandItem>
              <CommandItem
                value="__new_supplier"
                onSelect={() => { window.open("/registrations?tab=suppliers", "_blank"); }}
                className="text-primary"
              >
                <Plus className="h-3.5 w-3.5 mr-2" /> Novo fornecedor
              </CommandItem>
            </CommandGroup>

            {groups.map((g, idx) => (
              g.items.length > 0 && (
                <div key={g.kind}>
                  <CommandSeparator />
                  <CommandGroup heading={g.heading}>
                    {g.items.map((item: any) => {
                      const displayName = item.name;
                      const selectedHere = value.kind === g.kind && value.id === item.id;
                      return (
                        <CommandItem
                          key={`${g.kind}-${item.id}`}
                          value={`${g.heading} ${displayName}`}
                          onSelect={() => select(
                            g.kind,
                            item.id,
                            g.kind === "supplier" ? (item.rawName ?? displayName) : displayName,
                          )}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedHere ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{displayName}</span>
                          <CounterpartyTypeBadge kind={g.kind} className="ml-2" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              )
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
