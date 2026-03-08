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

// When viewing from the "other side" of a relationship, invert the label
const INVERSE_RELATIONSHIP: Record<string, string> = {
  child: "parent",
  parent: "child",
  employee: "partner",
  // symmetric relationships stay the same
  spouse: "spouse",
  partner: "partner",
  sibling: "sibling",
  other: "other",
};

type Passenger = {
  id?: string;
  full_name: string;
  birth_date: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  notes: string;
  relationship_type: string;
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
    full_name: "", birth_date: "", nationality: "", passport_number: "", passport_expiry: "", notes: "", relationship_type: "",
  });
  const [deletePassengerId, setDeletePassengerId] = useState<string | null>(null);

  // Link client state
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [selectedLinkClient, setSelectedLinkClient] = useState<string | null>(null);
  const [linkRelType, setLinkRelType] = useState<string>("other");
  const [deleteRelId, setDeleteRelId] = useState<string | null>(null);

  // Edit relationship state
  const [editRelDialog, setEditRelDialog] = useState(false);
  const [editingRel, setEditingRel] = useState<any>(null);
  const [editRelType, setEditRelType] = useState<string>("other");

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

  // Fetch other clients linked to the currently editing passenger
  const { data: passengerLinkedClients = [] } = useQuery({
    queryKey: ["passenger-linked-clients", editingPassenger?.id, editingPassenger?.passport_number, editingPassenger?.full_name, editingPassenger?.birth_date],
    queryFn: async () => {
      if (!editingPassenger?.id) return [];
      let query = supabase.from("passengers").select("client_id, clients!passengers_client_id_fkey(id, full_name)");
      if (editingPassenger.passport_number) {
        query = query.eq("passport_number", editingPassenger.passport_number);
      } else if (editingPassenger.birth_date) {
        query = query.eq("full_name", editingPassenger.full_name).eq("birth_date", editingPassenger.birth_date);
      } else {
        query = query.eq("full_name", editingPassenger.full_name);
      }
      query = query.neq("client_id", clientId!);
      const { data } = await query;
      // Deduplicate by client_id
      const seen = new Set<string>();
      return (data ?? []).filter((r: any) => {
        if (!r.client_id || seen.has(r.client_id)) return false;
        seen.add(r.client_id);
        return true;
      }).map((r: any) => ({ id: r.client_id, full_name: (r.clients as any)?.full_name ?? "—" }));
    },
    enabled: !!editingPassenger?.id && passengerDialog,
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
        // relA: current client is client_id_a, so relationship_type describes client_id_b → use as-is
        ...(relA ?? []).map((r: any) => ({ id: r.id, linked_client_id: r.client_id_b, relationship_type: r.relationship_type, relationship_label: r.relationship_label, inverted: false })),
        // relB: current client is client_id_b, so we need the inverse label
        ...(relB ?? []).map((r: any) => ({ id: r.id, linked_client_id: r.client_id_a, relationship_type: r.relationship_type, relationship_label: r.relationship_label, inverted: true })),
      ];

      // Fetch linked client details
      if (allRels.length === 0) return [];
      const ids = allRels.map((r) => r.linked_client_id);
      const { data: clientsData } = await supabase.from("clients").select("id, full_name, birth_date, nationality, city, state").in("id", ids);
      
      // Fetch valid passports for linked clients
      const today = new Date().toISOString().slice(0, 10);
      const { data: passportsData } = await supabase
        .from("client_passports")
        .select("client_id, passport_number, expiry_date, nationality")
        .in("client_id", ids)
        .gte("expiry_date", today);

      return allRels.map((r) => ({
        ...r,
        client: (clientsData ?? []).find((c: any) => c.id === r.linked_client_id),
        passports: (passportsData ?? []).filter((p: any) => p.client_id === r.linked_client_id),
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
      const updatedData = {
        full_name: passengerForm.full_name,
        birth_date: passengerForm.birth_date || null,
        nationality: passengerForm.nationality || null,
        passport_number: passengerForm.passport_number || null,
        passport_expiry: passengerForm.passport_expiry || null,
        notes: passengerForm.notes || null,
        relationship_type: passengerForm.relationship_type || null,
      };

      if (editingPassenger?.id) {
        // Save current passenger
        const { error } = await supabase.from("passengers").update(updatedData).eq("id", editingPassenger.id);
        if (error) throw error;

        // Sync copies across other clients: find matching passengers by passport or name+birth_date
        const oldPassport = editingPassenger.passport_number;
        const oldName = editingPassenger.full_name;
        const oldBirth = editingPassenger.birth_date;

        let matchQuery = supabase.from("passengers").select("id").neq("id", editingPassenger.id);
        if (oldPassport) {
          matchQuery = matchQuery.eq("passport_number", oldPassport);
        } else if (oldBirth) {
          matchQuery = matchQuery.eq("full_name", oldName).eq("birth_date", oldBirth);
        } else {
          // No reliable match — skip sync
          matchQuery = null as any;
        }

        if (matchQuery) {
          const { data: matches } = await matchQuery;
          if (matches && matches.length > 0) {
            const ids = matches.map((m: any) => m.id);
            // Update all copies with the same data
            await supabase.from("passengers").update({
              full_name: updatedData.full_name,
              birth_date: updatedData.birth_date,
              nationality: updatedData.nationality,
              passport_number: updatedData.passport_number,
              passport_expiry: updatedData.passport_expiry,
              notes: updatedData.notes,
            }).in("id", ids);
          }
        }
      } else {
        const { error } = await supabase.from("passengers").insert({
          client_id: clientId!,
          ...updatedData,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingPassenger?.id ? "Passageiro atualizado" : "Passageiro adicionado" });
      qc.invalidateQueries({ queryKey: ["client-passengers", clientId] });
      qc.invalidateQueries({ queryKey: ["all-passengers-for-search"] });
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

  // Update relationship type mutation
  const updateRelMutation = useMutation({
    mutationFn: async ({ id, type, inverted }: { id: string; type: string; inverted: boolean }) => {
      // If viewing from the inverted side, store the inverse type in DB
      const dbType = inverted ? (INVERSE_RELATIONSHIP[type] || type) : type;
      const { error } = await supabase.from("client_relationships").update({ relationship_type: dbType as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vínculo atualizado" });
      qc.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      setEditRelDialog(false);
      setEditingRel(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });


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
        notes: notesText,
      }).select("id").single();
      if (clientErr) throw clientErr;

      // Create passport record if passenger had passport data
      if (promotePassenger.passport_number) {
        await supabase.from("client_passports").insert({
          client_id: newClient.id,
          passport_number: promotePassenger.passport_number,
          nationality: promotePassenger.nationality || null,
          expiry_date: promotePassenger.passport_expiry || null,
          status: "valid",
        });
      }

      // Find ALL clients that have this same passenger (copies)
      // Use passport_number as primary identifier; fallback to name + birth_date
      let matchQuery = supabase.from("passengers").select("id, client_id");
      if (promotePassenger.passport_number) {
        matchQuery = matchQuery.eq("passport_number", promotePassenger.passport_number);
      } else if (promotePassenger.birth_date) {
        matchQuery = matchQuery.eq("full_name", promotePassenger.full_name).eq("birth_date", promotePassenger.birth_date);
      } else {
        // No reliable match criteria beyond current record
        matchQuery = matchQuery.eq("id", promotePassenger.id!);
      }
      const { data: allPassengerRecords } = await matchQuery;

      // Collect unique client IDs that had this passenger (for cleanup)
      const passengerIdsToDelete: string[] = [];
      (allPassengerRecords ?? []).forEach((rec: any) => {
        passengerIdsToDelete.push(rec.id);
      });

      // Create relationship with the current client (the one initiating the promotion)
      await supabase.from("client_relationships").insert({
        client_id_a: clientId,
        client_id_b: newClient.id,
        relationship_type: promoteRelType as any,
      });

      // Create relationships with OTHER clients that also had this passenger, with type 'other' (não definido)
      const otherClientIds = [...new Set(
        (allPassengerRecords ?? [])
          .map((rec: any) => rec.client_id)
          .filter((cid: string) => cid && cid !== clientId)
      )];
      if (otherClientIds.length > 0) {
        const otherRelInserts = otherClientIds.map((cid: string) => ({
          client_id_a: cid,
          client_id_b: newClient.id,
          relationship_type: 'other' as any,
        }));
        await supabase.from("client_relationships").insert(otherRelInserts);
      }

      // Delete all matched passenger records
      if (passengerIdsToDelete.length > 0) {
        await supabase.from("passengers").delete().in("id", passengerIdsToDelete);
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
        relationship_type: p.relationship_type ?? "",
      });
    } else {
      setEditingPassenger(null);
      setPassengerForm({ full_name: "", birth_date: "", nationality: "", passport_number: "", passport_expiry: "", notes: "", relationship_type: "" });
    }
    setPassengerDialog(true);
  };

  const sortedRelationships = useMemo(() => {
    return relationships.map((r: any) => {
      const displayType = r.inverted
        ? (INVERSE_RELATIONSHIP[r.relationship_type] || r.relationship_type)
        : r.relationship_type;
      return {
        ...r,
        _name: r.client?.full_name ?? "",
        _display_type: displayType,
        _type: RELATIONSHIP_TYPES[displayType] || displayType,
        _birth_date: r.client?.birth_date ?? "",
        _nationality: r.client?.nationality ?? "",
        _passports: (r.passports ?? []).map((p: any) => p.passport_number).filter(Boolean).join(", "),
      };
    });
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
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => togglePassengerSort("relationship_type")}>Vínculo<SortIcon columnKey="relationship_type" sort={passengerSort} /></th>
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
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleRelSort("_passports")}>Passaporte(s) válido(s)<SortIcon columnKey="_passports" sort={relSort} /></th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedRels.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => { setEditingRel(r); setEditRelType(r._display_type); setEditRelDialog(true); }}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-sm font-body font-medium text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); onNavigateToClient(r.linked_client_id); }}
                        >
                          {r.client?.full_name ?? "—"}
                        </button>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body">
                        {r._type}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-body text-foreground">{r.client?.birth_date ? new Date(r.client.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3 text-sm font-body text-foreground">{r.client?.nationality || "—"}</td>
                    <td className="p-3 text-sm font-body text-foreground">{r._passports || "—"}</td>
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
                <Input value={passengerForm.passport_number} onChange={(e) => setPassengerForm({ ...passengerForm, passport_number: e.target.value.toUpperCase() })} className="h-9" />
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
            {editingPassenger?.id && passengerLinkedClients.length > 0 && (
              <div className="border-t border-border/50 pt-3 mt-1">
                <Label className="font-body text-xs text-muted-foreground">Também vinculado a:</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {passengerLinkedClients.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-body text-primary hover:underline"
                      onClick={() => { setPassengerDialog(false); setEditingPassenger(null); onNavigateToClient(c.id); }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {c.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

      {/* Edit relationship dialog */}
      <Dialog open={editRelDialog} onOpenChange={(o) => { if (!o) { setEditRelDialog(false); setEditingRel(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Vínculo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm font-body text-muted-foreground">
              Vínculo com <strong className="text-foreground">{editingRel?.client?.full_name}</strong>
            </p>
            <div>
              <Label className="font-body text-xs">Tipo de vínculo</Label>
              <Select value={editRelType} onValueChange={setEditRelType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => editingRel && updateRelMutation.mutate({ id: editingRel.id, type: editRelType, inverted: !!editingRel.inverted })} disabled={updateRelMutation.isPending} className="font-body">
              {updateRelMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Dialog open={copyDialog} onOpenChange={(o) => { if (!o) { setCopyDialog(false); setSelectedCopyClient(null); setCopyPassengerIds(new Set()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Copiar Passageiros de Outro Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {!selectedCopyClient ? (
              <>
                <div>
                  <Label className="font-body text-xs">Buscar cliente de origem</Label>
                  <Input value={copyClientSearch} onChange={(e) => setCopyClientSearch(e.target.value)} placeholder="Nome do cliente..." className="h-9" />
                </div>
                <div className="max-h-48 overflow-y-auto border border-border/50 rounded-lg">
                  {filteredCopyClients.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground font-body">Nenhum cliente encontrado.</p>
                  ) : (
                    filteredCopyClients.slice(0, 20).map((c: any) => (
                      <button key={c.id} type="button"
                        className="w-full text-left px-3 py-2 text-sm font-body hover:bg-muted/50 transition-colors text-foreground"
                        onClick={() => { setSelectedCopyClient(c.id); setCopyPassengerIds(new Set()); }}>
                        <span className="font-medium">{c.full_name}</span>
                        {c.city && <span className="text-xs text-muted-foreground ml-2">{c.city}{c.state ? `, ${c.state}` : ""}</span>}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-body text-muted-foreground">
                    Passageiros de <strong className="text-foreground">{allClients.find((c: any) => c.id === selectedCopyClient)?.full_name}</strong>
                  </p>
                  <Button type="button" variant="ghost" size="sm" className="font-body text-xs" onClick={() => { setSelectedCopyClient(null); setCopyPassengerIds(new Set()); }}>
                    Trocar cliente
                  </Button>
                </div>
                {copyClientPassengers.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-body italic p-3">Este cliente não possui passageiros.</p>
                ) : (
                  <div className="border border-border/50 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="p-2 w-8">
                            <Checkbox
                              checked={copyPassengerIds.size === copyClientPassengers.length && copyClientPassengers.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCopyPassengerIds(new Set(copyClientPassengers.map((p: any) => p.id)));
                                } else {
                                  setCopyPassengerIds(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Nome</th>
                          <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Nascimento</th>
                          <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Passaporte</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {copyClientPassengers.map((p: any) => (
                          <tr key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => {
                            setCopyPassengerIds(prev => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                              return next;
                            });
                          }}>
                            <td className="p-2">
                              <Checkbox checked={copyPassengerIds.has(p.id)} onCheckedChange={() => {
                                setCopyPassengerIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                                  return next;
                                });
                              }} />
                            </td>
                            <td className="p-2 text-sm font-body text-foreground">{p.full_name}</td>
                            <td className="p-2 text-sm font-body text-foreground">{p.birth_date ? new Date(p.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                            <td className="p-2 text-sm font-body text-foreground">{p.passport_number || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <Button
                  onClick={() => copyPassengersMutation.mutate()}
                  disabled={copyPassengerIds.size === 0 || copyPassengersMutation.isPending}
                  className="font-body"
                >
                  {copyPassengersMutation.isPending ? "Copiando..." : `Copiar ${copyPassengerIds.size} passageiro(s)`}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
