import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  itineraryId: string;
  selectedDayId: string | null;
}

declare global {
  interface Window {
    google: any;
    initItineraryMap: () => void;
  }
}

let mapsLoaded = false;
let mapsLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (mapsLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    loadCallbacks.push(resolve);
    if (mapsLoading) return;
    mapsLoading = true;
    window.initItineraryMap = () => {
      mapsLoaded = true;
      loadCallbacks.forEach((cb) => cb());
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initItineraryMap&libraries=geometry`;
    script.async = true;
    document.head.appendChild(script);
  });
}

const TYPE_MARKERS: Record<string, string> = {
  attraction: "🏛️",
  restaurant: "🍽️",
  hotel: "🏨",
  transport_hub: "🚉",
  shopping: "🛍️",
  entertainment: "🎭",
  nature: "🌿",
  cultural: "🎨",
};

export default function ItineraryMapView({ itineraryId, selectedDayId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Load Google Maps
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoading(false);
      return;
    }
    loadGoogleMaps(apiKey).then(() => {
      if (mapRef.current && !mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 0, lng: 0 },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
      }
      setMapReady(true);
      setLoading(false);
    });
  }, []);

  // Update markers when activities change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    // Clear old markers and polylines
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const geoActivities = activities.filter((a: any) => a.latitude && a.longitude);
    if (geoActivities.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const path: any[] = [];

    geoActivities.forEach((act: any, i: number) => {
      const pos = { lat: act.latitude, lng: act.longitude };
      bounds.extend(pos);
      path.push(pos);

      const marker = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        label: {
          text: String(i + 1),
          color: "white",
          fontWeight: "bold",
          fontSize: "12px",
        },
        title: act.activity_name,
      });

      const emoji = TYPE_MARKERS[act.activity_type] || "📍";
      const transportInfo = act.transport_mode
        ? `<div style="margin-top:4px;padding:4px 8px;background:#f3f4f6;border-radius:4px;font-size:11px">
            🚗 ${act.transport_mode} · ${act.transport_duration_min || "?"}min
            ${act.transport_cost_estimate ? ` · ${act.transport_currency || "BRL"} ${Number(act.transport_cost_estimate).toFixed(2)}` : ""}
          </div>`
        : "";

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="max-width:250px">
          <strong>${emoji} ${act.activity_name}</strong>
          ${act.start_time ? `<div style="font-size:12px;color:#666">${act.start_time.slice(0,5)}${act.end_time ? ` - ${act.end_time.slice(0,5)}` : ""}</div>` : ""}
          ${act.description ? `<div style="font-size:12px;margin-top:4px">${act.description}</div>` : ""}
          ${act.address ? `<div style="font-size:11px;color:#888;margin-top:4px">📍 ${act.address}</div>` : ""}
          ${transportInfo}
        </div>`,
      });

      marker.addListener("click", () => infoWindow.open(mapInstanceRef.current, marker));
      markersRef.current.push(marker);
    });

    // Draw path
    if (path.length > 1) {
      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.7,
        strokeWeight: 3,
        icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: "#3b82f6" }, offset: "50%" }],
      });
      polyline.setMap(mapInstanceRef.current);
      polylinesRef.current.push(polyline);
    }

    mapInstanceRef.current.fitBounds(bounds);
    if (geoActivities.length === 1) mapInstanceRef.current.setZoom(15);
  }, [activities, mapReady]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-[400px] bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm">
        Configure VITE_GOOGLE_MAPS_API_KEY para visualizar o mapa
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapRef} className="h-[400px] w-full" />
    </div>
  );
}
