import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ItineraryDaysTab from "./ItineraryDaysTab";
import ItineraryHotelsTab from "./ItineraryHotelsTab";
import ItineraryRestaurantsTab from "./ItineraryRestaurantsTab";
import ItineraryActivitiesTab from "./ItineraryActivitiesTab";

interface Props {
  itineraryId: string | null;
  onClose: () => void;
}

export default function ItineraryForm({ itineraryId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(itineraryId);
  const [clientOpen, setClientOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    destination: "",
    traveler_profile: "",
    travel_date_start: "",
    travel_date_end: "",
    main_bases: "",
    base_file: "",
    notes: "",
    client_id: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").order("full_name");
      return data || [];
    },
  });

  const { data: itinerary } = useQuery({
    queryKey: ["itinerary", currentId],
    queryFn: async () => {
      if (!currentId) return null;
      const { data, error } = await supabase.from("itineraries").select("*").eq("id", currentId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentId,
  });

  useEffect(() => {
    if (itinerary) {
      setForm({
        title: itinerary.title || "",
        destination: itinerary.destination || "",
        traveler_profile: itinerary.traveler_profile || "",
        travel_date_start: itinerary.travel_date_start || "",
        travel_date_end: itinerary.travel_date_end || "",
        main_bases: itinerary.main_bases || "",
        base_file: itinerary.base_file || "",
        notes: itinerary.notes || "",
        client_id: itinerary.client_id || "",
      });
    }
  }, [itinerary]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        destination: form.destination || null,
        traveler_profile: form.traveler_profile || null,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        main_bases: form.main_bases || null,
        base_file: form.base_file || null,
        notes: form.notes || null,
        client_id: form.client_id || null,
      };

      if (currentId) {
        const { error } = await supabase.from("itineraries").update(payload).eq("id", currentId);
        if (error) throw error;
        toast({ title: "Roteiro atualizado" });
      } else {
        const { data, error } = await supabase.from("itineraries").insert(payload).select().single();
        if (error) throw error;
        setCurrentId(data.id);
        toast({ title: "Roteiro criado! Agora adicione os detalhes nas abas abaixo." });
      }
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Label>Título *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Roteiro África do Sul" />
        </div>
        <div>
          <Label>Destino</Label>
          <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Ex: África do Sul" />
        </div>

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
          <Label>Perfil do Viajante</Label>
          <Input value={form.traveler_profile} onChange={(e) => setForm({ ...form, traveler_profile: e.target.value })} placeholder="Ex: 1 casal + 1 adulto" />
        </div>
        <div>
          <Label>Bases Principais</Label>
          <Input value={form.main_bases} onChange={(e) => setForm({ ...form, main_bases: e.target.value })} placeholder="Ex: Kruger / Stellenbosch" />
        </div>

        <div>
          <Label>Data Início</Label>
          <Input type="date" value={form.travel_date_start} onChange={(e) => setForm({ ...form, travel_date_start: e.target.value })} />
        </div>
        <div>
          <Label>Data Fim</Label>
          <Input type="date" value={form.travel_date_end} onChange={(e) => setForm({ ...form, travel_date_end: e.target.value })} />
        </div>
        <div>
          <Label>Arquivo Base</Label>
          <Input value={form.base_file} onChange={(e) => setForm({ ...form, base_file: e.target.value })} placeholder="Nome do arquivo de referência" />
        </div>

        <div className="lg:col-span-3">
          <Label>Notas</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : currentId ? "Salvar Alterações" : "Criar Roteiro"}</Button>
      </div>

      {/* Detail tabs only shown after saving */}
      {currentId && (
        <Tabs defaultValue="days" className="mt-4">
          <TabsList>
            <TabsTrigger value="days">Fluxo Diário</TabsTrigger>
            <TabsTrigger value="hotels">Hotéis</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurantes</TabsTrigger>
            <TabsTrigger value="activities">Passeios</TabsTrigger>
          </TabsList>
          <TabsContent value="days"><ItineraryDaysTab itineraryId={currentId} /></TabsContent>
          <TabsContent value="hotels"><ItineraryHotelsTab itineraryId={currentId} /></TabsContent>
          <TabsContent value="restaurants"><ItineraryRestaurantsTab itineraryId={currentId} /></TabsContent>
          <TabsContent value="activities"><ItineraryActivitiesTab itineraryId={currentId} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
