import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ItineraryForm from "@/components/itineraries/ItineraryForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Itineraries() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: itineraries = [], isLoading } = useQuery({
    queryKey: ["itineraries", sortField, sortDir],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itineraries")
        .select("*, clients(full_name)")
        .order(sortField, { ascending: sortDir === "asc" });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("itineraries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itineraries"] });
      toast({ title: "Roteiro excluído com sucesso" });
      setDeleteId(null);
    },
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = itineraries.filter((i: any) =>
    (i.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (i.destination ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (i.clients?.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Roteiros</h1>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo Roteiro
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar roteiro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("title")}>
                Título <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("destination")}>
                Destino <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("travel_date_start")}>
                Período <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("created_at")}>
                Criado em <ArrowUpDown className="inline h-3 w-3 ml-1" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum roteiro encontrado</TableCell></TableRow>
            ) : (
              filtered.map((item: any) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(item.id)}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell>{item.clients?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    {item.travel_date_start
                      ? `${format(new Date(item.travel_date_start + "T00:00:00"), "dd/MM/yyyy")}${item.travel_date_end ? ` a ${format(new Date(item.travel_date_end + "T00:00:00"), "dd/MM/yyyy")}` : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>{item.traveler_profile ?? "—"}</TableCell>
                  <TableCell>{format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Roteiro" : "Novo Roteiro"}</DialogTitle>
          </DialogHeader>
          <ItineraryForm itineraryId={editingId} onClose={handleClose} onDelete={editingId ? () => { setDialogOpen(false); setDeleteId(editingId); } : undefined} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir roteiro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os dados do roteiro serão excluídos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
