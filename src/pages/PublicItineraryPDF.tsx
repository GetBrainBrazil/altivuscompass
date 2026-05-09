import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Plane, MapPin, Car, Train, Ship, Footprints, Bus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TRANSPORT_ICONS: Record<string, any> = {
  uber: Car, taxi: Car, transfer: Car, trem: Train, metro: Train,
  barco: Ship, aviao: Plane, a_pe: Footprints, onibus: Bus,
};
const TRANSPORT_LABELS: Record<string, string> = {
  uber: "Uber", taxi: "Táxi", transfer: "Transfer", trem: "Trem", metro: "Metrô",
  barco: "Barco", aviao: "Avião", a_pe: "A pé", onibus: "Ônibus",
};
const TYPE_LABELS: Record<string, string> = {
  attraction: "Atração", restaurant: "Restaurante", hotel: "Hotel",
  transport_hub: "Transporte", shopping: "Compras", entertainment: "Entretenimento",
  nature: "Natureza", cultural: "Cultural",
};

export default function PublicItineraryPDF() {
  const { token } = useParams<{ token: string }>();

  const { data: itinerary, isLoading, error } = useQuery({
    queryKey: ["public-itinerary-pdf", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("public_itineraries")
        .select("*, arrival_airport:airports!itineraries_arrival_airport_id_fkey(iata_code, name, city), departure_airport:airports!itineraries_departure_airport_id_fkey(iata_code, name, city)")
        .eq("public_token", token)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const { data: days = [] } = useQuery({
    queryKey: ["public-itinerary-pdf-days", itinerary?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_days")
        .select("*, itinerary_day_activities(*)")
        .eq("itinerary_id", itinerary!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!itinerary?.id,
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Carregando roteiro...</p></div>;
  }
  if (error || !itinerary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Roteiro não encontrado</h1>
          <p className="text-muted-foreground mt-2">Este link pode estar expirado ou inválido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black print:bg-white">
      {/* Action bar - hidden on print */}
      <div className="sticky top-0 z-10 bg-[hsl(var(--primary))] text-white py-3 px-6 flex items-center justify-between print:hidden">
        <div>
          <p className="text-xs opacity-80">Roteiro de Viagem · Altivus Turismo</p>
          <h1 className="text-lg font-bold">{itinerary.title}</h1>
        </div>
        <Button size="sm" variant="secondary" onClick={() => window.print()} className="gap-1">
          <Download className="h-4 w-4" /> Baixar PDF
        </Button>
      </div>

      {/* Printable content */}
      <div className="max-w-4xl mx-auto p-6 print:p-4">
        {/* Cover */}
        <div className="border-b-2 border-gray-200 pb-4 mb-6 print:break-after-avoid">
          <p className="text-xs uppercase tracking-wide text-gray-500">Roteiro de Viagem · Altivus Turismo</p>
          <h1 className="text-3xl font-bold mt-1">{itinerary.title}</h1>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-700">
            {itinerary.travel_date_start && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(itinerary.travel_date_start + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                {itinerary.travel_date_end && ` a ${format(new Date(itinerary.travel_date_end + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`}
              </div>
            )}
            {itinerary.arrival_airport && (
              <div className="flex items-center gap-1"><Plane className="h-4 w-4" />{(itinerary.arrival_airport as any).iata_code} — {(itinerary.arrival_airport as any).city}</div>
            )}
          </div>
        </div>

        {/* Summary */}
        {itinerary.summary && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 print:break-inside-avoid">
            <p className="text-sm font-semibold mb-1">📝 Observações</p>
            <p className="text-sm whitespace-pre-line text-gray-700">{itinerary.summary}</p>
          </div>
        )}

        {/* Days */}
        {days.map((day: any, dIdx: number) => {
          const acts = (day.itinerary_day_activities || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          return (
            <div key={day.id} className="mb-8 print:break-inside-avoid-page">
              <div className="bg-[hsl(var(--primary))] text-white rounded-t-lg px-4 py-2">
                <h2 className="text-lg font-bold">
                  Dia {dIdx + 1}
                  {day.day_date && ` · ${format(new Date(day.day_date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`}
                  {day.city && ` · ${day.city}`}
                </h2>
              </div>
              <div className="border border-t-0 border-gray-200 rounded-b-lg p-4 space-y-0">
                {acts.length === 0 && <p className="text-sm text-gray-500 italic">Sem atividades planejadas.</p>}
                {acts.map((act: any, i: number) => {
                  const next = acts[i + 1];
                  const TIcon = next?.transport_mode ? (TRANSPORT_ICONS[next.transport_mode] || Car) : null;
                  return (
                    <div key={act.id}>
                      <div className="flex items-start gap-3 py-2 print:break-inside-avoid">
                        <div className="flex flex-col items-center min-w-[55px]">
                          {act.start_time && (
                            <>
                              <span className="text-[9px] uppercase text-gray-500">Chegada</span>
                              <span className="text-sm font-semibold">{act.start_time.slice(0, 5)}</span>
                            </>
                          )}
                          {act.end_time && (
                            <>
                              <span className="text-[9px] uppercase text-gray-500 mt-1">Saída</span>
                              <span className="text-xs text-gray-600">{act.end_time.slice(0, 5)}</span>
                            </>
                          )}
                          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center mt-1.5">
                            <span className="text-[10px] font-bold text-white">{i + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{act.activity_name}</span>
                            {act.activity_type && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                {TYPE_LABELS[act.activity_type] || act.activity_type}
                              </span>
                            )}
                          </div>
                          {act.description && <p className="text-xs text-gray-700 mt-1">{act.description}</p>}
                          {act.address && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                              <MapPin className="h-3 w-3" />
                              <span>{act.address}</span>
                            </div>
                          )}
                          {act.notes && <p className="text-xs text-gray-500 mt-1 italic">{act.notes}</p>}
                        </div>
                      </div>
                      {next && next.transport_mode && (
                        <div className="ml-7 my-1 pl-3 border-l-2 border-dashed border-gray-300">
                          <div className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full">
                            {TIcon && <TIcon className="h-3.5 w-3.5" />}
                            <span className="font-medium">{TRANSPORT_LABELS[next.transport_mode] || next.transport_mode}</span>
                            {next.transport_duration_min && <span>· {next.transport_duration_min}min</span>}
                            {next.transport_cost_estimate && (
                              <span>· {next.transport_currency || "BRL"} {Number(next.transport_cost_estimate).toFixed(2)}</span>
                            )}
                            {next.transport_departure_time && next.transport_arrival_time && (
                              <span>· {next.transport_departure_time.slice(0, 5)} → {next.transport_arrival_time.slice(0, 5)}</span>
                            )}
                            {next.transport_notes && <span>· {next.transport_notes}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-200">
          Roteiro gerado por Altivus Turismo
        </div>
      </div>
    </div>
  );
}
