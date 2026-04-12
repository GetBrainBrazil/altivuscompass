import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { format } from "date-fns";

function formatQuoteLabel(q: any): string {
  const title = q.title || q.destination || "Sem título";
  const client = q.clients?.full_name ? ` — ${q.clients.full_name}` : "";
  const pb = q.price_breakdown as any;
  const isFlexible = pb?.flexible_dates;
  let period = "";
  if (isFlexible && pb?.flexible_dates_description) {
    period = ` — ${pb.flexible_dates_description}`;
  } else if (q.travel_date_start) {
    period = ` — ${format(new Date(q.travel_date_start), "dd/MM/yyyy")}`;
    if (q.travel_date_end) period += ` a ${format(new Date(q.travel_date_end), "dd/MM/yyyy")}`;
  }
  return `${title}${client}${period}`;
}

interface FormData {
  title: string;
  destination: string;
  traveler_profile: string;
  travel_date_start: string;
  travel_date_end: string;
  main_bases: string;
  base_file: string;
  notes: string;
  client_id: string;
  arrival_datetime: string;
  departure_datetime: string;
  arrival_airport_id: string;
  departure_airport_id: string;
  traveler_type: string;
  trip_style: string;
  wake_time: string;
  sleep_time: string;
  desired_places: string[];
  defined_hotels: string[];
  preferred_hotels: string[];
  quote_id: string;
}

interface Airport {
  id: string;
  iata_code: string;
  name: string;
  city: string;
  state: string | null;
  country: string;
}

interface Props {
  form: FormData;
  setForm: (f: FormData) => void;
  clients: any[];
  clientOpen: boolean;
  setClientOpen: (v: boolean) => void;
  quotes: any[];
  airports: Airport[];
}

function AirportCombobox({ value, onChange, airports, label }: { value: string; onChange: (v: string) => void; airports: Airport[]; label: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = airports.find(a => a.id === value);

  const filtered = search.length > 0
    ? airports.filter(a => {
        const q = search.toLowerCase();
        return a.iata_code.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          (a.state || "").toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q);
      }).slice(0, 50)
    : airports.slice(0, 50);

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-sm">
            {selected ? `${selected.iata_code} — ${selected.name}` : "Selecione..."}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar por código, nome, cidade..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>Nenhum aeroporto encontrado</CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem onSelect={() => { onChange(""); setOpen(false); setSearch(""); }}>
                    <Check className={cn("mr-2 h-3 w-3", !value ? "opacity-100" : "opacity-0")} />
                    Nenhum
                  </CommandItem>
                )}
                {filtered.map(a => (
                  <CommandItem key={a.id} onSelect={() => { onChange(a.id); setOpen(false); setSearch(""); }}>
                    <Check className={cn("mr-2 h-3 w-3", value === a.id ? "opacity-100" : "opacity-0")} />
                    <span className="font-mono font-bold mr-1">{a.iata_code}</span> — {a.name}, {a.city}{a.state ? `, ${a.state}` : ""} ({a.country})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function ItineraryFormHeader({ form, setForm, quotes, airports }: Props) {
  const [quoteOpen, setQuoteOpen] = useState(false);

  return (
    <div className="space-y-2 min-w-0">
      {/* Linha 1: Título | Aeroporto Chegada | Data/Hora Chegada */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <Label className="text-xs">Título *</Label>
          <Input className="h-8 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Roteiro França 2026" />
        </div>
        <AirportCombobox label="Aeroporto Chegada" value={form.arrival_airport_id} onChange={(v) => setForm({ ...form, arrival_airport_id: v })} airports={airports} />
        <div className="w-[175px]">
          <Label className="text-xs">Data/Hora Chegada</Label>
          <Input className="h-8 text-sm" type="datetime-local" value={form.arrival_datetime} onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })} />
        </div>
      </div>

      {/* Linha 2: Cotação | Aeroporto Saída | Data/Hora Saída */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <Label className="text-xs">Cotação</Label>
          <Popover open={quoteOpen} onOpenChange={setQuoteOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-sm truncate">
                {form.quote_id ? formatQuoteLabel(quotes.find((q: any) => q.id === form.quote_id) || {}) : "Nenhuma"}
                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0">
              <Command>
                <CommandInput placeholder="Buscar cotação..." />
                <CommandList>
                  <CommandEmpty>Nenhuma cotação encontrada</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { setForm({ ...form, quote_id: "" }); setQuoteOpen(false); }}>
                      <Check className={cn("mr-2 h-3 w-3", !form.quote_id ? "opacity-100" : "opacity-0")} />
                      Nenhuma
                    </CommandItem>
                    {quotes.map((q: any) => (
                      <CommandItem key={q.id} onSelect={() => { setForm({ ...form, quote_id: q.id }); setQuoteOpen(false); }}>
                        <Check className={cn("mr-2 h-3 w-3", form.quote_id === q.id ? "opacity-100" : "opacity-0")} />
                        {formatQuoteLabel(q)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <AirportCombobox label="Aeroporto Saída" value={form.departure_airport_id} onChange={(v) => setForm({ ...form, departure_airport_id: v })} airports={airports} />
        <div className="w-[175px]">
          <Label className="text-xs">Data/Hora Saída</Label>
          <Input className="h-8 text-sm" type="datetime-local" value={form.departure_datetime} onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })} />
        </div>
      </div>

      {/* Descritivo */}
      <div>
        <Label className="text-xs">Pontos de Interesse</Label>
        <Textarea
          className="text-sm"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={4}
          placeholder="Descreva as cidades que deseja visitar, pontos de interesse em cada cidade, hotéis já reservados ou de preferência, estilo de viagem, perfil dos viajantes, e qualquer outra informação relevante para o roteiro..."
        />
      </div>
    </div>
  );
}
