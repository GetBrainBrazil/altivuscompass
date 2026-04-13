import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
        .select("*, clients(full_name), quotes(title, travel_date_start, travel_date_end, price_breakdown, clients(full_name))")
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

  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Roteiros</h1>
        <Button onClick={handleNew} size={isMobile ? "sm" : "default"}>
          <Plus className="h-4 w-4 mr-1 sm:mr-2" /> {isMobile ? "Novo" : "Novo Roteiro"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar roteiro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Mobile: Card view */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhum roteiro encontrado</p>
          ) : (
            filtered.map((item: any) => (
              <div
                key={item.id}
                className="border rounded-lg p-3 bg-card cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors space-y-1.5"
                onClick={() => handleEdit(item.id)}
              >
                <p className="font-medium text-sm text-foreground">{item.title}</p>
                {item.destination && <p className="text-xs text-muted-foreground">{item.destination}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.clients?.full_name && <span>👤 {item.clients.full_name}</span>}
                  {item.arrival_datetime && (
                    <span>📅 {format(new Date(item.arrival_datetime), "dd/MM/yyyy")}</span>
                  )}
                </div>
                {item.quotes && (
                  <p className="text-xs text-muted-foreground truncate">
                    📋 {(() => {
                      const q = item.quotes as any;
                      return q.title || "Cotação vinculada";
                    })()}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Desktop: Table view */
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
                <TableHead className="cursor-pointer" onClick={() => toggleSort("arrival_datetime")}>
                  Período <ArrowUpDown className="inline h-3 w-3 ml-1" />
                </TableHead>
                <TableHead>Cotação</TableHead>
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
                      {item.arrival_datetime
                        ? `${format(new Date(item.arrival_datetime), "dd/MM/yyyy HH:mm")}${item.departure_datetime ? ` a ${format(new Date(item.departure_datetime), "dd/MM/yyyy HH:mm")}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {item.quotes ? (() => {
                        const q = item.quotes as any;
                        const title = q.title || "Sem título";
                        const client = q.clients?.full_name ? ` — ${q.clients.full_name}` : "";
                        const pb = q.price_breakdown as any;
                        const isFlexible = pb?.flexible_dates;
                        let period = "";
                        if (isFlexible && pb?.flexible_dates_description) {
                          period = ` — ${pb.flexible_dates_description}`;
                        } else if (q.travel_date_start) {
                          period = ` — ${format(new Date(q.travel_date_start), "dd/MM/yyyy")}`;
                          if (q.travel_date_end) period += ` a ${format(new Date(q.travel_date_end), "dd/MM/yyyy")}`;
                        }
                        return `${title}${client}${period}`;
                      })() : "—"}
                    </TableCell>
                    <TableCell>{format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="md:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-3 sm:p-4">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-base">{editingId ? "Editar Roteiro" : "Novo Roteiro"}</DialogTitle>
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
