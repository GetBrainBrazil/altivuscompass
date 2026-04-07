import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  itineraryId: string;
}

export default function ItineraryDaysTab({ itineraryId }: Props) {
  const queryClient = useQueryClient();
  const [newDay, setNewDay] = useState({ day_date: "", city: "", morning_activity: "", afternoon_activity: "", evening_activity: "" });

  const { data: days = [] } = useQuery({
    queryKey: ["itinerary-days", itineraryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_days")
        .select("*")
        .eq("itinerary_id", itineraryId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("itinerary_days").insert({
        itinerary_id: itineraryId,
        day_date: newDay.day_date || null,
        city: newDay.city || null,
        morning_activity: newDay.morning_activity || null,
        afternoon_activity: newDay.afternoon_activity || null,
        evening_activity: newDay.evening_activity || null,
        sort_order: days.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itinerary-days", itineraryId] });
      setNewDay({ day_date: "", city: "", morning_activity: "", afternoon_activity: "", evening_activity: "" });
      toast({ title: "Dia adicionado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("itinerary_days").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itinerary-days", itineraryId] });
    },
  });

  const updateField = async (id: string, field: string, value: string) => {
    await supabase.from("itinerary_days").update({ [field]: value || null }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["itinerary-days", itineraryId] });
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Data</TableHead>
            <TableHead className="w-[150px]">Cidade</TableHead>
            <TableHead>Período (manhã)</TableHead>
            <TableHead>Período (tarde)</TableHead>
            <TableHead>Período (noite)</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day: any) => (
            <TableRow key={day.id}>
              <TableCell>
                <Input type="date" defaultValue={day.day_date || ""} onBlur={(e) => updateField(day.id, "day_date", e.target.value)} className="h-8 text-xs" />
              </TableCell>
              <TableCell>
                <Input defaultValue={day.city || ""} onBlur={(e) => updateField(day.id, "city", e.target.value)} className="h-8 text-xs" />
              </TableCell>
              <TableCell>
                <Input defaultValue={day.morning_activity || ""} onBlur={(e) => updateField(day.id, "morning_activity", e.target.value)} className="h-8 text-xs" />
              </TableCell>
              <TableCell>
                <Input defaultValue={day.afternoon_activity || ""} onBlur={(e) => updateField(day.id, "afternoon_activity", e.target.value)} className="h-8 text-xs" />
              </TableCell>
              <TableCell>
                <Input defaultValue={day.evening_activity || ""} onBlur={(e) => updateField(day.id, "evening_activity", e.target.value)} className="h-8 text-xs" />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(day.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {/* New row */}
          <TableRow className="bg-muted/30">
            <TableCell>
              <Input type="date" value={newDay.day_date} onChange={(e) => setNewDay({ ...newDay, day_date: e.target.value })} className="h-8 text-xs" />
            </TableCell>
            <TableCell>
              <Input value={newDay.city} onChange={(e) => setNewDay({ ...newDay, city: e.target.value })} placeholder="Cidade" className="h-8 text-xs" />
            </TableCell>
            <TableCell>
              <Input value={newDay.morning_activity} onChange={(e) => setNewDay({ ...newDay, morning_activity: e.target.value })} placeholder="Manhã" className="h-8 text-xs" />
            </TableCell>
            <TableCell>
              <Input value={newDay.afternoon_activity} onChange={(e) => setNewDay({ ...newDay, afternoon_activity: e.target.value })} placeholder="Tarde" className="h-8 text-xs" />
            </TableCell>
            <TableCell>
              <Input value={newDay.evening_activity} onChange={(e) => setNewDay({ ...newDay, evening_activity: e.target.value })} placeholder="Noite" className="h-8 text-xs" />
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" onClick={() => addMutation.mutate()}><Plus className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
