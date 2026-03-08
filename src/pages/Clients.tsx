import { useState, useMemo, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronsUpDown, X, Plus, ArrowLeft, Star, Trash2 } from "lucide-react";
import { useCountries, useStates, useCities } from "@/components/LocationsTab";
import { COUNTRY_CODES, applyPhoneMask } from "@/lib/phone-masks";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

function sortData<T extends Record<string, any>>(data: T[], sort: SortState): T[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const va = (a[sort.key] ?? "").toString().toLowerCase();
    const vb = (b[sort.key] ?? "").toString().toLowerCase();
    return sort.dir === "asc" ? va.localeCompare(vb) : -va.localeCompare(vb);
  });
}

function toggleSort(sort: SortState, key: string): SortState {
  if (sort?.key === key) {
    if (sort.dir === "asc") return { key, dir: "desc" };
    return null;
  }
  return { key, dir: "asc" };
}

const travelProfiles: Record<string, { label: string; color: string }> = {
  economic: { label: "Econômico", color: "bg-soft-blue/10 text-soft-blue" },
  opportunity: { label: "Oportunidade", color: "bg-gold/10 text-gold" },
  sophisticated: { label: "Sofisticado", color: "bg-primary/10 text-primary" },
};

type PhoneEntry = { id?: string; phone: string; description: string; country_code: string; is_primary: boolean };
type EmailEntry = { id?: string; email: string; description: string; is_primary: boolean };
type SocialEntry = { id?: string; network: string; handle: string };
type VisaEntry = { id?: string; visa_type: string; validity_date: string };
type PassportEntry = {
  id?: string; passport_number: string; issue_date: string; expiry_date: string;
  nationality: string; status: string; visas: VisaEntry[];
};

