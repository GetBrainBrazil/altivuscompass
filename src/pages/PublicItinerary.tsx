import { useState } from "react";
import { useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ItineraryTimeline from "@/components/itineraries/ItineraryTimeline";
import ItineraryMapView from "@/components/itineraries/ItineraryMapView";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Plane, Map as MapIcon, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicItinerary() {
  const { token } = useParams<{ token: string }>();
  const isMobile = useIsMobile();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [mobileMapVisible, setMobileMapVisible] = useState(true);

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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-4 px-6 shrink-0">
        <div className="max-w-full mx-auto">
          <p className="text-xs opacity-80 mb-0.5">Roteiro de Viagem · Altivus Turismo</p>
          <h1 className="text-xl font-bold">{itinerary.title}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-xs opacity-90">
            {itinerary.travel_date_start && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(itinerary.travel_date_start + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                {itinerary.travel_date_end && ` a ${format(new Date(itinerary.travel_date_end + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`}
              </div>
            )}
            {itinerary.arrival_airport && (
              <div className="flex items-center gap-1"><Plane className="h-3 w-3" />{(itinerary.arrival_airport as any).iata_code} — {(itinerary.arrival_airport as any).city}</div>
            )}
          </div>
        </div>
      </div>

      {/* Split content */}
      <div className={`flex-1 flex min-h-0 ${isMobile ? "flex-col" : "flex-row"}`}>
        {/* Timeline */}
        <div className={`overflow-y-auto p-4 ${isMobile ? "flex-1 border-b" : "w-1/2 border-r"}`}>
          <ItineraryTimeline
            itineraryId={itinerary.id}
            selectedDayId={selectedDayId}
            onSelectDay={setSelectedDayId}
            readOnly={!itinerary.public_editable}
            selectedActivityId={selectedActivityId}
            onSelectActivity={setSelectedActivityId}
            summary={itinerary.summary}
          />
        </div>

        {/* Map */}
        {(!isMobile || mobileMapVisible) && (
          <div className={isMobile ? "h-[45vh] shrink-0 relative" : "w-1/2"}>
            {isMobile && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMobileMapVisible(false)}
                className="absolute bottom-2 left-2 z-10 h-8 px-2 shadow-md"
              >
                <EyeOff className="h-3.5 w-3.5 mr-1" /> Ocultar mapa
              </Button>
            )}
            <ItineraryMapView
              itineraryId={itinerary.id}
              selectedDayId={selectedDayId}
              selectedActivityId={selectedActivityId}
              onSelectActivity={setSelectedActivityId}
              height="h-full"
            />
          </div>
        )}

        {/* Floating button to show map again on mobile */}
        {isMobile && !mobileMapVisible && (
          <Button
            onClick={() => setMobileMapVisible(true)}
            className="fixed bottom-4 right-4 z-20 shadow-lg rounded-full h-12 px-4"
          >
            <MapIcon className="h-4 w-4 mr-2" /> Mostrar mapa
          </Button>
        )}
      </div>
    </div>
  );
}
