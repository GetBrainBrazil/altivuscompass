import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ItineraryTimeline from "@/components/itineraries/ItineraryTimeline";
import ItineraryMapView from "@/components/itineraries/ItineraryMapView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, Calendar, Users, Plane } from "lucide-react";

export default function PublicItinerary() {
  const { token } = useParams<{ token: string }>();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const { data: itinerary, isLoading, error } = useQuery({
    queryKey: ["public-itinerary", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itineraries")
        .select("*, clients(full_name), arrival_airport:airports!itineraries_arrival_airport_id_fkey(iata_code, name, city), departure_airport:airports!itineraries_departure_airport_id_fkey(iata_code, name, city)")
        .eq("public_token", token)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando roteiro...</p>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Roteiro não encontrado</h1>
          <p className="text-muted-foreground mt-2">Este link pode estar expirado ou inválido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm opacity-80 mb-1">Roteiro de Viagem · Altivus Turismo</p>
          <h1 className="text-3xl font-bold">{itinerary.title}</h1>
          <div className="flex flex-wrap gap-4 mt-4 text-sm opacity-90">
            {itinerary.destination && (
              <div className="flex items-center gap-1"><MapPin className="h-4 w-4" />{itinerary.destination}</div>
            )}
            {itinerary.travel_date_start && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(itinerary.travel_date_start + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                {itinerary.travel_date_end && ` a ${format(new Date(itinerary.travel_date_end + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`}
              </div>
            )}
            {itinerary.traveler_type && (
              <div className="flex items-center gap-1"><Users className="h-4 w-4" />{itinerary.traveler_type}</div>
            )}
            {itinerary.arrival_airport && (
              <div className="flex items-center gap-1"><Plane className="h-4 w-4" />{(itinerary.arrival_airport as any).iata_code} — {(itinerary.arrival_airport as any).city}</div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">📋 Roteiro</TabsTrigger>
            <TabsTrigger value="map">🗺️ Mapa</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <ItineraryTimeline
              itineraryId={itinerary.id}
              selectedDayId={selectedDayId}
              onSelectDay={setSelectedDayId}
              readOnly={!itinerary.public_editable}
            />
          </TabsContent>
          <TabsContent value="map">
            <ItineraryMapView itineraryId={itinerary.id} selectedDayId={selectedDayId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
