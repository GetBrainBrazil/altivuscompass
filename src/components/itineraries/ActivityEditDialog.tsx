import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useFormPersistence } from "@/hooks/useFormPersistence";

interface Props {
  activity: any;
  dayId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTIVITY_TYPES = [
  { value: "attraction", label: "Atração" },
  { value: "restaurant", label: "Restaurante" },
  { value: "hotel", label: "Hotel" },
  { value: "transport_hub", label: "Transporte" },
  { value: "shopping", label: "Compras" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "nature", label: "Natureza" },
  { value: "cultural", label: "Cultural" },
];

const TRANSPORT_MODES = [
  { value: "", label: "Nenhum" },
  { value: "uber", label: "Uber" },
  { value: "taxi", label: "Táxi" },
  { value: "transfer", label: "Transfer" },
  { value: "trem", label: "Trem" },
  { value: "metro", label: "Metrô" },
  { value: "barco", label: "Barco" },
  { value: "aviao", label: "Avião" },
  { value: "a_pe", label: "A pé" },
  { value: "onibus", label: "Ônibus" },
];

export default function ActivityEditDialog({ activity, dayId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [form, setForm] = useState({
    activity_name: "",
    description: "",
    activity_type: "attraction",
    start_time: "",
    end_time: "",
    address: "",
    latitude: "",
    longitude: "",
    notes: "",
    transport_mode: "",
    transport_departure_time: "",
    transport_arrival_time: "",
    transport_duration_min: "",
    transport_cost_estimate: "",
    transport_currency: "EUR",
    transport_notes: "",
  });

  const persistKey = `activity-edit-${activity?.id || "new"}`;
  const setFormCallback = useCallback((data: typeof form) => setForm(data), []);
  const { clearPersistence } = useFormPersistence(persistKey, form, setFormCallback, open);

  useEffect(() => {
    if (activity) {
      setForm({
        activity_name: activity.activity_name || "",
        description: activity.description || "",
        activity_type: activity.activity_type || "attraction",
        start_time: activity.start_time?.slice(0, 5) || "",
        end_time: activity.end_time?.slice(0, 5) || "",
        address: activity.address || "",
        latitude: activity.latitude?.toString() || "",
        longitude: activity.longitude?.toString() || "",
        notes: activity.notes || "",
        transport_mode: activity.transport_mode || "",
        transport_departure_time: activity.transport_departure_time?.slice(0, 5) || "",
        transport_arrival_time: activity.transport_arrival_time?.slice(0, 5) || "",
        transport_duration_min: activity.transport_duration_min?.toString() || "",
        transport_cost_estimate: activity.transport_cost_estimate?.toString() || "",
        transport_currency: activity.transport_currency || "EUR",
        transport_notes: activity.transport_notes || "",
      });
    }
  }, [activity]);

  // Setup Google Places Autocomplete
  useEffect(() => {
    if (!open) return;

    const tryInit = () => {
      if (!addressInputRef.current) return false;
      if (!window.google?.maps?.places) return false;
      if (autocompleteRef.current) return true;

      const autocomplete = new window.google.maps.places.Autocomplete(addressInputRef.current, {
        types: ["establishment", "geocode"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place) return;

        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();

        setForm((f) => ({
          ...f,
          address: place.formatted_address || place.name || f.address,
          latitude: lat?.toString() || f.latitude,
          longitude: lng?.toString() || f.longitude,
        }));
      });

      autocompleteRef.current = autocomplete;
      return true;
    };

    // Retry until Google Maps is loaded (may load async from map component)
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 200);

    // Cleanup
    return () => clearInterval(interval);
  }, [open]);

  // Cleanup autocomplete on close
  useEffect(() => {
    if (!open) {
      autocompleteRef.current = null;
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = {
        activity_name: form.activity_name,
        description: form.description || null,
        activity_type: form.activity_type,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        address: form.address || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        notes: form.notes || null,
        transport_mode: form.transport_mode || null,
        transport_departure_time: form.transport_departure_time || null,
        transport_arrival_time: form.transport_arrival_time || null,
        transport_duration_min: form.transport_duration_min ? parseInt(form.transport_duration_min) : null,
        transport_cost_estimate: form.transport_cost_estimate ? parseFloat(form.transport_cost_estimate) : null,
        transport_currency: form.transport_currency || null,
        transport_notes: form.transport_notes || null,
      };

      const { error } = await supabase
        .from("itinerary_day_activities")
        .update(updates)
        .eq("id", activity.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["itinerary-day-activities", dayId] });
      toast({ title: "Atividade atualizada" });
      clearPersistence();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">Editar Atividade</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div>
            <Label className="text-xs">Nome da atividade</Label>
            <Input value={form.activity_name} onChange={(e) => set("activity_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.activity_type} onValueChange={(v) => set("activity_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>

          <div>
            <Label className="text-xs">Endereço (busca no Google Maps)</Label>
            <Input
              ref={addressInputRef}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Digite o nome do local ou endereço..."
            />
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          {/* Transport section */}
          <div className="border-t pt-3 mt-3">
            <Label className="text-xs font-semibold text-muted-foreground">Transporte (deslocamento até aqui)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Modal</Label>
                <Select value={form.transport_mode} onValueChange={(v) => set("transport_mode", v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((t) => (
                      <SelectItem key={t.value || "none"} value={t.value || "none"}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input type="number" value={form.transport_duration_min} onChange={(e) => set("transport_duration_min", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Saída</Label>
                <Input type="time" value={form.transport_departure_time} onChange={(e) => set("transport_departure_time", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Chegada</Label>
                <Input type="time" value={form.transport_arrival_time} onChange={(e) => set("transport_arrival_time", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Custo estimado</Label>
                <Input type="number" step="0.01" value={form.transport_cost_estimate} onChange={(e) => set("transport_cost_estimate", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Moeda</Label>
                <Input value={form.transport_currency} onChange={(e) => set("transport_currency", e.target.value)} />
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs">Notas transporte</Label>
              <Input value={form.transport_notes} onChange={(e) => set("transport_notes", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.activity_name}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
