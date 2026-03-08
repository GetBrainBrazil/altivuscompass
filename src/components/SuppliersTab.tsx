import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logAuditEvent } from "@/lib/audit";
import { ArrowUp, ArrowDown, ArrowUpDown, Info } from "lucide-react";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

function SortableHead({ label, sortKey, sort, onSort, className }: { label: string; sortKey: string; sort: SortState; onSort: (k: string) => void; className?: string }) {
  const active = sort?.key === sortKey;
  return (
    <TableHead className={`cursor-pointer select-none hover:text-foreground ${className || ""}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />}
      </span>
    </TableHead>
  );
}

function sortData<T extends Record<string, any>>(data: T[], sort: SortState): T[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const va = (a[sort.key] ?? "").toString().toLowerCase();
    const vb = (b[sort.key] ?? "").toString().toLowerCase();
    return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}

function toggleSort(sort: SortState, key: string): SortState {
  if (sort?.key === key) {
    if (sort.dir === "asc") return { key, dir: "desc" };
    return null;
  }
  return { key, dir: "asc" };
}

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

async function fetchCep(cep: string) {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { address_street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" };
  } catch { return null; }
}

const SUPPLIER_CATEGORIES: { label: string; description: string }[] = [
  { label: "Transporte", description: "Passagens aéreas, trem, ônibus, cruzeiros, transfer e aluguel de carros." },
  { label: "Hospedagem", description: "Hotéis, resorts, pousadas, apartamentos, villas e cruzeiros." },
  { label: "Passeios e Experiências", description: "Tours, guias, ingressos para atrações, eventos, atividades e experiências locais." },
  { label: "Documentação de Viagem", description: "Vistos, passaporte, traduções e assessoria migratória." },
  { label: "Seguros e Assistência", description: "Seguro viagem, assistência médica internacional e coberturas adicionais." },
  { label: "Serviços no Destino", description: "Receptivo, concierge, transfers locais, apoio ao viajante." },
  { label: "Tecnologia e Distribuição", description: "GDS, consolidadores de passagens, plataformas de reservas." },
  { label: "Outro", description: "Outros serviços não listados." },
];

const emptyForm = {
  name: "", trade_name: "", document_number: "", supplier_type: "company", categories: [] as string[],
  email: "", phone: "", website: "", contact_person: "", contact_phone: "",
  cep: "", address_street: "", address_number: "", address_complement: "",
  neighborhood: "", city: "", state: "", country: "Brasil", notes: "", is_active: true,
};

export default function SuppliersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [sort, setSort] = useState<SortState>(null);
  const [loadingCep, setLoadingCep] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        phone: form.phone.replace(/\D/g, "") || null,
        contact_phone: form.contact_phone.replace(/\D/g, "") || null,
        document_number: form.document_number || null,
        trade_name: form.trade_name || null,
        email: form.email || null,
        website: form.website || null,
        contact_person: form.contact_person || null,
        cep: form.cep || null,
        address_street: form.address_street || null,
        address_number: form.address_number || null,
        address_complement: form.address_complement || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        notes: form.notes || null,
        category: form.categories.length > 0 ? form.categories : null,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload as any).eq("id", editing.id);
        if (error) throw error;
        await logAuditEvent({ action: "update", tableName: "suppliers", recordId: editing.id, recordLabel: payload.name, oldData: editing, newData: payload });
      } else {
        const { data, error } = await supabase.from("suppliers").insert(payload as any).select("id").single();
        if (error) throw error;
        await logAuditEvent({ action: "create", tableName: "suppliers", recordId: data.id, recordLabel: payload.name, newData: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: editing ? "Fornecedor atualizado" : "Fornecedor adicionado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = suppliers.find((s: any) => s.id === id);
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      await logAuditEvent({ action: "delete", tableName: "suppliers", recordId: id, recordLabel: item?.name ?? id, oldData: item });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Fornecedor removido" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ ...emptyForm }); };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name ?? "", trade_name: s.trade_name ?? "", document_number: s.document_number ?? "",
      supplier_type: s.supplier_type ?? "company", categories: Array.isArray(s.category) ? s.category : (s.category ? [s.category] : []),
      email: s.email ?? "", phone: s.phone ?? "", website: s.website ?? "",
      contact_person: s.contact_person ?? "", contact_phone: s.contact_phone ?? "",
      cep: s.cep ?? "", address_street: s.address_street ?? "", address_number: s.address_number ?? "",
      address_complement: s.address_complement ?? "", neighborhood: s.neighborhood ?? "",
      city: s.city ?? "", state: s.state ?? "", country: s.country ?? "Brasil",
      notes: s.notes ?? "", is_active: s.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleCepBlur = async () => {
    if (!form.cep || form.country !== "Brasil") return;
    setLoadingCep(true);
    const data = await fetchCep(form.cep);
    if (data) setForm(f => ({ ...f, ...data }));
    setLoadingCep(false);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const filtered = sortData(
    suppliers.filter((s: any) =>
      [s.name, s.trade_name, s.email, s.category, s.city, s.contact_person]
        .some(f => f?.toLowerCase().includes(search.toLowerCase()))
    ),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else { setEditing(null); setForm({ ...emptyForm }); setDialogOpen(true); } }}>
            <DialogTrigger asChild>
              <Button size="sm">+ Fornecedor</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle className="font-display">{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
              <Tabs defaultValue="dados" className="w-full">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="dados" className="font-body text-xs">Dados</TabsTrigger>
                  <TabsTrigger value="contato" className="font-body text-xs">Contato</TabsTrigger>
                  <TabsTrigger value="endereco" className="font-body text-xs">Endereço</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">Razão Social <span className="text-destructive">*</span></Label>
                      <Input value={form.name} onChange={set("name")} placeholder="Nome da empresa" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">Nome Fantasia</Label>
                      <Input value={form.trade_name} onChange={set("trade_name")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">CNPJ/CPF</Label>
                      <Input value={form.document_number} onChange={set("document_number")} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="font-body">Serviços</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs font-body space-y-1 p-3">
                            {SUPPLIER_CATEGORIES.filter(c => c.label !== "Outro").map(c => (
                              <div key={c.label}><span className="font-semibold">{c.label}:</span> {c.description}</div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal h-auto min-h-10 text-left">
                            {form.categories.length > 0
                              ? <div className="flex flex-wrap gap-1">{form.categories.map(c => <Badge key={c} variant="secondary" className="text-xs font-body">{c}</Badge>)}</div>
                              : <span className="text-muted-foreground">Selecione os serviços</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2" align="start">
                          {SUPPLIER_CATEGORIES.map(c => (
                            <label key={c.label} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm font-body">
                              <Checkbox
                                checked={form.categories.includes(c.label)}
                                onCheckedChange={(checked) => {
                                  setForm(f => ({
                                    ...f,
                                    categories: checked ? [...f.categories, c.label] : f.categories.filter(x => x !== c.label),
                                  }));
                                }}
                              />
                              {c.label}
                            </label>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Website</Label>
                    <Input value={form.website} onChange={set("website")} placeholder="https://" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Observações</Label>
                    <Textarea value={form.notes} onChange={set("notes")} rows={3} />
                  </div>
                  {editing && (
                    <div className="flex items-center gap-3">
                      <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
                      <Label className="font-body">{form.is_active ? "Ativo" : "Inativo"}</Label>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="contato" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">E-mail</Label>
                      <Input type="email" value={form.email} onChange={set("email")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">Telefone</Label>
                      <Input value={formatPhone(form.phone)} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="(11) 99999-9999" />
                    </div>
                  </div>
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="text-sm font-semibold font-body text-foreground">Pessoa de Contato</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="font-body">Nome</Label>
                        <Input value={form.contact_person} onChange={set("contact_person")} />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-body">Telefone</Label>
                        <Input value={formatPhone(form.contact_phone)} onChange={(e) => setForm(f => ({ ...f, contact_phone: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="(11) 99999-9999" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="endereco" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">CEP</Label>
                      <Input value={form.cep} onChange={set("cep")} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} />
                      {loadingCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">País</Label>
                      <Input value={form.country} onChange={set("country")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2 col-span-2">
                      <Label className="font-body">Endereço</Label>
                      <Input value={form.address_street} onChange={set("address_street")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">Número</Label>
                      <Input value={form.address_number} onChange={set("address_number")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">Complemento</Label>
                      <Input value={form.address_complement} onChange={set("address_complement")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">Bairro</Label>
                      <Input value={form.neighborhood} onChange={set("neighborhood")} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="font-body">Cidade</Label>
                      <Input value={form.city} onChange={set("city")} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-body">Estado</Label>
                      <Input value={form.state} onChange={set("state")} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col gap-3 mt-4">
                <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full font-body">
                  {saveMutation.isPending ? "Salvando..." : editing ? "Salvar Alterações" : "Adicionar Fornecedor"}
                </Button>

                {editing && (
                  <div className="border-t pt-3">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" className="w-full text-destructive hover:text-destructive font-body">
                          Excluir Fornecedor
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{editing.name}</strong>? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(editing.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} fornecedor(es)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <TableHead>Serviços</TableHead>
                <SortableHead label="Cidade" sortKey="city" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} className="hidden sm:table-cell" />
                <SortableHead label="Contato" sortKey="contact_person" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} className="hidden md:table-cell" />
                <TableHead className="w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum fornecedor encontrado.</TableCell></TableRow>
              ) : (
                filtered.slice(0, 100).map((s: any) => (
                  <TableRow key={s.id} className={`cursor-pointer hover:bg-muted/50 ${isAdmin ? "" : ""}`} onClick={() => isAdmin && openEdit(s)}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{s.name}</span>
                        {s.trade_name && <span className="text-xs text-muted-foreground ml-2">({s.trade_name})</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {Array.isArray(s.category) && s.category.length > 0
                        ? <div className="flex flex-wrap gap-1">{s.category.map((c: string) => <Badge key={c} variant="secondary" className="font-body text-xs">{c}</Badge>)}</div>
                        : <span className="text-muted-foreground">—</span>}

                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{s.city || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{s.contact_person || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "outline"} className="font-body text-xs">
                        {s.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filtered.length > 100 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Mostrando 100 de {filtered.length}. Use a busca para refinar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
