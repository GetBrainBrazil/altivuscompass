import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export default function ItineraryFormHeader({ form, setForm }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
      <div className="col-span-2">
        <Label className="text-xs">Título *</Label>
        <Input className="h-8 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Roteiro França 2026" />
      </div>
      <div>
        <Label className="text-xs">Aeroporto Destino</Label>
        <Input className="h-8 text-sm" value={form.arrival_airport} onChange={(e) => setForm({ ...form, arrival_airport: e.target.value })} placeholder="Ex: CDG" />
      </div>
      <div>
        <Label className="text-xs">Chegada no Destino</Label>
        <Input className="h-8 text-sm" type="datetime-local" value={form.arrival_datetime} onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Aeroporto Saída</Label>
        <Input className="h-8 text-sm" value={form.departure_airport} onChange={(e) => setForm({ ...form, departure_airport: e.target.value })} placeholder="Ex: NCE" />
      </div>
      <div>
        <Label className="text-xs">Saída do Destino</Label>
        <Input className="h-8 text-sm" type="datetime-local" value={form.departure_datetime} onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Acordar</Label>
        <Input className="h-8 text-sm" type="time" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Dormir</Label>
        <Input className="h-8 text-sm" type="time" value={form.sleep_time} onChange={(e) => setForm({ ...form, sleep_time: e.target.value })} />
      </div>
      <div className="col-span-2 lg:col-span-4">
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
