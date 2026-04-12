import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MapPin, Clock, Car, Train, Ship, Plane, Footprints, Bus, Pencil, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useRef, useState, useCallback } from "react";
import ActivityEditDialog from "./ActivityEditDialog";

interface Props {
  itineraryId: string;
  selectedDayId: string | null;
  onSelectDay: (id: string | null) => void;
  readOnly?: boolean;
  selectedActivityId?: string | null;
  onSelectActivity?: (id: string | null) => void;
  summary?: string | null;
  onSummaryChange?: (summary: string) => void;
}

const TRANSPORT_ICONS: Record<string, any> = {
  uber: Car, taxi: Car, transfer: Car, trem: Train, metro: Train,
  barco: Ship, aviao: Plane, a_pe: Footprints, onibus: Bus,
};

const TRANSPORT_LABELS: Record<string, string> = {
  uber: "Uber", taxi: "Táxi", transfer: "Transfer", trem: "Trem", metro: "Metrô",
  barco: "Barco", aviao: "Avião", a_pe: "A pé", onibus: "Ônibus",
};

const TYPE_COLORS: Record<string, string> = {
  attraction: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  hotel: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  transport_hub: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  shopping: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  entertainment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  nature: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cultural: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

const TYPE_LABELS: Record<string, string> = {
  attraction: "Atração", restaurant: "Restaurante", hotel: "Hotel",
  transport_hub: "Transporte", shopping: "Compras", entertainment: "Entretenimento",
  nature: "Natureza", cultural: "Cultural",
};

export default function ItineraryTimeline({ itineraryId, selectedDayId, onSelectDay, readOnly, selectedActivityId, onSelectActivity, summary, onSummaryChange }: Props) {
  const queryClient = useQueryClient();
  const activityRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [activityPhotos, setActivityPhotos] = useState<Record<string, string>>({});
  const placesServiceRef = useRef<any>(null);
  const photoCacheRef = useRef<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: days = [] } = useQuery({
    queryKey: ["itinerary-days", itineraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_days")
        .select("*")
        .eq("itinerary_id", itineraryId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["itinerary-day-activities", selectedDayId],
    queryFn: async () => {
      if (!selectedDayId) return [];
      const { data, error } = await supabase
        .from("itinerary_day_activities")
        .select("*")
        .eq("itinerary_day_id", selectedDayId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDayId,
  });

  useEffect(() => {
    if (!selectedDayId && days.length > 0) {
      onSelectDay(days[0].id);
    }
  }, [days, selectedDayId, onSelectDay]);

  useEffect(() => {
    if (selectedActivityId && activityRefs.current[selectedActivityId]) {
      activityRefs.current[selectedActivityId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedActivityId]);

  // Fetch photos for hotel/attraction/restaurant activities
  const PHOTO_TYPES = ["hotel", "attraction", "restaurant", "cultural", "nature", "entertainment", "shopping"];
  useEffect(() => {
    const eligible = activities.filter((a: any) => PHOTO_TYPES.includes(a.activity_type) && a.activity_name);
    const uncached = eligible.filter((a: any) => !photoCacheRef.current[a.activity_name]);
    if (uncached.length === 0) {
      const photos: Record<string, string> = {};
      eligible.forEach((a: any) => { if (photoCacheRef.current[a.activity_name]) photos[a.activity_name] = photoCacheRef.current[a.activity_name]; });
      if (Object.keys(photos).length > 0) setActivityPhotos(photos);
      return;
    }

    const fetchPhotos = async () => {
      try {
        if (!(window as any).google?.maps?.places) {
          const { data } = await supabase.functions.invoke("get-maps-key");
          const apiKey = data?.key;
          if (!apiKey) return;
          await new Promise<void>((resolve, reject) => {
            if ((window as any).google?.maps?.places) { resolve(); return; }
            const s = document.createElement("script");
            s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.head.appendChild(s);
          });
        }
        if (!placesServiceRef.current) {
          const mapDiv = document.createElement("div");
          placesServiceRef.current = new (window as any).google.maps.places.PlacesService(mapDiv);
        }
        const service = placesServiceRef.current;
        const photos: Record<string, string> = {};
        Object.assign(photos, photoCacheRef.current);

        for (const act of uncached) {
          try {
            await new Promise<void>((resolve) => {
              service.findPlaceFromQuery(
                { query: act.activity_name, fields: ["photos"] },
                (results: any, status: any) => {
                  if (status === "OK" && results?.[0]?.photos?.[0]) {
                    const url = results[0].photos[0].getUrl({ maxWidth: 1600, maxHeight: 1200 });
                    photos[act.activity_name] = url;
                    photoCacheRef.current[act.activity_name] = url;
                  }
                  resolve();
                }
              );
            });
          } catch {}
        }
        setActivityPhotos(photos);
      } catch {}
    };
    fetchPhotos();
  }, [activities]);

  const deleteActivity = async (id: string) => {
    await supabase.from("itinerary_day_activities").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["itinerary-day-activities", selectedDayId] });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="bg-muted/30 border rounded-lg p-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">📝 Observações</p>
          {readOnly || !onSummaryChange ? (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{summary}</p>
          ) : (
            <textarea
              className="w-full text-sm bg-transparent border border-border rounded p-2 text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              value={summary}
              onChange={(e) => onSummaryChange(e.target.value)}
              rows={3}
            />
          )}
        </div>
      )}

      {/* Day selector */}
      <div className="flex gap-2 flex-wrap">
        {days.map((day: any, i: number) => (
          <Button
            key={day.id}
            variant={selectedDayId === day.id ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectDay(day.id)}
            className="gap-1"
          >
            Dia {i + 1}
            {day.day_date && <span className="text-xs opacity-70">
              {format(new Date(day.day_date + "T00:00:00"), "dd/MM", { locale: ptBR })}
            </span>}
            {day.city && <span className="text-xs opacity-70">· {day.city}</span>}
          </Button>
        ))}
      </div>

      {/* Activities timeline */}
      {selectedDayId && activities.length > 0 && (
        <div className="space-y-0">
          {activities.map((act: any, i: number) => {
            const isSelected = selectedActivityId === act.id;
            // Transport for the NEXT activity (shown between this card and the next)
            const nextAct = activities[i + 1];
            const nextTransportMode = nextAct?.transport_mode;
            const NextTransportIcon = nextTransportMode ? TRANSPORT_ICONS[nextTransportMode] || Car : null;

            return (
              <div key={act.id}>
                {/* Activity card — each card is a location */}
                <div
                  ref={(el) => { activityRefs.current[act.id] = el; }}
                  className={`flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-all cursor-pointer ${
                    isSelected ? "ring-2 ring-primary border-primary shadow-md" : ""
                  }`}
                  onClick={() => onSelectActivity?.(isSelected ? null : act.id)}
                >
                  <div className="flex flex-col items-center min-w-[50px] text-center">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mb-1">{i + 1}</span>
                    {act.start_time && (
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-muted-foreground uppercase leading-none">Chegada</span>
                        <span className="text-sm font-semibold text-foreground">{act.start_time.slice(0,5)}</span>
                      </div>
                    )}
                    {act.end_time && (
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[9px] text-muted-foreground uppercase leading-none">Saída</span>
                        <span className="text-xs text-muted-foreground">{act.end_time.slice(0,5)}</span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail */}
                  {PHOTO_TYPES.includes(act.activity_type) && activityPhotos[act.activity_name] && (
                    <div
                      className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-muted cursor-zoom-in"
                      onClick={(e) => { e.stopPropagation(); setLightboxUrl(activityPhotos[act.activity_name]); }}
                    >
                      <img src={activityPhotos[act.activity_name]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{act.activity_name}</span>
                      {act.activity_type && (
                        <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[act.activity_type] || ""}`}>
                          {TYPE_LABELS[act.activity_type] || act.activity_type}
                        </Badge>
                      )}
                      {act.is_ai_suggested && (
                        <Badge variant="outline" className="text-[10px]">IA</Badge>
                      )}
                      {PHOTO_TYPES.includes(act.activity_type) && (
                        <a
                          href={`https://www.tripadvisor.com/Search?q=${encodeURIComponent(act.activity_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-green-700 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          TripAdvisor
                        </a>
                      )}
                    </div>
                    {act.description && <p className="text-xs text-muted-foreground mt-1">{act.description}</p>}
                    {act.address && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{act.address}</span>
                      </div>
                    )}
                    {act.notes && <p className="text-xs text-muted-foreground/80 mt-1 italic">{act.notes}</p>}
                  </div>

                  {!readOnly && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingActivity(act); }}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteActivity(act.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Transport connector between this card and the next */}
                {nextAct && nextTransportMode && (
                  <div className="flex items-center gap-2 py-2 px-4 ml-6 border-l-2 border-dashed border-muted-foreground/30">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                      {NextTransportIcon && <NextTransportIcon className="h-3.5 w-3.5" />}
                      <span className="font-medium">{TRANSPORT_LABELS[nextTransportMode] || nextTransportMode}</span>
                      {nextAct.transport_duration_min && <span>· {nextAct.transport_duration_min}min</span>}
                      {nextAct.transport_cost_estimate && (
                        <span>· {nextAct.transport_currency || "BRL"} {Number(nextAct.transport_cost_estimate).toFixed(2)}</span>
                      )}
                      {nextAct.transport_departure_time && nextAct.transport_arrival_time && (
                        <span>· {nextAct.transport_departure_time.slice(0,5)} → {nextAct.transport_arrival_time.slice(0,5)}</span>
                      )}
                      {nextAct.transport_notes && <span>· {nextAct.transport_notes}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedDayId && activities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade neste dia. Use a IA para gerar o roteiro.</p>
      )}

      {!selectedDayId && days.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Selecione um dia para ver as atividades.</p>
      )}

      {days.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum dia no roteiro. Use a IA para gerar automaticamente.</p>
      )}

      {/* Edit dialog */}
      {editingActivity && selectedDayId && (
        <ActivityEditDialog
          activity={editingActivity}
          dayId={selectedDayId}
          open={!!editingActivity}
          onOpenChange={(open) => { if (!open) setEditingActivity(null); }}
        />
      )}

      {/* Photo lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