const SOCIAL_NETWORKS = ["Instagram", "Facebook", "LinkedIn", "Twitter/X", "TikTok", "YouTube", "Outro"];
const MARITAL_STATUSES = ["Solteiro(a)", "Casado(a)", "Separado(a)", "Divorciado(a)", "Viúvo(a)"];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(value === i ? 0 : i)} className="focus:outline-none">
          <Star className={`h-5 w-5 transition-colors ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

const emptyForm = {
  full_name: "", birth_date: "", gender: "", is_active: true, website: "",
  rating: 0, accepts_email_comm: false, accepts_whatsapp_comm: false,
  travel_profile: "economic" as const, passport_status: "none",
  notes: "", country: "Brasil", state: "", city: "",
  preferred_airports: [] as string[], tags: [] as string[],
  cpf_cnpj: "", rg: "", rg_issuer: "", foreign_id: "", nationality: "",
  marital_status: "",
  cep: "", neighborhood: "", address_street: "", address_number: "", address_complement: "",
};

export default function Clients() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sort, setSort] = useState<SortState>(null);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Multi-value entries
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [socials, setSocials] = useState<SocialEntry[]>([]);
  const [passports, setPassports] = useState<PassportEntry[]>([]);

  // Airport selection
  const [selectedAirports, setSelectedAirports] = useState<string[]>([]);
  const [airportSearch, setAirportSearch] = useState("");
  const [airportPopoverOpen, setAirportPopoverOpen] = useState(false);

  // Quick-add location
  const [quickAddType, setQuickAddType] = useState<"country" | "state" | "city" | null>(null);
  const [quickAddName, setQuickAddName] = useState("");

  // Location hooks
  const { data: dbCountries = [] } = useCountries();
  const selectedCountryObj = dbCountries.find((c: any) => c.name === form.country);
  const { data: dbStates = [] } = useStates(selectedCountryObj?.id);
  const selectedStateObj = (dbStates as any[]).find((s: any) => s.name === form.state);
  const { data: dbCities = [] } = useCities(selectedCountryObj?.id, selectedStateObj?.id || undefined);

  // Address location hooks (for address tab)
  const addrCountryObj = dbCountries.find((c: any) => c.name === form.country);

  const { data: airportsList = [] } = useQuery({
    queryKey: ["airports-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airports").select("iata_code, name, city, country").order("iata_code");
      if (error) throw error;
      return data;
    },
  });

  const filteredAirports = useMemo(() => {
    if (!airportSearch) return airportsList;
    const q = airportSearch.toLowerCase();
    return airportsList.filter((a) =>
      a.iata_code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
    );
  }, [airportsList, airportSearch]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch related data when editing
  const { data: clientPhones = [] } = useQuery({
    queryKey: ["client-phones", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("client_phones").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });
  const { data: clientEmails = [] } = useQuery({
    queryKey: ["client-emails", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("client_emails").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });
  const { data: clientSocials = [] } = useQuery({
    queryKey: ["client-socials", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("client_social_media").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });
  const { data: clientPassports = [] } = useQuery({
    queryKey: ["client-passports", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data: pData } = await supabase.from("client_passports").select("*").eq("client_id", editingId);
      if (!pData || pData.length === 0) return [];
      const passportIds = pData.map((p: any) => p.id);
      const { data: vData } = await supabase.from("client_visas").select("*").in("passport_id", passportIds);
      return pData.map((p: any) => ({
        ...p,
        visas: (vData ?? []).filter((v: any) => v.passport_id === p.id),
      }));
    },
    enabled: !!editingId,
  });

  // Populate multi-value state when editing data loads
  useEffect(() => {
    if (editingId) {
      setPhones(clientPhones.map((p: any) => {
        const stored = p.phone ?? "";
        // Match longest dial code first
        const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
        const match = sorted.find((c) => stored.startsWith(c.dial));
        const cc = match || COUNTRY_CODES[0];
        const localPart = match ? stored.slice(match.dial.length).trim() : stored;
        return { id: p.id, phone: applyPhoneMask(localPart, cc.mask), description: p.description ?? "", country_code: cc.code };
      }));
    }
  }, [clientPhones, editingId]);
  useEffect(() => {
    if (editingId) {
      setEmails(clientEmails.map((e: any) => ({ id: e.id, email: e.email, description: e.description ?? "" })));
    }
  }, [clientEmails, editingId]);
  useEffect(() => {
    if (editingId) {
      setSocials(clientSocials.map((s: any) => ({ id: s.id, network: s.network, handle: s.handle })));
    }
  }, [clientSocials, editingId]);
  useEffect(() => {
    if (editingId) {
      setPassports(clientPassports.map((p: any) => ({
        id: p.id, passport_number: p.passport_number ?? "", issue_date: p.issue_date ?? "",
        expiry_date: p.expiry_date ?? "", nationality: p.nationality ?? "", status: p.status ?? "valid",
        visas: (p.visas ?? []).map((v: any) => ({ id: v.id, visa_type: v.visa_type, validity_date: v.validity_date ?? "" })),
      })));
    }
  }, [clientPassports, editingId]);

  // CEP auto-fill
  const handleCepBlur = async () => {
    if (form.country !== "Brasil" || !form.cep || form.cep.replace(/\D/g, "").length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${form.cep.replace(/\D/g, "")}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          address_street: data.logradouro || prev.address_street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch { /* ignore */ }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { preferred_airports: _pa, tags: _t, ...rest } = form;
      const payload: any = {
        ...rest,
        preferred_airports: selectedAirports,
        birth_date: form.birth_date || null,
      };

      let clientId = editingId;
      if (editingId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) throw error;
        clientId = data.id;
      }

      // Save multi-value records
      if (clientId) {
        await supabase.from("client_phones").delete().eq("client_id", clientId);
        if (phones.length > 0) {
          await supabase.from("client_phones").insert(phones.filter(p => p.phone).map(p => { const cc = COUNTRY_CODES.find(c => c.code === p.country_code); return { client_id: clientId!, phone: `${cc?.dial || "+55"} ${p.phone}`, description: p.description || null }; }));
        }
        await supabase.from("client_emails").delete().eq("client_id", clientId);
        if (emails.length > 0) {
          await supabase.from("client_emails").insert(emails.filter(e => e.email).map(e => ({ client_id: clientId!, email: e.email, description: e.description || null })));
        }
        await supabase.from("client_social_media").delete().eq("client_id", clientId);
        if (socials.length > 0) {
          await supabase.from("client_social_media").insert(socials.filter(s => s.handle).map(s => ({ client_id: clientId!, network: s.network, handle: s.handle })));
        }
        // Passports & Visas: delete old passports (cascades to visas), insert new
        await supabase.from("client_passports").delete().eq("client_id", clientId);
        for (const pp of passports.filter(p => p.passport_number)) {
          const { data: ppData, error: ppErr } = await supabase.from("client_passports").insert({
            client_id: clientId!, passport_number: pp.passport_number,
            issue_date: pp.issue_date || null, expiry_date: pp.expiry_date || null,
            nationality: pp.nationality || null, status: pp.status || "valid",
          }).select("id").single();
          if (ppErr) throw ppErr;
          if (pp.visas.length > 0) {
            await supabase.from("client_visas").insert(
              pp.visas.filter(v => v.visa_type).map(v => ({ passport_id: ppData.id, visa_type: v.visa_type, validity_date: v.validity_date || null }))
            );
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Cliente atualizado" : "Cliente criado" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      goToList();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cliente removido" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      goToList();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const goToList = () => {
    setView("list"); setEditingId(null); setForm(emptyForm);
    setSelectedAirports([]); setPhones([]); setEmails([]); setSocials([]); setPassports([]);
  };

  const openCreate = () => {
    setEditingId(null); setForm(emptyForm); setSelectedAirports([]);
    setPhones([]); setEmails([]); setSocials([]); setPassports([]); 
    setView("form");
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      full_name: c.full_name ?? "", birth_date: c.birth_date ?? "", gender: c.gender ?? "",
      is_active: c.is_active ?? true, website: c.website ?? "",
      rating: c.rating ?? 0, accepts_email_comm: c.accepts_email_comm ?? false,
      accepts_whatsapp_comm: c.accepts_whatsapp_comm ?? false,
      travel_profile: c.travel_profile ?? "economic", passport_status: c.passport_status ?? "none",
      notes: c.notes ?? "", country: c.country ?? "Brasil", state: c.state ?? "", city: c.city ?? "",
      preferred_airports: c.preferred_airports ?? [], tags: c.tags ?? [],
      cpf_cnpj: c.cpf_cnpj ?? "", rg: c.rg ?? "", rg_issuer: c.rg_issuer ?? "",
      foreign_id: c.foreign_id ?? "", nationality: c.nationality ?? "",
      marital_status: c.marital_status ?? "",
      cep: c.cep ?? "", neighborhood: c.neighborhood ?? "",
      address_street: c.address_street ?? "", address_number: c.address_number ?? "",
      address_complement: c.address_complement ?? "",
    });
    setSelectedAirports(c.preferred_airports ?? []);
    setView("form");
  };

  const quickAddMutation = useMutation({
    mutationFn: async () => {
      if (quickAddType === "country") {
        const { error } = await supabase.from("countries").insert({ name: quickAddName });
        if (error) throw error;
        setForm({ ...form, country: quickAddName, state: "", city: "" });
      } else if (quickAddType === "state" && selectedCountryObj) {
        const { error } = await supabase.from("states").insert({ name: quickAddName, country_id: selectedCountryObj.id });
        if (error) throw error;
        setForm({ ...form, state: quickAddName, city: "" });
      } else if (quickAddType === "city" && selectedCountryObj) {
        const { error } = await supabase.from("cities").insert({ name: quickAddName, country_id: selectedCountryObj.id, state_id: selectedStateObj?.id || null });
        if (error) throw error;
        setForm({ ...form, city: quickAddName });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-countries"] });
      qc.invalidateQueries({ queryKey: ["locations-states"] });
      qc.invalidateQueries({ queryKey: ["locations-cities"] });
      toast({ title: "Localidade adicionada" });
      setQuickAddType(null); setQuickAddName("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = sortData(
    clients.filter((c: any) => {
      const matchesSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.city ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesProfile = profileFilter === "all" || c.travel_profile === profileFilter;
      return matchesSearch && matchesProfile;
    }),
    sort
  );

  const SortableHeader = ({ label, sortKey, className }: { label: string; sortKey: string; className?: string }) => {
    const active = sort?.key === sortKey;
    return (
      <th className={`text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium cursor-pointer select-none hover:text-foreground ${className || ""}`}
        onClick={() => setSort(toggleSort(sort, sortKey))}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    );
  };

  const upd = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  // ========== FORM VIEW ==========
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goToList} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-semibold text-foreground">
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </h1>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          {/* ====== UPPER SECTION: Compact header with key data ====== */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            {/* Row 1: Name + Rating + Birth + Gender + Active */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="font-body text-xs">Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => upd("full_name", e.target.value)} required className="h-9" />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="font-body text-xs">Nascimento</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => upd("birth_date", e.target.value)} className="h-9" />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="font-body text-xs">Sexo</Label>
                <Select value={form.gender || "_none"} onValueChange={(v) => upd("gender", v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="font-body text-xs">Qualificação</Label>
                <StarRating value={form.rating} onChange={(v) => upd("rating", v)} />
              </div>
              <div className="col-span-6 sm:col-span-2 flex items-center gap-2 pb-0.5">
                <Switch checked={form.is_active} onCheckedChange={(v) => upd("is_active", v)} />
                <Label className="font-body text-xs">{form.is_active ? "Ativo" : "Inativo"}</Label>
              </div>
            </div>

            {/* Row 2: Travel profile, Site, Passport status */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <Label className="font-body text-xs">Perfil de viagem</Label>
                <Select value={form.travel_profile} onValueChange={(v) => upd("travel_profile", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economic">Econômico</SelectItem>
                    <SelectItem value="opportunity">Oportunidade</SelectItem>
                    <SelectItem value="sophisticated">Sofisticado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <Label className="font-body text-xs">Site</Label>
                <Input value={form.website} onChange={(e) => upd("website", e.target.value)} placeholder="https://" className="h-9" />
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <Label className="font-body text-xs">Passaporte (status)</Label>
                <Select value={form.passport_status} onValueChange={(v) => upd("passport_status", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem passaporte</SelectItem>
                    <SelectItem value="valid">Válido</SelectItem>
                    <SelectItem value="expired">Vencido</SelectItem>
                    <SelectItem value="processing">Em processo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ====== LOWER SECTION: Tabs ====== */}
          <div className="glass-card rounded-xl p-4">
            <Tabs defaultValue="contact">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="contact" className="font-body text-xs">Contato</TabsTrigger>
                <TabsTrigger value="documents" className="font-body text-xs">Documentos</TabsTrigger>
                <TabsTrigger value="address" className="font-body text-xs">Endereço</TabsTrigger>
                <TabsTrigger value="observations" className="font-body text-xs">Observações</TabsTrigger>
              </TabsList>

              {/* Contact Tab */}
              <TabsContent value="contact" className="space-y-4 pt-3">
                {/* Phones */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-body text-xs font-medium">Celulares / Telefones</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setPhones([...phones, { phone: "", description: "", country_code: "BR" }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>
                  {phones.map((p, i) => {
                    const cc = COUNTRY_CODES.find((c) => c.code === p.country_code) || COUNTRY_CODES[0];
                    return (
                      <div key={i} className="flex gap-2 items-start">
                        <Select value={p.country_code} onValueChange={(v) => { const n = [...phones]; n[i].country_code = v; n[i].phone = ""; setPhones(n); }}>
                          <SelectTrigger className="w-28 h-9 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.dial}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input className="w-40 h-9 shrink-0" placeholder={cc.mask.replace(/#/g, "0")} value={p.phone} onChange={(e) => { const n = [...phones]; n[i].phone = applyPhoneMask(e.target.value, cc.mask); setPhones(n); }} />
                        <Input className="flex-1 h-9" placeholder="Descrição" value={p.description} onChange={(e) => { const n = [...phones]; n[i].description = e.target.value; setPhones(n); }} />
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setPhones(phones.filter((_, j) => j !== i))}>
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
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setEmails([...emails, { email: "", description: "" }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>
                  {emails.map((e, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Input className="w-72 h-9 shrink-0" type="email" placeholder="E-mail" value={e.email} onChange={(ev) => { const n = [...emails]; n[i].email = ev.target.value; setEmails(n); }} />
                      <Input className="flex-1 h-9" placeholder="Descrição" value={e.description} onChange={(ev) => { const n = [...emails]; n[i].description = ev.target.value; setEmails(n); }} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setEmails(emails.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Social Media */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-body text-xs font-medium">Redes Sociais</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setSocials([...socials, { network: "Instagram", handle: "" }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>
                  {socials.map((s, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Select value={s.network} onValueChange={(v) => { const n = [...socials]; n[i].network = v; setSocials(n); }}>
                        <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOCIAL_NETWORKS.map((sn) => <SelectItem key={sn} value={sn}>{sn}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input className="flex-1 h-9" placeholder="@ ou URL" value={s.handle} onChange={(e) => { const n = [...socials]; n[i].handle = e.target.value; setSocials(n); }} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setSocials(socials.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Communication preferences + Airports inline */}
                <div className="border-t border-border/50 pt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="font-body text-xs font-medium">Preferências de comunicação</Label>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={form.accepts_email_comm} onCheckedChange={(v) => upd("accepts_email_comm", v)} />
                        <Label className="font-body text-xs">E-mail</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={form.accepts_whatsapp_comm} onCheckedChange={(v) => upd("accepts_whatsapp_comm", v)} />
                        <Label className="font-body text-xs">WhatsApp</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="font-body text-xs font-medium">Aeroportos preferidos</Label>
                    <Popover open={airportPopoverOpen} onOpenChange={setAirportPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" type="button" className="w-full justify-between font-normal h-9 text-sm">
                          {selectedAirports.length > 0 ? `${selectedAirports.length} aeroporto(s)` : "Selecione aeroportos"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-2 border-b"><Input placeholder="Buscar..." value={airportSearch} onChange={(e) => setAirportSearch(e.target.value)} className="h-8 text-sm" /></div>
                        <div className="max-h-52 overflow-y-auto p-1">
                          {filteredAirports.slice(0, 50).map((a) => (
                            <label key={a.iata_code} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                              <Checkbox checked={selectedAirports.includes(a.iata_code)} onCheckedChange={(checked) => setSelectedAirports((prev) => checked ? [...prev, a.iata_code] : prev.filter((c) => c !== a.iata_code))} />
                              <span className="font-mono font-bold text-primary">{a.iata_code}</span>
                              <span className="text-muted-foreground truncate">{a.city} - {a.name}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedAirports.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedAirports.map((code) => (
                          <span key={code} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {code}
                            <button type="button" onClick={() => setSelectedAirports((prev) => prev.filter((c) => c !== code))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">CPF / CNPJ</Label>
                    <Input value={form.cpf_cnpj} onChange={(e) => upd("cpf_cnpj", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">RG</Label>
                    <Input value={form.rg} onChange={(e) => upd("rg", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Órgão Emissor RG</Label>
                    <Input value={form.rg_issuer} onChange={(e) => upd("rg_issuer", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">ID Estrangeiro</Label>
                    <Input value={form.foreign_id} onChange={(e) => upd("foreign_id", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Nacionalidade</Label>
                    <Input value={form.nationality} onChange={(e) => upd("nationality", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Estado Civil</Label>
                    <Select value={form.marital_status || "_none"} onValueChange={(v) => upd("marital_status", v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Selecione</SelectItem>
                        {MARITAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Passports */}
                <div className="border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-display font-medium text-foreground">Passaportes</h3>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setPassports([...passports, { passport_number: "", issue_date: "", expiry_date: "", nationality: "", status: "valid", visas: [] }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar Passaporte
                    </Button>
                  </div>
                  {passports.length === 0 && <p className="text-xs text-muted-foreground font-body">Nenhum passaporte cadastrado.</p>}
                  {passports.map((pp, pi) => (
                    <div key={pi} className="border border-border/50 rounded-lg p-3 mb-3 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-body font-medium text-foreground">Passaporte {pi + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPassports(passports.filter((_, j) => j !== pi))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Número</Label>
                          <Input className="h-9" value={pp.passport_number} onChange={(e) => { const n = [...passports]; n[pi].passport_number = e.target.value; setPassports(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Emissão</Label>
                          <Input type="date" className="h-9" value={pp.issue_date} onChange={(e) => { const n = [...passports]; n[pi].issue_date = e.target.value; setPassports(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Vencimento</Label>
                          <Input type="date" className="h-9" value={pp.expiry_date} onChange={(e) => { const n = [...passports]; n[pi].expiry_date = e.target.value; setPassports(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Nacionalidade</Label>
                          <Input className="h-9" value={pp.nationality} onChange={(e) => { const n = [...passports]; n[pi].nationality = e.target.value; setPassports(n); }} />
                        </div>
                      </div>

                      {/* Visas for this passport */}
                      <div className="border-t border-border/30 pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-body text-xs font-medium">Vistos deste passaporte</Label>
                          <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => {
                            const n = [...passports]; n[pi].visas = [...n[pi].visas, { visa_type: "", validity_date: "" }]; setPassports(n);
                          }}>
                            <Plus className="h-3 w-3 mr-1" />Visto
                          </Button>
                        </div>
                        {pp.visas.length === 0 && <p className="text-xs text-muted-foreground font-body">Nenhum visto.</p>}
                        {pp.visas.map((v, vi) => (
                          <div key={vi} className="flex gap-2 items-start mb-1.5">
                            <Input className="flex-1 h-8 text-sm" placeholder="Tipo (ex: B1/B2 EUA)" value={v.visa_type} onChange={(e) => {
                              const n = [...passports]; n[pi].visas[vi].visa_type = e.target.value; setPassports(n);
                            }} />
                            <Input type="date" className="w-36 h-8 text-sm" value={v.validity_date} onChange={(e) => {
                              const n = [...passports]; n[pi].visas[vi].validity_date = e.target.value; setPassports(n);
                            }} />
                            <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-destructive" onClick={() => {
                              const n = [...passports]; n[pi].visas = n[pi].visas.filter((_, j) => j !== vi); setPassports(n);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Country */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">País</Label>
                    <Select value={form.country || "Brasil"} onValueChange={(v) => upd("country", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {dbCountries.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CEP / Postal Code */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">{form.country === "Brasil" ? "CEP" : "Postal Code"}</Label>
                    <Input value={form.cep} onChange={(e) => upd("cep", e.target.value)} onBlur={form.country === "Brasil" ? handleCepBlur : undefined} placeholder={form.country === "Brasil" ? "00000-000" : ""} />
                  </div>

                  {/* State */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Estado / Região</Label>
                    <Select value={form.state || "_none"} onValueChange={(v) => { upd("state", v === "_none" ? "" : v); upd("city", ""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="_none">Selecione</SelectItem>
                        {(dbStates as any[]).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Cidade</Label>
                    <Select value={form.city || "_none"} onValueChange={(v) => upd("city", v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="_none">Selecione</SelectItem>
                        {(dbCities as any[]).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Bairro</Label>
                    <Input value={form.neighborhood} onChange={(e) => upd("neighborhood", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="font-body text-xs">Endereço</Label>
                    <Input value={form.address_street} onChange={(e) => upd("address_street", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Número</Label>
                    <Input value={form.address_number} onChange={(e) => upd("address_number", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="font-body text-xs">Complemento</Label>
                    <Input value={form.address_complement} onChange={(e) => upd("address_complement", e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              {/* Observations Tab */}
              <TabsContent value="observations" className="pt-3">
                <div className="space-y-1">
                  <Label className="font-body text-xs">Observações gerais</Label>
                  <Textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={4} placeholder="Anotações sobre o cliente..." />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-between">
            {editingId ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive font-body">
                    <Trash2 className="h-4 w-4 mr-1" />Excluir Cliente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Excluir cliente</AlertDialogTitle>
                    <AlertDialogDescription className="font-body">
                      Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body" onClick={() => deleteMutation.mutate(editingId)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <div />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={goToList} className="font-body">
                <ArrowLeft className="h-4 w-4 mr-1" />Voltar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="font-body">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>

        {/* Quick-add location dialog */}
        <Dialog open={quickAddType !== null} onOpenChange={(o) => { if (!o) { setQuickAddType(null); setQuickAddName(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quickAddType === "country" ? "Novo País" : quickAddType === "state" ? "Novo Estado/Região" : "Nova Cidade"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {quickAddType === "state" && <p className="text-sm text-muted-foreground">País: {form.country}</p>}
              {quickAddType === "city" && <p className="text-sm text-muted-foreground">{form.country}{form.state ? ` → ${form.state}` : ""}</p>}
              <div>
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} />
              </div>
              <Button onClick={() => quickAddMutation.mutate()} disabled={!quickAddName || quickAddMutation.isPending}>
                {quickAddMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Clientes</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">{clients.length} clientes cadastrados</p>
        </div>
        <Button onClick={openCreate} className="font-body w-full sm:w-auto"><Plus className="h-4 w-4" />Novo Cliente</Button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input type="text" placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted overflow-x-auto">
          {["all", "economic", "opportunity", "sophisticated"].map((p) => (
            <button key={p} onClick={() => setProfileFilter(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-body transition-colors whitespace-nowrap ${profileFilter === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {p === "all" ? "Todos" : travelProfiles[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum cliente encontrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <SortableHeader label="Cliente" sortKey="full_name" />
                <SortableHeader label="Localização" sortKey="city" />
                <SortableHeader label="Perfil" sortKey="travel_profile" />
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Aeroportos</th>
                <SortableHeader label="Passaporte" sortKey="passport_status" />
                
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((client: any) => {
                const passportLabel = { none: "Sem", valid: "Válido", expired: "Vencido", processing: "Em processo" }[client.passport_status ?? "none"] ?? client.passport_status;
                return (
                  <tr key={client.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(client)}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-sm font-medium font-body text-foreground">{client.full_name}</p>
                          {client.rating > 0 && <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3 w-3 ${i <= client.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />)}</div>}
                        </div>
                        {client.is_active === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-body">Inativo</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-body text-foreground">{client.city}</p>
                      <p className="text-xs text-muted-foreground font-body">{client.state}</p>
                    </td>
                    <td className="p-4">
                      {client.travel_profile && travelProfiles[client.travel_profile] && (
                        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${travelProfiles[client.travel_profile].color}`}>
                          {travelProfiles[client.travel_profile].label}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        {(client.preferred_airports ?? []).map((a: string) => (
                          <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground font-body">{a}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-body ${passportLabel === 'Válido' ? 'text-success' : passportLabel === 'Vencido' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {passportLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum cliente encontrado.</div>
        ) : (
          filtered.map((client: any) => (
            <div key={client.id} className="glass-card rounded-xl p-4 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openEdit(client)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium font-body text-foreground">{client.full_name}</p>
                  {client.rating > 0 && <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3 w-3 ${i <= client.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />)}</div>}
                </div>
                <div className="flex items-center gap-1">
                  {client.is_active === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-body">Inativo</span>}
                  {client.travel_profile && travelProfiles[client.travel_profile] && (
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${travelProfiles[client.travel_profile].color}`}>
                      {travelProfiles[client.travel_profile].label}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-body">
                {client.city && <span>{client.city}{client.state ? `, ${client.state}` : ""}</span>}
                {client.phone && <span>{client.phone}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
