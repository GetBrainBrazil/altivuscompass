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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logAuditEvent } from "@/lib/audit";
import { ArrowUp, ArrowDown, ArrowUpDown, ArrowLeft, Info, Plus, Trash2 } from "lucide-react";
import { COUNTRY_CODES, applyPhoneMask, stripMask } from "@/lib/phone-masks";

type SupplierPhone = { id?: string; phone: string; country_code: string; description: string; is_primary?: boolean };
type SupplierEmail = { id?: string; email: string; description: string; is_primary?: boolean };

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
  name: "", legal_name: "", trade_name: "", document_number: "", supplier_type: "company", categories: [] as string[],
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
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [phones, setPhones] = useState<SupplierPhone[]>([]);
  const [emails, setEmails] = useState<SupplierEmail[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [shouldGoBack, setShouldGoBack] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const goBack = () => {
    setView("list");
    setEditing(null);
    setForm({ ...emptyForm });
    setPhones([]);
    setEmails([]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { categories, ...rest } = form;
      const payload = {
        ...rest,
        phone: form.phone.replace(/\D/g, "") || null,
        contact_phone: form.contact_phone.replace(/\D/g, "") || null,
        document_number: form.document_number || null,
        legal_name: form.legal_name || null,
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
      let supplierId: string;
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload as any).eq("id", editing.id);
        if (error) throw error;
        supplierId = editing.id;
        await logAuditEvent({ action: "update", tableName: "suppliers", recordId: editing.id, recordLabel: payload.name, oldData: editing, newData: payload });
      } else {
        const { data, error } = await supabase.from("suppliers").insert(payload as any).select("id").single();
        if (error) throw error;
        supplierId = data.id;
        await logAuditEvent({ action: "create", tableName: "suppliers", recordId: data.id, recordLabel: payload.name, newData: payload });
      }
      // Save phones
      await supabase.from("supplier_phones").delete().eq("supplier_id", supplierId);
      const validPhones = phones.filter(p => stripMask(p.phone).length > 0);
      if (validPhones.length > 0) {
        const cc_map = (code: string) => COUNTRY_CODES.find(c => c.code === code)?.dial || "+55";
        const { error } = await supabase.from("supplier_phones").insert(
          validPhones.map(p => ({ supplier_id: supplierId, phone: stripMask(p.phone), country_code: cc_map(p.country_code), description: p.description || null })) as any
        );
        if (error) throw error;
      }
      // Save emails
      await supabase.from("supplier_emails").delete().eq("supplier_id", supplierId);
      const validEmails = emails.filter(e => e.email.trim().length > 0);
      if (validEmails.length > 0) {
        const { error } = await supabase.from("supplier_emails").insert(
          validEmails.map(e => ({ supplier_id: supplierId, email: e.email.trim(), description: e.description || null })) as any
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: editing ? "Fornecedor atualizado" : "Fornecedor adicionado" });
      if (shouldGoBack) goBack();
      setShouldGoBack(false);
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
      goBack();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setPhones([]);
    setEmails([]);
    setView("form");
  };

  const openEdit = async (s: any) => {
    setEditing(s);
    setForm({
      name: s.name ?? "", legal_name: s.legal_name ?? "", trade_name: s.trade_name ?? "", document_number: s.document_number ?? "",
      supplier_type: s.supplier_type ?? "company", categories: Array.isArray(s.category) ? s.category : (s.category ? [s.category] : []),
      email: s.email ?? "", phone: s.phone ?? "", website: s.website ?? "",
      contact_person: s.contact_person ?? "", contact_phone: s.contact_phone ?? "",
      cep: s.cep ?? "", address_street: s.address_street ?? "", address_number: s.address_number ?? "",
      address_complement: s.address_complement ?? "", neighborhood: s.neighborhood ?? "",
      city: s.city ?? "", state: s.state ?? "", country: s.country ?? "Brasil",
      notes: s.notes ?? "", is_active: s.is_active ?? true,
    });
    const [phonesRes, emailsRes] = await Promise.all([
      supabase.from("supplier_phones").select("*").eq("supplier_id", s.id).order("created_at"),
      supabase.from("supplier_emails").select("*").eq("supplier_id", s.id).order("created_at"),
    ]);
    setPhones((phonesRes.data ?? []).map((p: any) => ({ id: p.id, phone: p.phone, country_code: COUNTRY_CODES.find(c => c.dial === p.country_code)?.code || "BR", description: p.description || "", is_primary: false })));
    setEmails((emailsRes.data ?? []).map((e: any) => ({ id: e.id, email: e.email, description: e.description || "", is_primary: false })));
    setView("form");
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

  // ── Form View ──
  if (view === "form") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-display font-semibold">{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
        </div>

        {/* Main fields */}
        <div className="bg-card rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="font-body text-xs">Tipo</Label>
              <Select value={form.supplier_type} onValueChange={(v) => setForm(f => ({ ...f, supplier_type: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Pessoa Jurídica</SelectItem>
                  <SelectItem value="individual">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="font-body text-xs">Nome <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={set("name")} placeholder="Nome do fornecedor" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="font-body text-xs">{form.supplier_type === "company" ? "CNPJ" : "CPF"}</Label>
              <Input value={form.document_number} onChange={set("document_number")} placeholder={form.supplier_type === "company" ? "00.000.000/0000-00" : "000.000.000-00"} className="h-9" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="font-body text-xs">{form.supplier_type === "company" ? "Razão Social" : "Nome Social"}</Label>
              <Input value={form.legal_name} onChange={set("legal_name")} className="h-9" />
            </div>
            {form.supplier_type === "company" && (
              <div className="space-y-1">
                <Label className="font-body text-xs">Nome Fantasia</Label>
                <Input value={form.trade_name} onChange={set("trade_name")} className="h-9" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="font-body text-xs">Website</Label>
              <Input value={form.website} onChange={set("website")} placeholder="https://" className="h-9" />
            </div>
            {editing ? (
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
                <Label className="font-body text-xs">{form.is_active ? "Ativo" : "Inativo"}</Label>
              </div>
            ) : <div />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="font-body text-xs">Serviços</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
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
                  <Button variant="outline" className="w-full justify-start font-normal h-auto min-h-9 text-left text-xs">
                    {form.categories.length > 0
                      ? <div className="flex flex-wrap gap-1">{form.categories.map(c => <Badge key={c} variant="secondary" className="text-[10px] font-body px-1.5 py-0">{c}</Badge>)}</div>
                      : <span className="text-muted-foreground">Selecione</span>}
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
            <div className="space-y-1">
              <Label className="font-body text-xs">Observações</Label>
              <Textarea value={form.notes} onChange={set("notes")} rows={2} className="text-sm" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="contato" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="contato" className="font-body text-xs">Contato</TabsTrigger>
            <TabsTrigger value="endereco" className="font-body text-xs">Endereço</TabsTrigger>
          </TabsList>

          <TabsContent value="contato" className="space-y-4 mt-3">
            {/* Telefones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body text-xs font-medium">Celulares / Telefones</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setPhones(p => [...p, { phone: "", country_code: "BR", description: "", is_primary: false }])}>
                  <Plus className="h-3 w-3 mr-1" />Adicionar
                </Button>
              </div>
              {phones.map((p, i) => {
                const cc = COUNTRY_CODES.find(c => c.code === p.country_code) || COUNTRY_CODES[0];
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <Checkbox checked={phones.length === 1 || p.is_primary} onCheckedChange={() => setPhones(ps => ps.map((x, j) => ({ ...x, is_primary: j === i })))} className="shrink-0" title="Principal" />
                    <Select value={p.country_code} onValueChange={(v) => setPhones(ps => ps.map((x, j) => j === i ? { ...x, country_code: v, phone: "" } : x))}>
                      <SelectTrigger className="w-28 h-9 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.dial}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-40 h-9 shrink-0"
                      placeholder={cc.mask.replace(/#/g, "0")}
                      value={applyPhoneMask(p.phone, cc.mask)}
                      onChange={(e) => setPhones(ps => ps.map((x, j) => j === i ? { ...x, phone: stripMask(e.target.value) } : x))}
                    />
                    <Input className="flex-1 h-9" placeholder="Descrição" value={p.description} onChange={(e) => setPhones(ps => ps.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setPhones(ps => ps.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Emails */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body text-xs font-medium">E-mails</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setEmails(e => [...e, { email: "", description: "", is_primary: false }])}>
                  <Plus className="h-3 w-3 mr-1" />Adicionar
                </Button>
              </div>
              {emails.map((em, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Checkbox checked={emails.length === 1 || em.is_primary} onCheckedChange={() => setEmails(es => es.map((x, j) => ({ ...x, is_primary: j === i })))} className="shrink-0" title="Principal" />
                  <Input className="w-72 h-9 shrink-0" type="email" placeholder="E-mail" value={em.email} onChange={(e) => setEmails(es => es.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                  <Input className="flex-1 h-9" placeholder="Descrição" value={em.description} onChange={(e) => setEmails(es => es.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setEmails(es => es.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="endereco" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="font-body text-xs">CEP</Label>
                <Input value={form.cep} onChange={set("cep")} onBlur={handleCepBlur} placeholder="00000-000" maxLength={9} className="h-9" />
                {loadingCep && <p className="text-[10px] text-muted-foreground">Buscando...</p>}
              </div>
              <div className="space-y-1">
                <Label className="font-body text-xs">País</Label>
                <Input value={form.country} onChange={set("country")} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="font-body text-xs">Estado</Label>
                <Input value={form.state} onChange={set("state")} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="font-body text-xs">Cidade</Label>
                <Input value={form.city} onChange={set("city")} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="font-body text-xs">Endereço</Label>
                <Input value={form.address_street} onChange={set("address_street")} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="font-body text-xs">Número</Label>
                <Input value={form.address_number} onChange={set("address_number")} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="font-body text-xs">Complemento</Label>
                <Input value={form.address_complement} onChange={set("address_complement")} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="font-body text-xs">Bairro</Label>
                <Input value={form.neighborhood} onChange={set("neighborhood")} className="h-9" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action buttons */}
        <div className="flex items-center gap-3 border-t pt-4">
          {editing ? (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive font-body">
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
              <div className="flex-1" />
              <Button variant="outline" onClick={goBack} className="font-body">Voltar</Button>
              <Button variant="outline" onClick={() => { setShouldGoBack(true); saveMutation.mutate(); }} disabled={!form.name || saveMutation.isPending} className="font-body">
                Salvar e Voltar
              </Button>
              <Button onClick={() => { setShouldGoBack(false); saveMutation.mutate(); }} disabled={!form.name || saveMutation.isPending} className="font-body">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex-1" />
              <Button variant="outline" onClick={goBack} className="font-body">Voltar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="font-body">
                {saveMutation.isPending ? "Salvando..." : "Adicionar Fornecedor"}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar fornecedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Button size="sm" onClick={openNew}>+ Fornecedor</Button>
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
                <TableHead className="w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum fornecedor encontrado.</TableCell></TableRow>
              ) : (
                filtered.slice(0, 100).map((s: any) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => isAdmin && openEdit(s)}>
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
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "outline"} className="font-body text-xs">
                        {s.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {filtered.length > 100 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Mostrando 100 de {filtered.length}. Use a busca para refinar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
