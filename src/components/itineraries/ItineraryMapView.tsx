import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  itineraryId: string;
  selectedDayId: string | null;
  selectedActivityId?: string | null;
  onSelectActivity?: (id: string | null) => void;
  height?: string;
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

const DRIVING_MODES = new Set(["uber", "taxi", "transfer", "carro", "car", "ônibus", "onibus", "bus"]);
const WALKING_MODES = new Set(["a pé", "a pe", "a_pe", "a_pé", "walking", "caminhada", "walk"]);

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initItineraryMap&libraries=geometry,places`;
    script.async = true;
    document.head.appendChild(script);
  });
}

const TYPE_MARKERS: Record<string, string> = {
  attraction: "🏛️", restaurant: "🍽️", hotel: "🏨", transport_hub: "🚉",
  shopping: "🛍️", entertainment: "🎭", nature: "🌿", cultural: "🎨",
};

export default function ItineraryMapView({ itineraryId, selectedDayId, selectedActivityId, onSelectActivity, height = "h-[400px]" }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const directionsRenderersRef = useRef<any[]>([]);
  const infoWindowsRef = useRef<any[]>([]);
  const activityIdsRef = useRef<string[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);

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

  // Load Google Maps via edge function key
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("get-maps-key");
        const apiKey = data?.key;
        if (!apiKey) { setNoKey(true); setLoading(false); return; }
        await loadGoogleMaps(apiKey);
        if (mapRef.current && !mapInstanceRef.current) {
          mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
            zoom: 12, center: { lat: 0, lng: 0 },
            mapTypeControl: true, mapTypeControlOptions: {
              style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
              position: window.google.maps.ControlPosition.TOP_RIGHT,
              mapTypeIds: ["roadmap", "satellite", "hybrid"],
            },
            streetViewControl: false, fullscreenControl: true,
          });
        }
        setMapReady(true);
      } catch {
        setNoKey(true);
      }
      setLoading(false);
    })();
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    directionsRenderersRef.current.forEach((r) => r.setMap(null));
    directionsRenderersRef.current = [];
    infoWindowsRef.current = [];
    activityIdsRef.current = [];

    const geoActivities = activities.filter((a: any) => a.latitude && a.longitude);
    if (geoActivities.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const path: any[] = [];

    geoActivities.forEach((act: any, i: number) => {
      const pos = { lat: act.latitude, lng: act.longitude };
      bounds.extend(pos);
      path.push(pos);
      activityIdsRef.current.push(act.id);

      const marker = new window.google.maps.Marker({
        position: pos, map: mapInstanceRef.current,
        label: { text: String(i + 1), color: "white", fontWeight: "bold", fontSize: "12px" },
        title: act.activity_name,
      });

      const emoji = TYPE_MARKERS[act.activity_type] || "📍";
      const transportInfo = act.transport_mode
        ? `<div style="margin-top:4px;padding:4px 8px;background:#f3f4f6;border-radius:4px;font-size:11px">
            🚗 ${act.transport_mode} · ${act.transport_duration_min || "?"}min
            ${act.transport_cost_estimate ? ` · ${act.transport_currency || "BRL"} ${Number(act.transport_cost_estimate).toFixed(2)}` : ""}
          </div>` : "";

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="max-width:260px;overflow:visible">
          <div style="font-weight:bold;font-size:13px;margin-bottom:4px">${emoji} ${act.activity_name}</div>
          ${act.start_time ? `<div style="font-size:12px;color:#666">${act.start_time.slice(0,5)}${act.end_time ? ` - ${act.end_time.slice(0,5)}` : ""}</div>` : ""}
          ${act.description ? `<div style="font-size:12px;margin-top:4px">${act.description}</div>` : ""}
          ${act.address ? `<div style="font-size:11px;color:#888;margin-top:4px">📍 ${act.address}</div>` : ""}
          ${transportInfo}
        </div>`,
        maxWidth: 280,
      });

      marker.addListener("click", () => {
        // Close all other info windows
        infoWindowsRef.current.forEach((iw) => iw.close());
        infoWindow.open(mapInstanceRef.current, marker);
        onSelectActivity?.(act.id);
      });

      markersRef.current.push(marker);
      infoWindowsRef.current.push(infoWindow);
    });

    const directionsService = new window.google.maps.DirectionsService();

    for (let i = 0; i < geoActivities.length - 1; i++) {
      const origin = { lat: geoActivities[i].latitude, lng: geoActivities[i].longitude };
      const dest = { lat: geoActivities[i + 1].latitude, lng: geoActivities[i + 1].longitude };
      const nextAct = geoActivities[i + 1];
      const mode = (nextAct.transport_mode || "").toLowerCase().trim().replace(/_/g, " ");
      const useDriving = DRIVING_MODES.has(mode);
      const useWalking = WALKING_MODES.has(mode);
      const isFlying = ["avião", "aviao", "voo", "flight"].includes(mode);

      if (useDriving || useWalking) {
        const travelMode = useWalking
          ? window.google.maps.TravelMode.WALKING
          : window.google.maps.TravelMode.DRIVING;
        const strokeColor = useWalking ? "#10b981" : "#3b82f6";
        directionsService.route(
          { origin, destination: dest, travelMode },
          (result: any, status: any) => {
            if (status === "OK") {
              const renderer = new window.google.maps.DirectionsRenderer({
                map: mapInstanceRef.current,
                directions: result,
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor,
                  strokeOpacity: 0.8,
                  strokeWeight: useWalking ? 3 : 4,
                  ...(useWalking ? {
                    strokePattern: [{ icon: { path: "M 0,-0.5 0,0.5", strokeColor, strokeWeight: 3, scale: 3 }, offset: "0", repeat: "10px" }],
                  } : {}),
                },
              });
              directionsRenderersRef.current.push(renderer);
            } else {
              const fallback = new window.google.maps.Polyline({
                path: [origin, dest], geodesic: true, strokeColor, strokeOpacity: 0.7, strokeWeight: 3,
                icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor }, offset: "50%" }],
              });
              fallback.setMap(mapInstanceRef.current);
              polylinesRef.current.push(fallback);
            }
          }
        );
      } else if (isFlying) {
        const polyline = new window.google.maps.Polyline({
          path: [origin, dest], geodesic: true, strokeColor: "#f59e0b", strokeOpacity: 0.6, strokeWeight: 2,
          strokeDashArray: [10, 6],
          icons: [
            { icon: { path: "M -1,-1 1,1 M -1,1 1,-1", strokeColor: "#f59e0b", strokeWeight: 2, scale: 3 }, offset: "0", repeat: "16px" },
            { icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: "#f59e0b" }, offset: "50%" },
          ],
        });
        polyline.setMap(mapInstanceRef.current);
        polylinesRef.current.push(polyline);
      } else {
        const polyline = new window.google.maps.Polyline({
          path: [origin, dest], geodesic: true, strokeColor: "#3b82f6", strokeOpacity: 0.7, strokeWeight: 3,
          icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: "#3b82f6" }, offset: "50%" }],
        });
        polyline.setMap(mapInstanceRef.current);
        polylinesRef.current.push(polyline);
      }
    }

    try {
      if (!bounds.isEmpty()) {
        const boundsLiteral = bounds.toJSON();
        mapInstanceRef.current.fitBounds(boundsLiteral);
        if (geoActivities.length === 1) mapInstanceRef.current.setZoom(15);
      } else if (geoActivities.length > 0) {
        mapInstanceRef.current.setCenter({ lat: geoActivities[0].latitude, lng: geoActivities[0].longitude });
        mapInstanceRef.current.setZoom(12);
      }
    } catch (e) {
      console.warn("fitBounds error, falling back to setCenter", e);
      if (geoActivities.length > 0) {
        mapInstanceRef.current.setCenter({ lat: geoActivities[0].latitude, lng: geoActivities[0].longitude });
        mapInstanceRef.current.setZoom(12);
      }
    }
  }, [activities, mapReady]);

  // Highlight selected activity on map
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const idx = activityIdsRef.current.indexOf(selectedActivityId || "");
    if (idx === -1) {
      // Close all info windows if nothing selected
      infoWindowsRef.current.forEach((iw) => iw.close());
      // Reset all markers to default
      markersRef.current.forEach((m, i) => {
        m.setAnimation(null);
      });
      return;
    }

    // Close all, then open selected
    infoWindowsRef.current.forEach((iw) => iw.close());
    markersRef.current.forEach((m) => m.setAnimation(null));
    
    const marker = markersRef.current[idx];
    const infoWindow = infoWindowsRef.current[idx];
    if (marker && infoWindow) {
      infoWindow.open(mapInstanceRef.current, marker);
      marker.setAnimation(window.google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 1400);
      const pos = marker.getPosition();
      if (pos && typeof pos.lat === "function") {
        mapInstanceRef.current.panTo({ lat: pos.lat(), lng: pos.lng() });
      }
    }
  }, [selectedActivityId, mapReady]);

  if (noKey) {
    return (
      <div className={`${height} bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm`}>
        Mapa indisponível — chave do Google Maps não configurada
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapRef} className={`${height} w-full`} />
    </div>
  );
}
