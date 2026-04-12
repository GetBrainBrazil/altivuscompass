import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MapPin, Clock, Car, Train, Ship, Plane, Footprints, Bus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  itineraryId: string;
  selectedDayId: string | null;
  onSelectDay: (id: string | null) => void;
  readOnly?: boolean;
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

export default function ItineraryTimeline({ itineraryId, selectedDayId, onSelectDay, readOnly }: Props) {
  const queryClient = useQueryClient();

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

  const deleteActivity = async (id: string) => {
    await supabase.from("itinerary_day_activities").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["itinerary-day-activities", selectedDayId] });
  };

  return (
    <div className="space-y-4">
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
        <div className="space-y-1">
          {activities.map((act: any, i: number) => {
            const TransportIcon = act.transport_mode ? TRANSPORT_ICONS[act.transport_mode] || Car : null;

            return (
              <div key={act.id}>
                {/* Transport between activities */}
                {i > 0 && act.transport_mode && (
                  <div className="flex items-center gap-2 py-2 px-4 ml-4 border-l-2 border-dashed border-muted-foreground/30">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                      {TransportIcon && <TransportIcon className="h-3 w-3" />}
                      <span>{TRANSPORT_LABELS[act.transport_mode] || act.transport_mode}</span>
                      {act.transport_duration_min && <span>· {act.transport_duration_min}min</span>}
                      {act.transport_cost_estimate && (
                        <span>· {act.transport_currency || "BRL"} {Number(act.transport_cost_estimate).toFixed(2)}</span>
                      )}
                      {act.transport_departure_time && act.transport_arrival_time && (
                        <span>· {act.transport_departure_time.slice(0,5)} → {act.transport_arrival_time.slice(0,5)}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Activity card */}
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                  <div className="flex flex-col items-center min-w-[50px] text-center">
                    {act.start_time && (
                      <span className="text-sm font-semibold text-foreground">{act.start_time.slice(0,5)}</span>
                    )}
                    {act.end_time && (
                      <span className="text-xs text-muted-foreground">{act.end_time.slice(0,5)}</span>
                    )}
                  </div>

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
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteActivity(act.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
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
    </div>
  );
}
