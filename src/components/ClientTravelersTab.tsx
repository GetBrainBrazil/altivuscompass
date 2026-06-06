import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ExternalLink, UserPlus, Link2, ArrowUp, ArrowDown, ArrowUpDown, Copy, Check } from "lucide-react";
import { isValidCPF, cleanDigits } from "@/lib/validators";
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
  cpf: string;
  birth_date: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  notes: string;
  relationship_type: string;
};

function maskCPF(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

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
    full_name: "", cpf: "", birth_date: "", nationality: "", passport_number: "", passport_expiry: "", notes: "", relationship_type: "",
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
  const [copyPassengerIds, setCopyPassengerIds] = useState<Set<string>>(new Set());

  // Unified "+ Adicionar viajante" state
  const [addDialog, setAddDialog] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  // Pending link confirmation (after selecting a client or passenger from search)
  const [pendingLink, setPendingLink] = useState<
    | { kind: "client"; clientId: string; clientName: string }
    | { kind: "passenger"; passenger: any }
    | null
  >(null);
  const [pendingAtoB, setPendingAtoB] = useState<string>("other"); // current is ___ of selected
  const [pendingBtoA, setPendingBtoA] = useState<string>("other"); // selected is ___ of current


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
      const { data: clientsData } = await supabase.from("clients").select("id, full_name, birth_date, nationality, city, state, cpf_cnpj").in("id", ids);
      
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
      const { data } = await supabase.from("clients").select("id, full_name, city, state, cpf_cnpj, birth_date").order("full_name");
      return data ?? [];
    },
    enabled: linkDialog || copyDialog || addDialog,
  });

  // Current client name (for bidirectional labels)
  const { data: currentClient } = useQuery({
    queryKey: ["client-name", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase.from("clients").select("id, full_name").eq("id", clientId).single();
      return data;
    },
    enabled: !!clientId,
  });



  // Fetch ALL passengers across clients (used by copy dialog).
  // We filter out passengers that already correspond to a client (by CPF or by name+birth_date).
  const { data: allPassengersRaw = [] } = useQuery({
    queryKey: ["all-passengers-cross-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("passengers")
        .select("id, full_name, cpf, birth_date, nationality, passport_number, passport_expiry, notes, client_id, client:clients!passengers_client_id_fkey(id, full_name)")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: copyDialog || addDialog,
  });

  const allPassengersNotClients = useMemo(() => {
    const clientCpfs = new Set(
      (allClients as any[])
        .map((c) => cleanDigits(c.cpf_cnpj))
        .filter((v) => v.length === 11),
    );
    const clientNameBirth = new Set(
      (allClients as any[])
        .filter((c) => c.birth_date && c.full_name)
        .map((c) => `${String(c.full_name).trim().toLowerCase()}|${c.birth_date}`),
    );
    return (allPassengersRaw as any[]).filter((p) => {
      if (clientId && p.client_id === clientId) return false; // não copiar do próprio
      const cpf = cleanDigits(p.cpf);
      if (cpf.length === 11 && clientCpfs.has(cpf)) return false;
      if (p.full_name && p.birth_date) {
        const key = `${String(p.full_name).trim().toLowerCase()}|${p.birth_date}`;
        if (clientNameBirth.has(key)) return false;
      }
      return true;
    });
  }, [allPassengersRaw, allClients, clientId]);

  const filteredLinkClients = allClients.filter((c: any) => {
    if (c.id === clientId) return false;
    if (relationships.some((r: any) => r.linked_client_id === c.id)) return false;
    if (!linkSearch) return true;
    return c.full_name.toLowerCase().includes(linkSearch.toLowerCase());
  });

  const filteredCopyPassengers = useMemo(() => {
    const q = copyClientSearch.trim().toLowerCase();
    if (!q) return allPassengersNotClients;
    return allPassengersNotClients.filter((p: any) => {
      const pname = String(p.full_name || "").toLowerCase();
      const cname = String(p.client?.full_name || "").toLowerCase();
      return pname.includes(q) || cname.includes(q);
    });
  }, [allPassengersNotClients, copyClientSearch]);

  // Save passenger mutation
  const savePassengerMutation = useMutation({
    mutationFn: async () => {
      const updatedData = {
        full_name: passengerForm.full_name,
        cpf: passengerForm.cpf ? passengerForm.cpf : null,
        birth_date: passengerForm.birth_date || null,
        nationality: passengerForm.nationality || null,
        passport_number: passengerForm.passport_number || null,
        passport_expiry: passengerForm.passport_expiry || null,
        notes: passengerForm.notes || null,
        relationship_type: passengerForm.relationship_type || null,
      };

      if (editingPassenger?.id) {
        const { data: oldData } = await supabase.from("passengers").select("*").eq("id", editingPassenger.id).single();
        const { error } = await supabase.from("passengers").update(updatedData).eq("id", editingPassenger.id);
        if (error) throw error;
        logAuditEvent({ action: "update", tableName: "passengers", recordId: editingPassenger.id, recordLabel: updatedData.full_name, oldData, newData: updatedData });

        // Sync copies across other clients
        const oldPassport = editingPassenger.passport_number;
        const oldName = editingPassenger.full_name;
        const oldBirth = editingPassenger.birth_date;

        let matchQuery = supabase.from("passengers").select("id").neq("id", editingPassenger.id);
        if (oldPassport) {
          matchQuery = matchQuery.eq("passport_number", oldPassport);
        } else if (oldBirth) {
          matchQuery = matchQuery.eq("full_name", oldName).eq("birth_date", oldBirth);
        } else {
          matchQuery = null as any;
        }

        if (matchQuery) {
          const { data: matches } = await matchQuery;
          if (matches && matches.length > 0) {
            const ids = matches.map((m: any) => m.id);
            await supabase.from("passengers").update({
              full_name: updatedData.full_name,
              cpf: updatedData.cpf,
              birth_date: updatedData.birth_date,
              nationality: updatedData.nationality,
              passport_number: updatedData.passport_number,
              passport_expiry: updatedData.passport_expiry,
              notes: updatedData.notes,
            }).in("id", ids);
          }
        }
      } else {
        const { data, error } = await supabase.from("passengers").insert({
          client_id: clientId!,
          ...updatedData,
        }).select("id").single();
        if (error) throw error;
        logAuditEvent({ action: "create", tableName: "passengers", recordId: data.id, recordLabel: updatedData.full_name, newData: { client_id: clientId, ...updatedData } });
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
      const { data: oldData } = await supabase.from("passengers").select("*").eq("id", id).single();
      const { error } = await supabase.from("passengers").delete().eq("id", id);
      if (error) throw error;
      logAuditEvent({ action: "delete", tableName: "passengers", recordId: id, recordLabel: oldData?.full_name, oldData });
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
      // Fetch current client name for audit
      const { data: currentClient } = await supabase.from("clients").select("full_name").eq("id", clientId).single();
      const linkedClient = allClients.find((c: any) => c.id === selectedLinkClient);
      const currentName = currentClient?.full_name ?? "Desconhecido";
      const linkedName = linkedClient?.full_name ?? "Desconhecido";
      await logAuditEvent({
        action: "create",
        tableName: "client_relationships",
        recordLabel: `${currentName} ↔ ${linkedName}`,
        newData: {
          vínculo: `${currentName} ↔ ${linkedName}`,
          tipo_relacionamento: linkRelType,
          ficha_origem: currentName,
        },
      });
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
      const rel = relationships.find((r: any) => r.id === id);
      // Fetch current client name for audit
      const { data: currentClient } = await supabase.from("clients").select("full_name").eq("id", clientId!).single();
      const { error } = await supabase.from("client_relationships").delete().eq("id", id);
      if (error) throw error;
      const currentName = currentClient?.full_name ?? "Desconhecido";
      const linkedName = rel?.client?.full_name ?? "Desconhecido";
      await logAuditEvent({
        action: "delete",
        tableName: "client_relationships",
        recordId: id,
        recordLabel: `${currentName} ↔ ${linkedName}`,
        oldData: {
          vínculo: `${currentName} ↔ ${linkedName}`,
          tipo_relacionamento: rel?.relationship_type,
          ficha_origem: currentName,
        },
      });
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
        cpf_cnpj: (promotePassenger as any).cpf ? (promotePassenger as any).cpf : null,
        birth_date: promotePassenger.birth_date || null,
        nationality: promotePassenger.nationality || null,
        notes: notesText,
      }).select("id").single();
      if (clientErr) throw clientErr;
      logAuditEvent({ action: "create", tableName: "clients", recordId: newClient.id, recordLabel: promotePassenger.full_name, newData: { full_name: promotePassenger.full_name, promoted_from_passenger: promotePassenger.id, birth_date: promotePassenger.birth_date, nationality: promotePassenger.nationality } });

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
      let matchQuery = supabase.from("passengers").select("id, client_id, relationship_type");
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

      // Create relationships with OTHER clients that also had this passenger, using their stored relationship_type
      const otherRecords = (allPassengerRecords ?? []).filter((rec: any) => rec.client_id && rec.client_id !== clientId);
      // Deduplicate by client_id, keeping the first match
      const seenClients = new Set<string>();
      const uniqueOtherRecords = otherRecords.filter((rec: any) => {
        if (seenClients.has(rec.client_id)) return false;
        seenClients.add(rec.client_id);
        return true;
      });
      if (uniqueOtherRecords.length > 0) {
        const otherRelInserts = uniqueOtherRecords.map((rec: any) => ({
          client_id_a: rec.client_id,
          client_id_b: newClient.id,
          relationship_type: (rec.relationship_type || 'other') as any,
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
      const toCopy = allPassengersNotClients.filter((p: any) => copyPassengerIds.has(p.id));
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
      qc.invalidateQueries({ queryKey: ["all-passengers-cross-client"] });
      setCopyDialog(false);
      setCopyPassengerIds(new Set());
      setCopyClientSearch("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Unified add traveler: handles linking an existing client OR copying an existing passenger,
  // capturing the bidirectional relationship.
  const addTravelerMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !pendingLink) return;
      if (pendingLink.kind === "client") {
        // Compute custom inverse only if user changed B→A to something other than auto-inverse
        const autoInverse = INVERSE_RELATIONSHIP[pendingAtoB] || "other";
        const customInverse = pendingBtoA !== autoInverse ? pendingBtoA : null;
        const { error } = await supabase.from("client_relationships").insert({
          client_id_a: clientId,
          client_id_b: pendingLink.clientId,
          relationship_type: pendingAtoB as any,
          relationship_label: customInverse,
        });
        if (error) throw error;
        const currentName = currentClient?.full_name ?? "Desconhecido";
        await logAuditEvent({
          action: "create",
          tableName: "client_relationships",
          recordLabel: `${currentName} ↔ ${pendingLink.clientName}`,
          newData: {
            vínculo: `${currentName} ↔ ${pendingLink.clientName}`,
            tipo_relacionamento: pendingAtoB,
            inverso_customizado: customInverse,
            ficha_origem: currentName,
          },
        });
      } else {
        const p = pendingLink.passenger;
        const { error } = await supabase.from("passengers").insert({
          client_id: clientId,
          full_name: p.full_name,
          birth_date: p.birth_date || null,
          nationality: p.nationality || null,
          passport_number: p.passport_number || null,
          passport_expiry: p.passport_expiry || null,
          notes: p.notes || null,
          relationship_type: (pendingBtoA || null) as any,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: pendingLink?.kind === "client" ? "Vínculo criado" : "Passageiro adicionado" });
      qc.invalidateQueries({ queryKey: ["client-relationships", clientId] });
      qc.invalidateQueries({ queryKey: ["client-passengers", clientId] });
      qc.invalidateQueries({ queryKey: ["all-passengers-cross-client"] });
      setPendingLink(null);
      setAddDialog(false);
      setAddSearch("");
      setPendingAtoB("other");
      setPendingBtoA("other");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });



  const openPassengerForm = (p?: any) => {
    if (p) {
      setEditingPassenger(p);
      setPassengerForm({
        full_name: p.full_name, cpf: p.cpf ? maskCPF(p.cpf) : "", birth_date: p.birth_date ?? "", nationality: p.nationality ?? "",
        passport_number: p.passport_number ?? "", passport_expiry: p.passport_expiry ?? "", notes: p.notes ?? "",
        relationship_type: p.relationship_type ?? "",
      });
    } else {
      setEditingPassenger(null);
      setPassengerForm({ full_name: "", cpf: "", birth_date: "", nationality: "", passport_number: "", passport_expiry: "", notes: "", relationship_type: "" });
    }
    setPassengerDialog(true);
  };

  const sortedRelationships = useMemo(() => {
    return relationships.map((r: any) => {
      // When viewed from the inverted side, prefer custom inverse (relationship_label) if set,
      // otherwise fall back to the auto-inverse table.
      const displayType = r.inverted
        ? (r.relationship_label || INVERSE_RELATIONSHIP[r.relationship_type] || r.relationship_type)
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

  // Lista unificada: passageiros + clientes vinculados em uma única tabela
  const unifiedTravelers = useMemo(() => {
    const fromPassengers = passengers.map((p: any) => ({
      _kind: "passenger" as const,
      _id: `p-${p.id}`,
      _raw: p,
      _name: p.full_name ?? "",
      _relType: p.relationship_type ?? "",
      _relLabel: p.relationship_type ? (RELATIONSHIP_TYPES[p.relationship_type] || p.relationship_type) : "",
      _cpf: p.cpf ?? "",
      _birth_date: p.birth_date ?? "",
      _nationality: p.nationality ?? "",
      _passport: p.passport_number ?? "",
    }));
    const fromRels = sortedRelationships.map((r: any) => ({
      _kind: "client" as const,
      _id: `r-${r.id}`,
      _raw: r,
      _name: r._name,
      _relType: r._display_type,
      _relLabel: r._type,
      _cpf: r.client?.cpf_cnpj ?? "",
      _birth_date: r._birth_date,
      _nationality: r._nationality,
      _passport: r._passports,
    }));
    return [...fromRels, ...fromPassengers];
  }, [passengers, sortedRelationships]);

  const { sorted: sortedTravelers, sort: travelerSort, toggleSort: toggleTravelerSort } = useSortableData(unifiedTravelers);

  if (!clientId) {
    return (
      <div className="text-center text-muted-foreground font-body py-8">
        Salve o cliente primeiro para gerenciar viajantes.
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-3">
      {/* ===== VIAJANTES (Passageiros + Clientes Vinculados unificados) ===== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold font-body text-foreground">Viajantes</h3>
            <p className="text-xs text-muted-foreground font-body">Passageiros vinculados a este cliente e clientes com relacionamento (cônjuge, filho, etc.)</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="font-body text-xs" onClick={() => { setAddDialog(true); setAddSearch(""); setPendingLink(null); setPendingAtoB("other"); setPendingBtoA("other"); }}>
                    <Plus className="h-3 w-3 mr-1" />Adicionar viajante
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Comece digitando o nome. O sistema busca entre seus clientes e passageiros existentes — se não encontrar, você cadastra um novo passageiro deste cliente.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {sortedTravelers.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body italic">Nenhum viajante cadastrado.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_name")}>Nome<SortIcon columnKey="_name" sort={travelerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_kind")}>Tipo<SortIcon columnKey="_kind" sort={travelerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_relLabel")}>Vínculo<SortIcon columnKey="_relLabel" sort={travelerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_cpf")}>CPF<SortIcon columnKey="_cpf" sort={travelerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_birth_date")}>Nascimento<SortIcon columnKey="_birth_date" sort={travelerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_nationality")}>Nacionalidade<SortIcon columnKey="_nationality" sort={travelerSort} /></th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body cursor-pointer select-none" onClick={() => toggleTravelerSort("_passport")}>Passaporte<SortIcon columnKey="_passport" sort={travelerSort} /></th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedTravelers.map((t: any) => {
                  if (t._kind === "passenger") {
                    const p = t._raw;
                    return (
                      <tr key={t._id} className="hover:bg-muted/20 cursor-pointer" onClick={() => openPassengerForm(p)}>
                        <td className="p-3 text-sm font-body text-foreground">{p.full_name}</td>
                        <td className="p-3">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-body">
                            Passageiro
                          </span>
                        </td>
                        <td className="p-3">
                          {p.relationship_type ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body">
                              {RELATIONSHIP_TYPES[p.relationship_type] || p.relationship_type}
                            </span>
                          ) : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td className="p-3 text-sm font-body text-foreground">{p.cpf ? maskCPF(p.cpf) : "—"}</td>
                        <td className="p-3 text-sm font-body text-foreground">{p.birth_date ? new Date(p.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-3 text-sm font-body text-foreground">{p.nationality || "—"}</td>
                        <td className="p-3 text-sm font-body text-foreground">{p.passport_number || "—"}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Promover a Cliente"
                              onClick={(e) => { e.stopPropagation(); setPromotePassenger(p); setPromoteRelType(p.relationship_type || "child"); }}>
                              <UserPlus className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir passageiro"
                              onClick={(e) => { e.stopPropagation(); setDeletePassengerId(p.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const r = t._raw;
                  return (
                    <tr key={t._id} className="hover:bg-muted/20 cursor-pointer" onClick={() => { setEditingRel(r); setEditRelType(r._display_type); setEditRelDialog(true); }}>
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
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-body">
                          Cliente
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body">
                          {r._type}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-body text-foreground">{r.client?.cpf_cnpj ? maskCPF(r.client.cpf_cnpj) : "—"}</td>
                      <td className="p-3 text-sm font-body text-foreground">{r.client?.birth_date ? new Date(r.client.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="p-3 text-sm font-body text-foreground">{r.client?.nationality || "—"}</td>
                      <td className="p-3 text-sm font-body text-foreground">{r._passports || "—"}</td>
                      <td className="p-3">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Desvincular cliente"
                          onClick={(e) => { e.stopPropagation(); setDeleteRelId(r.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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
            <div>
              <Label className="font-body text-xs">Vínculo com o cliente</Label>
              <Select value={passengerForm.relationship_type || "none"} onValueChange={(v) => setPassengerForm({ ...passengerForm, relationship_type: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não definido</SelectItem>
                  {Object.entries(RELATIONSHIP_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-body text-xs">CPF</Label>
                <Input
                  value={passengerForm.cpf}
                  onChange={(e) => setPassengerForm({ ...passengerForm, cpf: maskCPF(e.target.value) })}
                  className={`h-9 ${passengerForm.cpf && !isValidCPF(passengerForm.cpf) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                />
                {passengerForm.cpf && !isValidCPF(passengerForm.cpf) && (
                  <p className="text-[11px] text-destructive mt-1 font-body">
                    {cleanDigits(passengerForm.cpf).length < 11 ? "CPF incompleto" : "CPF inválido"}
                  </p>
                )}
              </div>
              <div>
                <Label className="font-body text-xs">Nascimento</Label>
                <Input type="date" value={passengerForm.birth_date} onChange={(e) => setPassengerForm({ ...passengerForm, birth_date: e.target.value })} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="font-body text-xs">Nacionalidade</Label>
              <Input value={passengerForm.nationality} onChange={(e) => setPassengerForm({ ...passengerForm, nationality: e.target.value })} className="h-9" />
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
            <Button onClick={() => savePassengerMutation.mutate()} disabled={!passengerForm.full_name || (!!passengerForm.cpf && !isValidCPF(passengerForm.cpf)) || savePassengerMutation.isPending} className="font-body">
              {savePassengerMutation.isPending ? "Salvando..." : "Salvar"}
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


      <Dialog open={copyDialog} onOpenChange={(o) => { if (!o) { setCopyDialog(false); setCopyPassengerIds(new Set()); setCopyClientSearch(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Copiar passageiro</DialogTitle>
            <DialogDescription className="font-body">
              Apenas passageiros que ainda não foram cadastrados como clientes próprios. O cliente de origem é exibido ao lado de cada passageiro.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="font-body text-xs">Buscar passageiro ou cliente de origem</Label>
              <Input
                value={copyClientSearch}
                onChange={(e) => setCopyClientSearch(e.target.value)}
                placeholder="Nome do passageiro ou cliente..."
                className="h-9"
                autoFocus
              />
            </div>
            {filteredCopyPassengers.length === 0 ? (
              <p className="text-xs text-muted-foreground font-body italic p-3 border border-border/50 rounded-lg">
                Nenhum passageiro disponível para copiar.
              </p>
            ) : (
              <div className="border border-border/50 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="p-2 w-8">
                        <Checkbox
                          checked={copyPassengerIds.size === filteredCopyPassengers.length && filteredCopyPassengers.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCopyPassengerIds(new Set(filteredCopyPassengers.map((p: any) => p.id)));
                            } else {
                              setCopyPassengerIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Passageiro</th>
                      <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Cliente de origem</th>
                      <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Nascimento</th>
                      <th className="text-left p-2 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Passaporte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredCopyPassengers.map((p: any) => (
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
                        <td className="p-2 text-xs font-body text-muted-foreground">{p.client?.full_name || "—"}</td>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
