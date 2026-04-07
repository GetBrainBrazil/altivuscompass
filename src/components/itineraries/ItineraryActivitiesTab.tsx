import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props { itineraryId: string; }

export default function ItineraryActivitiesTab({ itineraryId }: Props) {
  const queryClient = useQueryClient();
  const qk = ["itinerary-activities", itineraryId];
  const [newItem, setNewItem] = useState({ activity_name: "", approx_price: "", avg_duration: "", period: "", description: "", source_url: "" });

  const { data: items = [] } = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase.from("itinerary_activities").select("*").eq("itinerary_id", itineraryId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newItem.activity_name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); throw new Error(); }
      const { error } = await supabase.from("itinerary_activities").insert({
        itinerary_id: itineraryId,
        activity_name: newItem.activity_name,
        approx_price: newItem.approx_price ? parseFloat(newItem.approx_price) : null,
        avg_duration: newItem.avg_duration || null,
        period: newItem.period || null,
        description: newItem.description || null,
        source_url: newItem.source_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      setNewItem({ activity_name: "", approx_price: "", avg_duration: "", period: "", description: "", source_url: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("itinerary_activities").delete().eq("id", id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk }),
  });

  const updateField = async (id: string, field: string, value: string) => {
    const v = field === "approx_price" ? (value ? parseFloat(value) : null) : (value || null);
    await supabase.from("itinerary_activities").update({ [field]: v }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: qk });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Passeio</TableHead>
          <TableHead className="w-[110px]">Preço Aprox.</TableHead>
          <TableHead className="w-[110px]">Duração</TableHead>
          <TableHead className="w-[120px]">Período</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>URL Fonte</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((a: any) => (
          <TableRow key={a.id}>
            <TableCell><Input defaultValue={a.activity_name} onBlur={(e) => updateField(a.id, "activity_name", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input type="number" step="0.01" defaultValue={a.approx_price || ""} onBlur={(e) => updateField(a.id, "approx_price", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={a.avg_duration || ""} onBlur={(e) => updateField(a.id, "avg_duration", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={a.period || ""} onBlur={(e) => updateField(a.id, "period", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={a.description || ""} onBlur={(e) => updateField(a.id, "description", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Input defaultValue={a.source_url || ""} onBlur={(e) => updateField(a.id, "source_url", e.target.value)} className="h-8 text-xs" /></TableCell>
            <TableCell><Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/30">
          <TableCell><Input value={newItem.activity_name} onChange={(e) => setNewItem({ ...newItem, activity_name: e.target.value })} placeholder="Nome *" className="h-8 text-xs" /></TableCell>
          <TableCell><Input type="number" step="0.01" value={newItem.approx_price} onChange={(e) => setNewItem({ ...newItem, approx_price: e.target.value })} placeholder="R$" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.avg_duration} onChange={(e) => setNewItem({ ...newItem, avg_duration: e.target.value })} placeholder="Ex: 2h" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.period} onChange={(e) => setNewItem({ ...newItem, period: e.target.value })} placeholder="Manhã/Tarde" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descrição" className="h-8 text-xs" /></TableCell>
          <TableCell><Input value={newItem.source_url} onChange={(e) => setNewItem({ ...newItem, source_url: e.target.value })} placeholder="URL" className="h-8 text-xs" /></TableCell>
          <TableCell><Button variant="ghost" size="icon" onClick={() => addMutation.mutate()}><Plus className="h-4 w-4" /></Button></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
