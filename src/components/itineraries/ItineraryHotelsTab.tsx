import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { itineraryId: string; }

export default function ItineraryHotelsTab({ itineraryId }: Props) {
  const queryClient = useQueryClient();
  const qk = ["itinerary-hotels", itineraryId];
  const [newItem, setNewItem] = useState({ city_base: "", hotel_name: "", hotel_type: "", check_in: "", check_out: "", nights: "", observations: "" });

  const { data: items = [] } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase.from("itinerary_hotels").select("*").eq("itinerary_id", itineraryId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newItem.hotel_name.trim()) { toast({ title: "Nome do hotel é obrigatório", variant: "destructive" }); throw new Error(); }
      const { error } = await supabase.from("itinerary_hotels").insert({
        itinerary_id: itineraryId,
        city_base: newItem.city_base || null,
        hotel_name: newItem.hotel_name,
        hotel_type: newItem.hotel_type || null,
        check_in: newItem.check_in || null,
        check_out: newItem.check_out || null,
        nights: newItem.nights ? parseInt(newItem.nights) : null,
        observations: newItem.observations || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      setNewItem({ city_base: "", hotel_name: "", hotel_type: "", check_in: "", check_out: "", nights: "", observations: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("itinerary_hotels").delete().eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const updateField = async (id: string, field: string, value: string) => {
    const v = field === "nights" ? (value ? parseInt(value) : null) : (value || null);
    await supabase.from("itinerary_hotels").update({ [field]: v }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: qk });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cidade/Base</TableHead>
          <TableHead>Nome do Hotel</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="w-[120px]">Check-in</TableHead>
          <TableHead className="w-[120px]">Check-out</TableHead>
          <TableHead className="w-[70px]">Noites</TableHead>
          <TableHead>Observações</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((h: any) => (
          <TableRow key={h.id}>
            <TableCell><Input defaultValue={h.city_base || ""} onBlur={(e) => updateField(h.id, "city_base", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={h.hotel_name} onBlur={(e) => updateField(h.id, "hotel_name", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={h.hotel_type || ""} onBlur={(e) => updateField(h.id, "hotel_type", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input type="date" defaultValue={h.check_in || ""} onBlur={(e) => updateField(h.id, "check_in", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input type="date" defaultValue={h.check_out || ""} onBlur={(e) => updateField(h.id, "check_out", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input type="number" defaultValue={h.nights || ""} onBlur={(e) => updateField(h.id, "nights", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={h.observations || ""} onBlur={(e) => updateField(h.id, "observations", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(h.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/30">
          <TableCell><Input value={newItem.city_base} onChange={(e) => setNewItem({ ...newItem, city_base: e.target.value })} placeholder="Cidade" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.hotel_name} onChange={(e) => setNewItem({ ...newItem, hotel_name: e.target.value })} placeholder="Nome *" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.hotel_type} onChange={(e) => setNewItem({ ...newItem, hotel_type: e.target.value })} placeholder="Tipo" className="h-8 text-xs" /></TableCell>
          <TableCell><Input type="date" value={newItem.check_in} onChange={(e) => setNewItem({ ...newItem, check_in: e.target.value })} className="h-8 text-xs" /></TableCell>
          <TableCell><Input type="date" value={newItem.check_out} onChange={(e) => setNewItem({ ...newItem, check_out: e.target.value })} className="h-8 text-xs" /></TableCell>
          <TableCell><Input type="number" value={newItem.nights} onChange={(e) => setNewItem({ ...newItem, nights: e.target.value })} placeholder="N" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.observations} onChange={(e) => setNewItem({ ...newItem, observations: e.target.value })} placeholder="Obs" className="h-8 text-xs" /></TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => addMutation.mutate()}><Plus className="h-4 w-4" /></Button></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
