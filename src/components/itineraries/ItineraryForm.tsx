import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink } from "lucide-react";
import ItineraryFormHeader from "./ItineraryFormHeader";
import ItineraryAIPanel from "./ItineraryAIPanel";
import ItineraryTimeline from "./ItineraryTimeline";
import ItineraryMapView from "./ItineraryMapView";
import ItineraryDaysTab from "./ItineraryDaysTab";
import ItineraryHotelsTab from "./ItineraryHotelsTab";
import ItineraryRestaurantsTab from "./ItineraryRestaurantsTab";
import ItineraryActivitiesTab from "./ItineraryActivitiesTab";

interface Props {
  itineraryId: string | null;
  onClose: () => void;
  onDelete?: () => void;
}

export default function ItineraryForm({ itineraryId, onClose, onDelete }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(itineraryId);
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string>("none");

  const [form, setForm] = useState({
    title: "", destination: "", traveler_profile: "", travel_date_start: "", travel_date_end: "",
    main_bases: "", base_file: "", notes: "", client_id: "",
    arrival_datetime: "", departure_datetime: "", arrival_airport: "", departure_airport: "",
    traveler_type: "", trip_style: "", wake_time: "08:00", sleep_time: "22:00",
    desired_places: [] as string[], defined_hotels: [] as string[], preferred_hotels: [] as string[],
  });

  const [publicEditable, setPublicEditable] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);

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
        arrival_datetime: itinerary.arrival_datetime ? new Date(itinerary.arrival_datetime).toISOString().slice(0, 16) : "",
        departure_datetime: itinerary.departure_datetime ? new Date(itinerary.departure_datetime).toISOString().slice(0, 16) : "",
        arrival_airport: itinerary.arrival_airport || "",
        departure_airport: itinerary.departure_airport || "",
        traveler_type: itinerary.traveler_type || "",
        trip_style: itinerary.trip_style || "",
        wake_time: itinerary.wake_time || "08:00",
        sleep_time: itinerary.sleep_time || "22:00",
        desired_places: itinerary.desired_places || [],
        defined_hotels: itinerary.defined_hotels || [],
        preferred_hotels: itinerary.preferred_hotels || [],
      });
      setAiStatus(itinerary.ai_status || "none");
      setPublicEditable(itinerary.public_editable || false);
      setPublicToken(itinerary.public_token || null);
    }
  }, [itinerary]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        destination: form.destination || null,
        traveler_profile: form.traveler_profile || null,
        travel_date_start: form.travel_date_start || null,
        travel_date_end: form.travel_date_end || null,
        main_bases: form.main_bases || null,
        base_file: form.base_file || null,
        notes: form.notes || null,
        client_id: form.client_id || null,
        arrival_datetime: form.arrival_datetime || null,
        departure_datetime: form.departure_datetime || null,
        arrival_airport: form.arrival_airport || null,
        departure_airport: form.departure_airport || null,
        traveler_type: form.traveler_type || null,
        trip_style: form.trip_style || null,
        wake_time: form.wake_time || null,
        sleep_time: form.sleep_time || null,
        desired_places: form.desired_places,
        defined_hotels: form.defined_hotels,
        preferred_hotels: form.preferred_hotels,
        public_editable: publicEditable,
      };

      if (currentId) {
        const { error } = await supabase.from("itineraries").update(payload).eq("id", currentId);
        if (error) throw error;
        toast({ title: "Roteiro atualizado" });
      } else {
        const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        payload.public_token = token;
        const { data, error } = await supabase.from("itineraries").insert(payload).select().single();
        if (error) throw error;
        setCurrentId(data.id);
        setPublicToken(token);
        toast({ title: "Roteiro criado! Use a IA para gerar o fluxo diário." });
      }
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      queryClient.invalidateQueries({ queryKey: ["itinerary", currentId] });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async () => {
    if (!currentId) return;
    const newVal = !publicEditable;
    setPublicEditable(newVal);
    await supabase.from("itineraries").update({ public_editable: newVal }).eq("id", currentId);
    toast({ title: newVal ? "Edição pública habilitada" : "Edição pública desabilitada" });
  };

  const publicUrl = publicToken ? `${window.location.origin}/roteiro/${publicToken}` : null;

  const copyPublicUrl = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado!" });
    }
  };

  return (
    <div className="space-y-6">
      <ItineraryFormHeader form={form} setForm={setForm} clients={clients} clientOpen={clientOpen} setClientOpen={setClientOpen} />

      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : currentId ? "Salvar Alterações" : "Criar Roteiro"}</Button>
        </div>

        {currentId && publicUrl && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={publicEditable} onCheckedChange={togglePublic} />
              <Label className="text-xs">Cliente pode editar</Label>
            </div>
            <Button variant="outline" size="sm" onClick={copyPublicUrl} className="gap-1">
              <Copy className="h-3 w-3" /> Link Público
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener"><ExternalLink className="h-3 w-3" /></a>
            </Button>
          </div>
        )}
      </div>

      {currentId && (
        <>
          <ItineraryAIPanel itineraryId={currentId} aiStatus={aiStatus} onStatusChange={setAiStatus} />

          <Tabs defaultValue="timeline" className="mt-4">
            <TabsList>
              <TabsTrigger value="timeline">📋 Roteiro Visual</TabsTrigger>
              <TabsTrigger value="map">🗺️ Mapa</TabsTrigger>
              <TabsTrigger value="days">📅 Fluxo Diário</TabsTrigger>
              <TabsTrigger value="hotels">🏨 Hotéis</TabsTrigger>
              <TabsTrigger value="restaurants">🍽️ Restaurantes</TabsTrigger>
              <TabsTrigger value="activities">🎯 Passeios</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline">
              <ItineraryTimeline itineraryId={currentId} selectedDayId={selectedDayId} onSelectDay={setSelectedDayId} />
            </TabsContent>
            <TabsContent value="map">
              <ItineraryMapView itineraryId={currentId} selectedDayId={selectedDayId} />
              {!selectedDayId && <p className="text-xs text-muted-foreground mt-2 text-center">Selecione um dia na aba "Roteiro Visual" para ver no mapa.</p>}
            </TabsContent>
            <TabsContent value="days"><ItineraryDaysTab itineraryId={currentId} /></TabsContent>
            <TabsContent value="hotels"><ItineraryHotelsTab itineraryId={currentId} /></TabsContent>
            <TabsContent value="restaurants"><ItineraryRestaurantsTab itineraryId={currentId} /></TabsContent>
            <TabsContent value="activities"><ItineraryActivitiesTab itineraryId={currentId} /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
