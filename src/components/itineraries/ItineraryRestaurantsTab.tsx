import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { itineraryId: string; }

export default function ItineraryRestaurantsTab({ itineraryId }: Props) {
  const queryClient = useQueryClient();
  const qk = ["itinerary-restaurants", itineraryId];
  const [newItem, setNewItem] = useState({ city_base: "", restaurant_name: "", cuisine_type: "", best_fit: "", reason: "", source: "" });

  const { data: items = [] } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase.from("itinerary_restaurants").select("*").eq("itinerary_id", itineraryId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newItem.restaurant_name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); throw new Error(); }
      const { error } = await supabase.from("itinerary_restaurants").insert({
        itinerary_id: itineraryId,
        city_base: newItem.city_base || null,
        restaurant_name: newItem.restaurant_name,
        cuisine_type: newItem.cuisine_type || null,
        best_fit: newItem.best_fit || null,
        reason: newItem.reason || null,
        source: newItem.source || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      setNewItem({ city_base: "", restaurant_name: "", cuisine_type: "", best_fit: "", reason: "", source: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("itinerary_restaurants").delete().eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const updateField = async (id: string, field: string, value: string) => {
    await supabase.from("itinerary_restaurants").update({ [field]: value || null }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: qk });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cidade/Base</TableHead>
          <TableHead>Restaurante</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Melhor Encaixe</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Fonte</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell><Input defaultValue={r.city_base || ""} onBlur={(e) => updateField(r.id, "city_base", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={r.restaurant_name} onBlur={(e) => updateField(r.id, "restaurant_name", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={r.cuisine_type || ""} onBlur={(e) => updateField(r.id, "cuisine_type", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={r.best_fit || ""} onBlur={(e) => updateField(r.id, "best_fit", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={r.reason || ""} onBlur={(e) => updateField(r.id, "reason", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={r.source || ""} onBlur={(e) => updateField(r.id, "source", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/30">
          <TableCell><Input value={newItem.city_base} onChange={(e) => setNewItem({ ...newItem, city_base: e.target.value })} placeholder="Cidade" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.restaurant_name} onChange={(e) => setNewItem({ ...newItem, restaurant_name: e.target.value })} placeholder="Nome *" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.cuisine_type} onChange={(e) => setNewItem({ ...newItem, cuisine_type: e.target.value })} placeholder="Tipo" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.best_fit} onChange={(e) => setNewItem({ ...newItem, best_fit: e.target.value })} placeholder="Encaixe" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.reason} onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })} placeholder="Motivo" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.source} onChange={(e) => setNewItem({ ...newItem, source: e.target.value })} placeholder="Fonte" className="h-8 text-xs" /></TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => addMutation.mutate()}><Plus className="h-4 w-4" /></Button></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
