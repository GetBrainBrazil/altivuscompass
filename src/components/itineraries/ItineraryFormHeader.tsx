import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

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
}

interface Props {
  form: FormData;
  setForm: (f: FormData) => void;
  clients: any[];
  clientOpen: boolean;
  setClientOpen: (v: boolean) => void;
}

const TRAVELER_TYPES = ["Casal", "Família com crianças", "Família sem crianças", "Grupo de amigos", "Solo", "Lua de mel", "Corporativo"];
const TRIP_STYLES = ["Cultural", "Gastronômica", "Aventura/Radical", "Relaxamento", "Badalação/Vida noturna", "Natureza", "Compras", "Misto"];

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    if (input.trim() && !value.includes(input.trim())) {
      onChange([...value, input.trim()]);
      setInput("");
    }
  };
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {value.map((v, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-1">
            {v}
            <X className="h-3 w-3 cursor-pointer" onClick={() => onChange(value.filter((_, idx) => idx !== i))} />
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} className="h-8 text-xs" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={add}><Plus className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

export default function ItineraryFormHeader({ form, setForm, clients, clientOpen, setClientOpen }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
      <div className="col-span-2">
        <Label className="text-xs">Título *</Label>
        <Input className="h-8 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Roteiro África do Sul" />
      </div>
      <div>
        <Label className="text-xs">Destino</Label>
        <Input className="h-8 text-sm" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Ex: África do Sul" />
      </div>
      <div>
        <Label className="text-xs">Cliente</Label>
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-sm">
              {form.client_id ? clients.find((c: any) => c.id === form.client_id)?.full_name ?? "Selecione..." : "Selecione..."}
              <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0">
            <Command>
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => { setForm({ ...form, client_id: "" }); setClientOpen(false); }}>
                    <Check className={cn("mr-2 h-3 w-3", !form.client_id ? "opacity-100" : "opacity-0")} />
                    Nenhum
                  </CommandItem>
                  {clients.map((c: any) => (
                    <CommandItem key={c.id} onSelect={() => { setForm({ ...form, client_id: c.id }); setClientOpen(false); }}>
                      <Check className={cn("mr-2 h-3 w-3", form.client_id === c.id ? "opacity-100" : "opacity-0")} />
                      {c.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label className="text-xs">Tipo de Viajante</Label>
        <Select value={form.traveler_type} onValueChange={(v) => setForm({ ...form, traveler_type: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {TRAVELER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Estilo de Viagem</Label>
        <Select value={form.trip_style} onValueChange={(v) => setForm({ ...form, trip_style: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {TRIP_STYLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Chegada no Destino</Label>
        <Input className="h-8 text-sm" type="datetime-local" value={form.arrival_datetime} onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Saída do Destino</Label>
        <Input className="h-8 text-sm" type="datetime-local" value={form.departure_datetime} onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Aeroporto Chegada</Label>
        <Input className="h-8 text-sm" value={form.arrival_airport} onChange={(e) => setForm({ ...form, arrival_airport: e.target.value })} placeholder="Ex: GRU" />
      </div>
      <div>
        <Label className="text-xs">Aeroporto Saída</Label>
        <Input className="h-8 text-sm" value={form.departure_airport} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} placeholder="Ex: GRU" />
      </div>
      <div>
        <Label className="text-xs">Acordar</Label>
        <Input className="h-8 text-sm" type="time" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Dormir</Label>
        <Input className="h-8 text-sm" type="time" value={form.sleep_time} onChange={(e) => setForm({ ...form, sleep_time: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Bases Principais</Label>
        <Input className="h-8 text-sm" value={form.main_bases} onChange={(e) => setForm({ ...form, main_bases: e.target.value })} placeholder="Ex: Kruger / Stellenbosch" />
      </div>
      <div className="col-span-2 lg:col-span-4">
        <Label className="text-xs">Locais Desejados</Label>
        <TagInput value={form.desired_places} onChange={(v) => setForm({ ...form, desired_places: v })} placeholder="Adicionar local..." />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Hotéis Definidos</Label>
        <TagInput value={form.defined_hotels} onChange={(v) => setForm({ ...form, defined_hotels: v })} placeholder="Adicionar hotel..." />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Hotéis Preferidos (IA)</Label>
        <TagInput value={form.preferred_hotels} onChange={(v) => setForm({ ...form, preferred_hotels: v })} placeholder="Adicionar hotel..." />
      </div>
      <div className="col-span-2 lg:col-span-4">
        <Label className="text-xs">Notas</Label>
        <Textarea className="text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

      <div>
        <Label>Cliente</Label>
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              {form.client_id ? clients.find((c: any) => c.id === form.client_id)?.full_name ?? "Selecione..." : "Selecione..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => { setForm({ ...form, client_id: "" }); setClientOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", !form.client_id ? "opacity-100" : "opacity-0")} />
                    Nenhum
                  </CommandItem>
                  {clients.map((c: any) => (
                    <CommandItem key={c.id} onSelect={() => { setForm({ ...form, client_id: c.id }); setClientOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", form.client_id === c.id ? "opacity-100" : "opacity-0")} />
                      {c.full_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label>Tipo de Viajante</Label>
        <Select value={form.traveler_type} onValueChange={(v) => setForm({ ...form, traveler_type: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {TRAVELER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Estilo de Viagem</Label>
        <Select value={form.trip_style} onValueChange={(v) => setForm({ ...form, trip_style: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {TRIP_STYLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Chegada no Destino</Label>
        <Input type="datetime-local" value={form.arrival_datetime} onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })} />
      </div>
      <div>
        <Label>Saída do Destino</Label>
        <Input type="datetime-local" value={form.departure_datetime} onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })} />
      </div>
      <div>
        <Label>Aeroporto Chegada</Label>
        <Input value={form.arrival_airport} onChange={(e) => setForm({ ...form, arrival_airport: e.target.value })} placeholder="Ex: GRU, JFK" />
      </div>
      <div>
        <Label>Aeroporto Saída</Label>
        <Input value={form.departure_airport} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} placeholder="Ex: GRU, JFK" />
      </div>

      <div>
        <Label>Horário Acordar</Label>
        <Input type="time" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} />
      </div>
      <div>
        <Label>Horário Dormir</Label>
        <Input type="time" value={form.sleep_time} onChange={(e) => setForm({ ...form, sleep_time: e.target.value })} />
      </div>

      <div>
        <Label>Bases Principais</Label>
        <Input value={form.main_bases} onChange={(e) => setForm({ ...form, main_bases: e.target.value })} placeholder="Ex: Kruger / Stellenbosch" />
      </div>

      <div className="lg:col-span-3">
        <Label>Locais Desejados</Label>
        <TagInput value={form.desired_places} onChange={(v) => setForm({ ...form, desired_places: v })} placeholder="Adicionar local..." />
      </div>

      <div className="lg:col-span-3">
        <Label>Hotéis Definidos (já fechados)</Label>
        <TagInput value={form.defined_hotels} onChange={(v) => setForm({ ...form, defined_hotels: v })} placeholder="Adicionar hotel definido..." />
      </div>

      <div className="lg:col-span-3">
        <Label>Hotéis de Preferência (sugestão para IA)</Label>
        <TagInput value={form.preferred_hotels} onChange={(v) => setForm({ ...form, preferred_hotels: v })} placeholder="Adicionar hotel preferido..." />
      </div>

      <div className="lg:col-span-3">
        <Label>Notas</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
      </div>
    </div>
  );
}
