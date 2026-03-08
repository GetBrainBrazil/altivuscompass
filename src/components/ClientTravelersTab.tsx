import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ExternalLink, UserPlus, Link2, ArrowUp, ArrowDown, ArrowUpDown, Copy, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type SortDirection = "asc" | "desc" | null;
type SortState = { key: string; direction: SortDirection };

function useSortableData<T>(data: T[], defaultSort?: SortState) {
  const [sort, setSort] = useState<SortState>(defaultSort ?? { key: "", direction: null });

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      if (prev.direction === "desc") return { key: "", direction: null };
      return { key, direction: "asc" };
    });
  };

  const sorted = useMemo(() => {
    if (!sort.direction || !sort.key) return data;
    return [...data].sort((a: any, b: any) => {
      const va = a[sort.key] ?? "";
      const vb = b[sort.key] ?? "";
      const cmp = String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  return { sorted, sort, toggleSort };
}

function SortIcon({ columnKey, sort }: { columnKey: string; sort: SortState }) {
  if (sort.key === columnKey && sort.direction === "asc") return <ArrowUp className="h-3 w-3 ml-1 inline" />;
  if (sort.key === columnKey && sort.direction === "desc") return <ArrowDown className="h-3 w-3 ml-1 inline" />;
  return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
}

const RELATIONSHIP_TYPES: Record<string, string> = {
  spouse: "Cônjuge",
  child: "Filho(a)",
  parent: "Pai/Mãe",
  employee: "Funcionário(a)",
  partner: "Sócio(a)",
  sibling: "Irmão(ã)",
  other: "Outro",
};

type Passenger = {
  id?: string;
  full_name: string;
  birth_date: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  notes: string;
};

interface ClientTravelersTabProps {
  clientId: string | null;
  onNavigateToClient: (clientId: string) => void;
}

export function ClientTravelersTab({ clientId, onNavigateToClient }: ClientTravelersTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Passengers state
  const [passengerDialog, setPassengerDialog] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);
  const [passengerForm, setPassengerForm] = useState<Passenger>({
    full_name: "", birth_date: "", nationality: "", passport_number: "", passport_expiry: "", notes: "",
  });
  const [deletePassengerId, setDeletePassengerId] = useState<string | null>(null);

  // Link client state
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [selectedLinkClient, setSelectedLinkClient] = useState<string | null>(null);
  const [linkRelType, setLinkRelType] = useState<string>("other");
  const [deleteRelId, setDeleteRelId] = useState<string | null>(null);

  // Promote state
  const [promotePassenger, setPromotePassenger] = useState<Passenger | null>(null);
  const [promoteRelType, setPromoteRelType] = useState<string>("child");

  // Copy passengers state
  const [copyDialog, setCopyDialog] = useState(false);
  const [copyClientSearch, setCopyClientSearch] = useState("");
  const [selectedCopyClient, setSelectedCopyClient] = useState<string | null>(null);
  const [copyPassengerIds, setCopyPassengerIds] = useState<Set<string>>(new Set());

  // Fetch passengers
  const { data: passengers = [] } = useQuery({
    queryKey: ["client-passengers", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from("passengers").select("*").eq("client_id", clientId).order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch relationships (bidirectional)
  const { data: relationships = [] } = useQuery({
    queryKey: ["client-relationships", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data: relA } = await supabase
        .from("client_relationships")
        .select("id, relationship_type, relationship_label, client_id_b")
        .eq("client_id_a", clientId);
      const { data: relB } = await supabase
        .from("client_relationships")
        .select("id, relationship_type, relationship_label, client_id_a")
        .eq("client_id_b", clientId);

      const allRels = [
        ...(relA ?? []).map((r: any) => ({ id: r.id, linked_client_id: r.client_id_b, relationship_type: r.relationship_type, relationship_label: r.relationship_label })),
        ...(relB ?? []).map((r: any) => ({ id: r.id, linked_client_id: r.client_id_a, relationship_type: r.relationship_type, relationship_label: r.relationship_label })),
      ];

      // Fetch linked client details
      if (allRels.length === 0) return [];
      const ids = allRels.map((r) => r.linked_client_id);
      const { data: clientsData } = await supabase.from("clients").select("id, full_name, birth_date, nationality, passport_number, city, state").in("id", ids);
      return allRels.map((r) => ({
        ...r,
        client: (clientsData ?? []).find((c: any) => c.id === r.linked_client_id),
      }));
    },
    enabled: !!clientId,
  });

  // Fetch all clients for linking/copy (excluding current)
  const { data: allClients = [] } = useQuery({
    queryKey: ["all-clients-for-link"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, city, state").order("full_name");
      return data ?? [];
    },
    enabled: linkDialog || copyDialog,
  });

  // Fetch passengers of selected copy client
  const { data: copyClientPassengers = [] } = useQuery({
    queryKey: ["copy-client-passengers", selectedCopyClient],
    queryFn: async () => {
      if (!selectedCopyClient) return [];
      const { data, error } = await supabase.from("passengers").select("*").eq("client_id", selectedCopyClient).order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCopyClient && copyDialog,
  });

  const filteredLinkClients = allClients.filter((c: any) => {
    if (c.id === clientId) return false;
    if (relationships.some((r: any) => r.linked_client_id === c.id)) return false;
    if (!linkSearch) return true;
    return c.full_name.toLowerCase().includes(linkSearch.toLowerCase());
  });

  const filteredCopyClients = allClients.filter((c: any) => {
    if (c.id === clientId) return false;
    if (!copyClientSearch) return true;
    return c.full_name.toLowerCase().includes(copyClientSearch.toLowerCase());
  });

  // Save passenger mutation
  const savePassengerMutation = useMutation({
    mutationFn: async () => {
      if (editingPassenger?.id) {
        const { error } = await supabase.from("passengers").update({
          full_name: passengerForm.full_name,
          birth_date: passengerForm.birth_date || null,
          nationality: passengerForm.nationality || null,
          passport_number: passengerForm.passport_number || null,
          passport_expiry: passengerForm.passport_expiry || null,
          notes: passengerForm.notes || null,
        }).eq("id", editingPassenger.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("passengers").insert({
          client_id: clientId!,
          full_name: passengerForm.full_name,
          birth_date: passengerForm.birth_date || null,
          nationality: passengerForm.nationality || null,
          passport_number: passengerForm.passport_number || null,
          passport_expiry: passengerForm.passport_expiry || null,
          notes: passengerForm.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingPassenger?.id ? "Passageiro atualizado" : "Passageiro adicionado" });
      qc.invalidateQueries({ queryKey: ["client-passengers", clientId] });
      setPassengerDialog(false);
      setEditingPassenger(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deletePassengerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("passengers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Passageiro removido" });
      qc.invalidateQueries({ queryKey: ["client-passengers", clientId] });
      setDeletePassengerId(null);
    },
  });

  // Link client mutation
  const linkClientMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLinkClient || !clientId) return;
      const { error } = await supabase.from("client_relationships").insert({
        client_id_a: clientId,
        client_id_b: selectedLinkClient,
        relationship_type: linkRelType as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vínculo criado" });
      qc.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      setLinkDialog(false);
      setSelectedLinkClient(null);
      setLinkSearch("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteRelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_relationships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vínculo removido" });
      qc.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      setDeleteRelId(null);
    },
  });

  // Promote passenger to client
  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!promotePassenger || !clientId) return;
      // Build notes for the new client
      const notesText = promotePassenger.notes
        ? `[Obs. de passageiro]: ${promotePassenger.notes}`
        : null;

      // Create new client
      const { data: newClient, error: clientErr } = await supabase.from("clients").insert({
        full_name: promotePassenger.full_name,
        birth_date: promotePassenger.birth_date || null,
        nationality: promotePassenger.nationality || null,
        passport_number: promotePassenger.passport_number || null,
        passport_status: promotePassenger.passport_number ? "valid" : "none",
        notes: notesText,
      }).select("id").single();
      if (clientErr) throw clientErr;

      // Create relationship
      await supabase.from("client_relationships").insert({
        client_id_a: clientId,
        client_id_b: newClient.id,
        relationship_type: promoteRelType as any,
      });

      // Delete the passenger record
      if (promotePassenger.id) {
        await supabase.from("passengers").delete().eq("id", promotePassenger.id);
      }

      return newClient.id;
    },
    onSuccess: () => {
      toast({ title: "Passageiro promovido a cliente com sucesso!" });
      qc.invalidateQueries({ queryKey: ["client-passengers", clientId] });
      qc.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setPromotePassenger(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Copy passengers mutation
  const copyPassengersMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || copyPassengerIds.size === 0) return;
      const toCopy = copyClientPassengers.filter((p: any) => copyPassengerIds.has(p.id));
      const inserts = toCopy.map((p: any) => ({
        client_id: clientId,
        full_name: p.full_name,
        birth_date: p.birth_date || null,
        nationality: p.nationality || null,
        passport_number: p.passport_number || null,
        passport_expiry: p.passport_expiry || null,
        notes: p.notes || null,
      }));
      const { error } = await supabase.from("passengers").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${copyPassengerIds.size} passageiro(s) copiado(s)` });
      qc.invalidateQueries({ queryKey: ["client-passengers", clientId] });
      setCopyDialog(false);
      setSelectedCopyClient(null);
      setCopyPassengerIds(new Set());
      setCopyClientSearch("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openPassengerForm = (p?: any) => {
    if (p) {
      setEditingPassenger(p);
      setPassengerForm({
        full_name: p.full_name, birth_date: p.birth_date ?? "", nationality: p.nationality ?? "",
        passport_number: p.passport_number ?? "", passport_expiry: p.passport_expiry ?? "", notes: p.notes ?? "",
      });
    } else {
      setEditingPassenger(null);
      setPassengerForm({ full_name: "", birth_date: "", nationality: "", passport_number: "", passport_expiry: "", notes: "" });
    }
    setPassengerDialog(true);
  };

  const sortedRelationships = useMemo(() => {
    return relationships.map((r: any) => ({
      ...r,
      _name: r.client?.full_name ?? "",
      _type: RELATIONSHIP_TYPES[r.relationship_type] || r.relationship_type,
      _birth_date: r.client?.birth_date ?? "",
      _nationality: r.client?.nationality ?? "",
      _passport: r.client?.passport_number ?? "",
    }));
  }, [relationships]);

  const { sorted: sortedPassengers, sort: passengerSort, toggleSort: togglePassengerSort } = useSortableData(passengers);
  const { sorted: sortedRels, sort: relSort, toggleSort: toggleRelSort } = useSortableData(sortedRelationships);

  if (!clientId) {
    return (
      <div className="text-center text-muted-foreground font-body py-8">
        Salve o cliente primeiro para gerenciar viajantes.
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-3">
      {/* ===== PASSAGEIROS ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold font-body text-foreground">Passageiros</h3>
            <p className="text-xs text-muted-foreground font-body">Viajantes vinculados a este cliente (sem ficha própria)</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="font-body text-xs" onClick={() => { setCopyDialog(true); setCopyClientSearch(""); setSelectedCopyClient(null); setCopyPassengerIds(new Set()); }}>
              <Copy className="h-3 w-3 mr-1" />Copiar de outro cliente
            </Button>
            <Button type="button" variant="outline" size="sm" className="font-body text-xs" onClick={() => openPassengerForm()}>
              <Plus className="h-3 w-3 mr-1" />Adicionar
            </Button>
          </div>
        </div>

        {passengers.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body italic">Nenhum passageiro cadastrado.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => togglePassengerSort("full_name")}>Nome<SortIcon columnKey="full_name" sort={passengerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => togglePassengerSort("birth_date")}>Nascimento<SortIcon columnKey="birth_date" sort={passengerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => togglePassengerSort("nationality")}>Nacionalidade<SortIcon columnKey="nationality" sort={passengerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => togglePassengerSort("passport_number")}>Passaporte<SortIcon columnKey="passport_number" sort={passengerSort} /></th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedPassengers.map((p: any) => (
                  <tr key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => openPassengerForm(p)}>
                    <td className="p-3 text-sm font-body text-foreground">{p.full_name}</td>
                    <td className="p-3 text-sm font-body text-foreground">{p.birth_date ? new Date(p.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3 text-sm font-body text-foreground">{p.nationality || "—"}</td>
                    <td className="p-3 text-sm font-body text-foreground">{p.passport_number || "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Promover a Cliente"
                          onClick={(e) => { e.stopPropagation(); setPromotePassenger(p); setPromoteRelType("child"); }}>
                          <UserPlus className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeletePassengerId(p.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== CLIENTES VINCULADOS ===== */}
      <div className="space-y-3 border-t border-border/50 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold font-body text-foreground">Clientes Vinculados</h3>
            <p className="text-xs text-muted-foreground font-body">Clientes com relacionamento (cônjuge, filho, funcionário, etc.)</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="font-body text-xs" onClick={() => { setLinkDialog(true); setLinkSearch(""); setSelectedLinkClient(null); setLinkRelType("other"); }}>
            <Link2 className="h-3 w-3 mr-1" />Vincular Cliente
          </Button>
        </div>

        {relationships.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body italic">Nenhum cliente vinculado.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleRelSort("_name")}>Nome<SortIcon columnKey="_name" sort={relSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleRelSort("_type")}>Vínculo<SortIcon columnKey="_type" sort={relSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleRelSort("_birth_date")}>Nascimento<SortIcon columnKey="_birth_date" sort={relSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleRelSort("_nationality")}>Nacionalidade<SortIcon columnKey="_nationality" sort={relSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleRelSort("_passport")}>Passaporte<SortIcon columnKey="_passport" sort={relSort} /></th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedRels.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => onNavigateToClient(r.linked_client_id)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-body font-medium text-foreground">{r.client?.full_name ?? "—"}</p>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body">
                        {RELATIONSHIP_TYPES[r.relationship_type] || r.relationship_label || r.relationship_type}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-body text-foreground">{r.client?.birth_date ? new Date(r.client.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3 text-sm font-body text-foreground">{r.client?.nationality || "—"}</td>
                    <td className="p-3 text-sm font-body text-foreground">{r.client?.passport_number || "—"}</td>
                    <td className="p-3">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteRelId(r.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Passenger form dialog */}
      <Dialog open={passengerDialog} onOpenChange={(o) => { if (!o) { setPassengerDialog(false); setEditingPassenger(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editingPassenger?.id ? "Editar Passageiro" : "Novo Passageiro"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="font-body text-xs">Nome completo *</Label>
              <Input value={passengerForm.full_name} onChange={(e) => setPassengerForm({ ...passengerForm, full_name: e.target.value })} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Nascimento</Label>
                <Input type="date" value={passengerForm.birth_date} onChange={(e) => setPassengerForm({ ...passengerForm, birth_date: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="font-body text-xs">Nacionalidade</Label>
                <Input value={passengerForm.nationality} onChange={(e) => setPassengerForm({ ...passengerForm, nationality: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">Nº Passaporte</Label>
                <Input value={passengerForm.passport_number} onChange={(e) => setPassengerForm({ ...passengerForm, passport_number: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="font-body text-xs">Validade Passaporte</Label>
                <Input type="date" value={passengerForm.passport_expiry} onChange={(e) => setPassengerForm({ ...passengerForm, passport_expiry: e.target.value })} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Observações</Label>
              <Input value={passengerForm.notes} onChange={(e) => setPassengerForm({ ...passengerForm, notes: e.target.value })} className="h-9" placeholder="Vistos, restrições, etc." />
            </div>
            <Button onClick={() => savePassengerMutation.mutate()} disabled={!passengerForm.full_name || savePassengerMutation.isPending} className="font-body">
              {savePassengerMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link client dialog */}
      <Dialog open={linkDialog} onOpenChange={(o) => { if (!o) setLinkDialog(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Vincular Cliente Existente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="font-body text-xs">Buscar cliente</Label>
              <Input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Nome do cliente..." className="h-9" />
            </div>
            <div className="max-h-48 overflow-y-auto border border-border/50 rounded-lg">
              {filteredLinkClients.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground font-body">Nenhum cliente encontrado.</p>
              ) : (
                filteredLinkClients.slice(0, 20).map((c: any) => (
                  <button key={c.id} type="button"
                    className={`w-full text-left px-3 py-2 text-sm font-body hover:bg-muted/50 transition-colors ${selectedLinkClient === c.id ? "bg-primary/10 text-primary" : "text-foreground"}`}
                    onClick={() => setSelectedLinkClient(c.id)}>
                    <span className="font-medium">{c.full_name}</span>
                    {c.city && <span className="text-xs text-muted-foreground ml-2">{c.city}{c.state ? `, ${c.state}` : ""}</span>}
                  </button>
                ))
              )}
            </div>
            <div>
              <Label className="font-body text-xs">Tipo de vínculo</Label>
              <Select value={linkRelType} onValueChange={setLinkRelType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => linkClientMutation.mutate()} disabled={!selectedLinkClient || linkClientMutation.isPending} className="font-body">
              {linkClientMutation.isPending ? "Vinculando..." : "Vincular"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Promote dialog */}
      <Dialog open={!!promotePassenger} onOpenChange={(o) => { if (!o) setPromotePassenger(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Promover a Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm font-body text-muted-foreground">
              <strong className="text-foreground">{promotePassenger?.full_name}</strong> será promovido a cliente com ficha própria. Seus dados serão copiados automaticamente.
            </p>
            <div>
              <Label className="font-body text-xs">Tipo de vínculo com o cliente atual</Label>
              <Select value={promoteRelType} onValueChange={setPromoteRelType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => promoteMutation.mutate()} disabled={promoteMutation.isPending} className="font-body">
              {promoteMutation.isPending ? "Promovendo..." : "Promover a Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete passenger confirmation */}
      <AlertDialog open={!!deletePassengerId} onOpenChange={(o) => { if (!o) setDeletePassengerId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover passageiro?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePassengerId && deletePassengerMutation.mutate(deletePassengerId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete relationship confirmation */}
      <AlertDialog open={!!deleteRelId} onOpenChange={(o) => { if (!o) setDeleteRelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>O vínculo será removido, mas o cliente não será excluído.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRelId && deleteRelMutation.mutate(deleteRelId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
