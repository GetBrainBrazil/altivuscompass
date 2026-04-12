import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  arrival_airport: string;
  departure_airport: string;
  traveler_type: string;
  trip_style: string;
  wake_time: string;
  sleep_time: string;
  desired_places: string[];
  defined_hotels: string[];
  preferred_hotels: string[];
  quote_id: string;
}

interface Props {
  form: FormData;
  setForm: (f: FormData) => void;
  clients: any[];
  clientOpen: boolean;
  setClientOpen: (v: boolean) => void;
  quotes: any[];
}

export default function ItineraryFormHeader({ form, setForm, quotes }: Props) {
  const [quoteOpen, setQuoteOpen] = useState(false);

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-2">
      {/* Linha 1 */}
      <div>
        <Label className="text-xs">Título *</Label>
        <Input className="h-8 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Roteiro França 2026" />
      </div>
      <div>
        <Label className="text-xs">Aeroporto Chegada</Label>
        <Input className="h-8 text-sm" value={form.arrival_airport} onChange={(e) => setForm({ ...form, arrival_airport: e.target.value })} placeholder="Ex: CDG" />
      </div>
      <div>
        <Label className="text-xs">Data/Hora Chegada</Label>
        <Input className="h-8 text-sm" type="datetime-local" value={form.arrival_datetime} onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })} />
      </div>

      {/* Linha 2 */}
      <div>
        <Label className="text-xs">Cotação</Label>
        <Popover open={quoteOpen} onOpenChange={setQuoteOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-sm">
              {form.quote_id ? quotes.find((q: any) => q.id === form.quote_id)?.title ?? "Selecione..." : "Nenhuma"}
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
                      {q.title || `Cotação ${q.destination || ""}`} {q.clients?.full_name ? `— ${q.clients.full_name}` : ""}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label className="text-xs">Aeroporto Saída</Label>
        <Input className="h-8 text-sm" value={form.departure_airport} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} placeholder="Ex: NCE" />
      </div>
      <div>
        <Label className="text-xs">Data/Hora Saída</Label>
        <Input className="h-8 text-sm" type="datetime-local" value={form.departure_datetime} onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })} />
      </div>

      {/* Descritivo */}
      <div className="col-span-3">
        <Label className="text-xs">Descritivo da Viagem</Label>
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
