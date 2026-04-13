import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import ItineraryFormHeader from "./ItineraryFormHeader";
import ItineraryAIPanel from "./ItineraryAIPanel";
import ItineraryChatPanel from "./ItineraryChatPanel";
import ItineraryTimeline from "./ItineraryTimeline";
import ItineraryMapView from "./ItineraryMapView";
import ItineraryDaysTab from "./ItineraryDaysTab";
import ItineraryHotelsTab from "./ItineraryHotelsTab";
import ItineraryRestaurantsTab from "./ItineraryRestaurantsTab";
import ItineraryActivitiesTab from "./ItineraryActivitiesTab";
import { useFormPersistence } from "@/hooks/useFormPersistence";

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
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string>("none");
  const [summary, setSummary] = useState<string>("");

  const [form, setForm] = useState({
    title: "", destination: "", traveler_profile: "", travel_date_start: "", travel_date_end: "",
    main_bases: "", base_file: "", notes: "", client_id: "",
    arrival_datetime: "", departure_datetime: "", arrival_airport_id: "", departure_airport_id: "",
    traveler_type: "", trip_style: "", wake_time: "08:00", sleep_time: "22:00",
    desired_places: [] as string[], defined_hotels: [] as string[], preferred_hotels: [] as string[],
    quote_id: "",
  });

  const [publicEditable, setPublicEditable] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);

  const persistenceKey = `itinerary-${currentId || "new"}`;
  const setFormCallback = useCallback((data: typeof form) => setForm(data), []);
  const { clearPersistence } = useFormPersistence(persistenceKey, form, setFormCallback);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").order("full_name");
      return data || [];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-list"],
    queryFn: async () => {
      const { data } = await supabase.from("quotes").select("id, title, destination, travel_date_start, travel_date_end, price_breakdown, clients(full_name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: airports = [] } = useQuery({
    queryKey: ["airports-list"],
    queryFn: async () => {
      const { data } = await supabase.from("airports").select("id, iata_code, name, city, state, country").order("iata_code");
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
        arrival_airport_id: itinerary.arrival_airport_id || "",
        departure_airport_id: itinerary.departure_airport_id || "",
        traveler_type: itinerary.traveler_type || "",
        trip_style: itinerary.trip_style || "",
        wake_time: itinerary.wake_time || "08:00",
        sleep_time: itinerary.sleep_time || "22:00",
        desired_places: itinerary.desired_places || [],
        defined_hotels: itinerary.defined_hotels || [],
        preferred_hotels: itinerary.preferred_hotels || [],
        quote_id: itinerary.quote_id || "",
      });
      setAiStatus(itinerary.ai_status || "none");
      setSummary(itinerary.summary || "");
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
        arrival_airport_id: form.arrival_airport_id || null,
        departure_airport_id: form.departure_airport_id || null,
        traveler_type: form.traveler_type || null,
        trip_style: form.trip_style || null,
        wake_time: form.wake_time || null,
        sleep_time: form.sleep_time || null,
        desired_places: form.desired_places,
        defined_hotels: form.defined_hotels,
        preferred_hotels: form.preferred_hotels,
        quote_id: form.quote_id || null,
        public_editable: publicEditable,
        summary: summary || null,
      };

      if (currentId) {
        const { error } = await supabase.from("itineraries").update(payload).eq("id", currentId);
        if (error) throw error;
        toast({ title: "Roteiro atualizado" });
        clearPersistence();
      } else {
        const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        payload.public_token = token;
        const { data, error } = await supabase.from("itineraries").insert(payload).select().single();
        if (error) throw error;
        setCurrentId(data.id);
        setPublicToken(token);
        toast({ title: "Roteiro criado! Use a IA para gerar o fluxo diário." });
        clearPersistence();
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
    <div className="space-y-4">
      <ItineraryFormHeader form={form} setForm={setForm} clients={clients} clientOpen={clientOpen} setClientOpen={setClientOpen} quotes={quotes} airports={airports} />

      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : currentId ? "Salvar Alterações" : "Criar Roteiro"}</Button>
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1">
              <Trash2 className="h-3 w-3" /> Excluir
            </Button>
          )}
        </div>

        {currentId && publicUrl && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Switch checked={publicEditable} onCheckedChange={togglePublic} />
              <Label className="text-xs">Cliente edita</Label>
            </div>
            <Button variant="outline" size="sm" onClick={copyPublicUrl} className="gap-1 h-7 text-xs">
              <Copy className="h-3 w-3" /> Link
            </Button>
            <Button variant="ghost" size="sm" className="h-7" asChild>
              <a href={publicUrl} target="_blank" rel="noopener"><ExternalLink className="h-3 w-3" /></a>
            </Button>
          </div>
        )}
      </div>

      {currentId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ItineraryAIPanel itineraryId={currentId} aiStatus={aiStatus} onStatusChange={setAiStatus} onBeforeGenerate={handleSave} />
            <ItineraryChatPanel itineraryId={currentId} />
          </div>

           <Tabs defaultValue="timeline" className="mt-2">
            <TabsList className="h-8">
              <TabsTrigger value="timeline" className="text-xs px-2 py-1">📋 Roteiro + Mapa</TabsTrigger>
              <TabsTrigger value="days" className="text-xs px-2 py-1">📅 Dias</TabsTrigger>
              <TabsTrigger value="hotels" className="text-xs px-2 py-1">🏨 Hotéis</TabsTrigger>
              <TabsTrigger value="restaurants" className="text-xs px-2 py-1">🍽️ Restaurantes</TabsTrigger>
              <TabsTrigger value="activities" className="text-xs px-2 py-1">🎯 Passeios</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline">
              <div className="flex gap-3 min-h-[400px]">
                <div className="w-1/2 overflow-y-auto max-h-[500px] pr-2">
                  <ItineraryTimeline
                    itineraryId={currentId}
                    selectedDayId={selectedDayId}
                    onSelectDay={setSelectedDayId}
                    selectedActivityId={selectedActivityId}
                    onSelectActivity={setSelectedActivityId}
                    summary={summary}
                    onSummaryChange={setSummary}
                  />
                </div>
                <div className="w-1/2">
                  <ItineraryMapView
                    itineraryId={currentId}
                    selectedDayId={selectedDayId}
                    selectedActivityId={selectedActivityId}
                    onSelectActivity={setSelectedActivityId}
                    height="h-[500px]"
                  />
                </div>
              </div>
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
