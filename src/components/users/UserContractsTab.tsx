import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  clt: "CLT", pj: "PJ", estagio: "Estágio", temporario: "Temporário", freelancer: "Freelancer", outro: "Outro",
};

interface Props { userId: string; }

export default function UserContractsTab({ userId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ contract_type: "clt", start_date: "", end_date: "", notes: "" });
  const [contractFile, setContractFile] = useState<File | null>(null);

  // Compensation state
  const [compOpen, setCompOpen] = useState(false);
  const [compContractId, setCompContractId] = useState<string | null>(null);
  const [compForm, setCompForm] = useState({ description: "", amount: "", start_date: "", end_date: "" });
  const [editingComp, setEditingComp] = useState<any>(null);

  // Document upload state
  const [docContractId, setDocContractId] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["user-contracts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_contracts")
        .select("*")
        .eq("user_id", userId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allCompensations = [] } = useQuery({
    queryKey: ["user-contract-compensations", userId],
    queryFn: async () => {
      const contractIds = contracts.map(c => c.id);
      if (contractIds.length === 0) return [];
      const { data, error } = await supabase
        .from("user_contract_compensations")
        .select("*")
        .in("contract_id", contractIds)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: contracts.length > 0,
  });

  const { data: allDocuments = [] } = useQuery({
    queryKey: ["user-contract-documents", userId],
    queryFn: async () => {
      const contractIds = contracts.map(c => c.id);
      if (contractIds.length === 0) return [];
      const { data, error } = await supabase
        .from("user_contract_documents")
        .select("*")
        .in("contract_id", contractIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: contracts.length > 0,
  });

  async function uploadFile(file: File, path: string) {
    const { error } = await supabase.storage.from("user-documents").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  function getFileUrl(path: string) {
    const { data } = supabase.storage.from("user-documents").getPublicUrl(path);
    return data.publicUrl;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let signed_contract_url = editing?.signed_contract_url ?? null;
      if (contractFile) {
        const ext = contractFile.name.split(".").pop();
        const path = `${userId}/contracts/${Date.now()}.${ext}`;
        signed_contract_url = await uploadFile(contractFile, path);
      }

      const payload = {
        user_id: userId,
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        notes: form.notes || null,
        signed_contract_url,
      };

      if (editing) {
        const { error } = await supabase.from("user_contracts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Contrato atualizado" : "Contrato criado" });
      qc.invalidateQueries({ queryKey: ["user-contracts", userId] });
      setOpen(false);
      setContractFile(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contrato removido" });
      qc.invalidateQueries({ queryKey: ["user-contracts", userId] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saveCompMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        contract_id: compContractId!,
        description: compForm.description,
        amount: compForm.amount ? parseFloat(compForm.amount) : null,
        start_date: compForm.start_date,
        end_date: compForm.end_date || null,
      };
      if (editingComp) {
        const { error } = await supabase.from("user_contract_compensations").update(payload).eq("id", editingComp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_contract_compensations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingComp ? "Remuneração atualizada" : "Remuneração adicionada" });
      qc.invalidateQueries({ queryKey: ["user-contract-compensations", userId] });
      setCompOpen(false);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCompMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_contract_compensations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Remuneração removida" });
      qc.invalidateQueries({ queryKey: ["user-contract-compensations", userId] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop();
      const path = `${userId}/docs/${Date.now()}.${ext}`;
      await uploadFile(file, path);
      const { error } = await supabase.from("user_contract_documents").insert({
        contract_id: docContractId!,
        file_url: path,
        file_name: file.name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Documento anexado" });
      qc.invalidateQueries({ queryKey: ["user-contract-documents", userId] });
      setDocContractId(null);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_contract_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Documento removido" });
      qc.invalidateQueries({ queryKey: ["user-contract-documents", userId] });
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ contract_type: "clt", start_date: "", end_date: "", notes: "" });
    setContractFile(null);
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c);
    setForm({
      contract_type: c.contract_type,
      start_date: c.start_date,
      end_date: c.end_date ?? "",
      notes: c.notes ?? "",
    });
    setContractFile(null);
    setOpen(true);
  }

  function openNewComp(contractId: string) {
    setEditingComp(null);
    setCompContractId(contractId);
    setCompForm({ description: "", amount: "", start_date: "", end_date: "" });
    setCompOpen(true);
  }

  function openEditComp(comp: any) {
    setEditingComp(comp);
    setCompContractId(comp.contract_id);
    setCompForm({
      description: comp.description,
      amount: comp.amount?.toString() ?? "",
      start_date: comp.start_date,
      end_date: comp.end_date ?? "",
    });
    setCompOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold font-body text-foreground">Contratos de Trabalho</h3>
        <Button size="sm" className="font-body" onClick={openNew}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Novo Contrato
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground font-body">Carregando...</p>
      ) : contracts.length === 0 ? (
        <p className="text-sm text-muted-foreground font-body">Nenhum contrato cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {contracts.map((c) => {
            const comps = allCompensations.filter(comp => comp.contract_id === c.id);
            const docs = allDocuments.filter(d => d.contract_id === c.id);
            return (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-body">{CONTRACT_TYPE_LABELS[c.contract_type] ?? c.contract_type}</Badge>
                    <span className="text-sm font-body text-muted-foreground">
                      {format(new Date(c.start_date), "dd/MM/yyyy")}
                      {c.end_date ? ` — ${format(new Date(c.end_date), "dd/MM/yyyy")}` : " — Atual"}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="font-body" onClick={() => openEdit(c)}>Editar</Button>
                </div>

                {c.notes && <p className="text-xs text-muted-foreground font-body">{c.notes}</p>}

                {c.signed_contract_url && (
                  <a href={getFileUrl(c.signed_contract_url)} target="_blank" rel="noreferrer" className="text-xs text-primary underline font-body">📎 Contrato assinado</a>
                )}

                {/* Compensations */}
                <div className="pl-3 border-l-2 border-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold font-body text-muted-foreground uppercase tracking-wide">Remunerações</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs font-body" onClick={() => openNewComp(c.id)}>+ Adicionar</Button>
                  </div>
                  {comps.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-body">Nenhuma remuneração.</p>
                  ) : (
                    comps.map(comp => (
                      <div key={comp.id} className="flex items-center justify-between text-xs font-body bg-muted/30 rounded px-2 py-1">
                        <div>
                          <span className="font-medium">{comp.description}</span>
                          {comp.amount && <span className="text-muted-foreground ml-2">R$ {Number(comp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                          <span className="text-muted-foreground ml-2">
                            {format(new Date(comp.start_date), "dd/MM/yyyy")}
                            {comp.end_date ? ` — ${format(new Date(comp.end_date), "dd/MM/yyyy")}` : ""}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => openEditComp(comp)}>✏️</Button>
                          <Button variant="ghost" size="sm" className="h-5 text-xs px-1 text-destructive" onClick={() => { if (confirm("Remover remuneração?")) deleteCompMutation.mutate(comp.id); }}>✕</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Documents */}
                <div className="pl-3 border-l-2 border-muted space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold font-body text-muted-foreground uppercase tracking-wide">Documentos</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs font-body" onClick={() => { setDocContractId(c.id); docRef.current?.click(); }}>+ Anexar</Button>
                  </div>
                  {docs.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-body">Nenhum documento.</p>
                  ) : (
                    docs.map(d => (
                      <div key={d.id} className="flex items-center justify-between text-xs font-body bg-muted/30 rounded px-2 py-1">
                        <a href={getFileUrl(d.file_url)} target="_blank" rel="noreferrer" className="text-primary underline truncate max-w-[200px]">📄 {d.file_name}</a>
                        <Button variant="ghost" size="sm" className="h-5 text-xs px-1 text-destructive" onClick={() => { if (confirm("Remover documento?")) deleteDocMutation.mutate(d.id); }}>✕</Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input ref={docRef} type="file" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file && docContractId) uploadDocMutation.mutate(file);
        e.target.value = "";
      }} />

      {/* Contract dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label className="font-body">Tipo de Contrato</Label>
              <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-body">Data de Início</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Data de Saída</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Contrato Assinado (anexo)</Label>
              <Button type="button" variant="outline" size="sm" className="font-body" onClick={() => fileRef.current?.click()}>
                {contractFile ? contractFile.name : "Escolher arquivo"}
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="w-full font-body" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
            {editing && (
              <div className="border-t pt-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full text-destructive font-body">Excluir Contrato</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
                      <AlertDialogDescription>Isso removerá o contrato, remunerações e documentos associados.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(editing.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Compensation dialog */}
      <Dialog open={compOpen} onOpenChange={setCompOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editingComp ? "Editar Remuneração" : "Nova Remuneração"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveCompMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label className="font-body">Descrição</Label>
              <Input value={compForm.description} onChange={(e) => setCompForm({ ...compForm, description: e.target.value })} required placeholder="Ex: Salário base, Comissão" />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Valor (R$)</Label>
              <Input type="number" step="0.01" value={compForm.amount} onChange={(e) => setCompForm({ ...compForm, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-body">Início</Label>
                <Input type="date" value={compForm.start_date} onChange={(e) => setCompForm({ ...compForm, start_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Fim</Label>
                <Input type="date" value={compForm.end_date} onChange={(e) => setCompForm({ ...compForm, end_date: e.target.value })} />
              </div>
            </div>
            <Button type="submit" className="w-full font-body" disabled={saveCompMutation.isPending}>
              {saveCompMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
