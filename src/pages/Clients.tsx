import { useState, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronsUpDown, X, Plus, ArrowLeft } from "lucide-react";
import { useCountries, useStates, useCities } from "@/components/LocationsTab";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

function sortData<T extends Record<string, any>>(data: T[], sort: SortState): T[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const va = (a[sort.key] ?? "").toString().toLowerCase();
    const vb = (b[sort.key] ?? "").toString().toLowerCase();
    const cmp = va.localeCompare(vb);
    return sort.dir === "asc" ? cmp : -cmp;
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

type Client = Tables<"clients">;

const emptyClient: Partial<TablesInsert<"clients">> = {
  full_name: "", email: "", phone: "", city: "", state: "", country: "Brasil",
  travel_profile: "economic", passport_status: "none", notes: "",
  preferred_airports: [], tags: [],
};

export default function Clients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sort, setSort] = useState<SortState>(null);

  // View mode: "list" or "form"
  const [view, setView] = useState<"list" | "form">("list");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient);
  const [selectedAirports, setSelectedAirports] = useState<string[]>([]);
  const [airportSearch, setAirportSearch] = useState("");
  const [airportPopoverOpen, setAirportPopoverOpen] = useState(false);

  // Quick-add dialogs
  const [quickAddType, setQuickAddType] = useState<"country" | "state" | "city" | null>(null);
  const [quickAddName, setQuickAddName] = useState("");

  // DB-backed location data
  const { data: dbCountries = [] } = useCountries();
  const selectedCountryObj = dbCountries.find((c: any) => c.name === form.country);
  const { data: dbStates = [] } = useStates(selectedCountryObj?.id);
  const selectedStateObj = (dbStates as any[]).find((s: any) => s.name === form.state);
  const { data: dbCities = [] } = useCities(selectedCountryObj?.id, selectedStateObj?.id || undefined);

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
      return data as Client[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        preferred_airports: selectedAirports,
      } as TablesInsert<"clients">;
      if (editingClient) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingClient ? "Cliente atualizado" : "Cliente criado" });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const goToList = () => { setView("list"); setEditingClient(null); setForm(emptyClient); setSelectedAirports([]); };

  const openCreate = () => {
    setEditingClient(null);
    setForm(emptyClient);
    setSelectedAirports([]);
    setView("form");
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setForm({
      full_name: c.full_name, email: c.email ?? "", phone: c.phone ?? "",
      city: c.city ?? "", state: c.state ?? "", country: c.country ?? "Brasil",
      travel_profile: c.travel_profile ?? "economic", passport_status: c.passport_status ?? "none",
      notes: c.notes ?? "",
    });
    setSelectedAirports(c.preferred_airports ?? []);
    setView("form");
  };

  // Quick-add location mutation
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
      queryClient.invalidateQueries({ queryKey: ["locations-countries"] });
      queryClient.invalidateQueries({ queryKey: ["locations-states"] });
      queryClient.invalidateQueries({ queryKey: ["locations-cities"] });
      toast({ title: "Localidade adicionada" });
      setQuickAddType(null);
      setQuickAddName("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = sortData(
    clients.filter((c) => {
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

  // ========== FORM VIEW ==========
  if (view === "form") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goToList} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-semibold text-foreground">
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </h1>
            {editingClient && (
              <p className="text-sm text-muted-foreground font-body">{editingClient.full_name}</p>
            )}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="glass-card rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label className="font-body">Nome completo *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label className="font-body">E-mail</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="font-body">Telefone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body">País</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => { setQuickAddType("country"); setQuickAddName(""); }}>
                  <Plus className="h-3 w-3 mr-1" />Novo
                </Button>
              </div>
              <Select value={form.country ?? "Brasil"} onValueChange={(v) => setForm({ ...form, country: v, state: "", city: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {dbCountries.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body">Estado / Região</Label>
                {selectedCountryObj && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => { setQuickAddType("state"); setQuickAddName(""); }}>
                    <Plus className="h-3 w-3 mr-1" />Novo
                  </Button>
                )}
              </div>
              <Select value={form.state ?? ""} onValueChange={(v) => setForm({ ...form, state: v, city: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {(dbStates as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-body">Cidade</Label>
                {selectedCountryObj && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => { setQuickAddType("city"); setQuickAddName(""); }}>
                    <Plus className="h-3 w-3 mr-1" />Nova
                  </Button>
                )}
              </div>
              <Select value={form.city ?? ""} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {(dbCities as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Perfil de viagem</Label>
              <Select value={form.travel_profile ?? "economic"} onValueChange={(v) => setForm({ ...form, travel_profile: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="economic">Econômico</SelectItem>
                  <SelectItem value="opportunity">Oportunidade</SelectItem>
                  <SelectItem value="sophisticated">Sofisticado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body">Passaporte</Label>
              <Select value={form.passport_status ?? "none"} onValueChange={(v) => setForm({ ...form, passport_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem passaporte</SelectItem>
                  <SelectItem value="valid">Válido</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                  <SelectItem value="processing">Em processo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="font-body">Aeroportos preferidos</Label>
              <Popover open={airportPopoverOpen} onOpenChange={setAirportPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-between font-normal">
                    {selectedAirports.length > 0
                      ? `${selectedAirports.length} aeroporto(s) selecionado(s)`
                      : "Selecione aeroportos"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Buscar por código, nome ou cidade..."
                      value={airportSearch}
                      onChange={(e) => setAirportSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1">
                    {filteredAirports.slice(0, 50).map((a) => (
                      <label key={a.iata_code} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedAirports.includes(a.iata_code)}
                          onCheckedChange={(checked) => {
                            setSelectedAirports((prev) =>
                              checked ? [...prev, a.iata_code] : prev.filter((c) => c !== a.iata_code)
                            );
                          }}
                        />
                        <span className="font-mono font-bold text-primary">{a.iata_code}</span>
                        <span className="text-muted-foreground truncate">{a.city} - {a.name}</span>
                      </label>
                    ))}
                    {filteredAirports.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-3">Nenhum aeroporto encontrado</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selectedAirports.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedAirports.map((code) => (
                    <span key={code} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {code}
                      <button type="button" onClick={() => setSelectedAirports((prev) => prev.filter((c) => c !== code))} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="font-body">Observações</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={goToList} className="font-body">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="font-body">
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>

        {/* Quick-add location dialog */}
        <Dialog open={quickAddType !== null} onOpenChange={(o) => { if (!o) { setQuickAddType(null); setQuickAddName(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {quickAddType === "country" ? "Novo País" : quickAddType === "state" ? "Novo Estado/Região" : "Nova Cidade"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {quickAddType === "state" && <p className="text-sm text-muted-foreground">País: {form.country}</p>}
              {quickAddType === "city" && (
                <p className="text-sm text-muted-foreground">
                  {form.country}{form.state ? ` → ${form.state}` : ""}
                </p>
              )}
              <div>
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} placeholder={`Nome ${quickAddType === "country" ? "do país" : quickAddType === "state" ? "do estado/região" : "da cidade"}`} />
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
        <Button onClick={openCreate} className="font-body w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
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
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((client) => {
                const passportLabel = { none: "Sem", valid: "Válido", expired: "Vencido", processing: "Em processo" }[client.passport_status ?? "none"] ?? client.passport_status;
                return (
                  <tr key={client.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(client)}>
                    <td className="p-4">
                      <p className="text-sm font-medium font-body text-foreground">{client.full_name}</p>
                      <p className="text-xs text-muted-foreground font-body">{client.email}</p>
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
                        {(client.preferred_airports ?? []).map((a) => (
                          <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground font-body">{a}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-body ${passportLabel === 'Válido' ? 'text-success' : passportLabel === 'Vencido' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {passportLabel}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="text-destructive font-body" onClick={(e) => { e.stopPropagation(); if (confirm("Remover cliente?")) deleteMutation.mutate(client.id); }}>Excluir</Button>
                      </div>
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
          filtered.map((client) => {
            const passportLabel = { none: "Sem", valid: "Válido", expired: "Vencido", processing: "Em processo" }[client.passport_status ?? "none"] ?? client.passport_status;
            return (
              <div key={client.id} className="glass-card rounded-xl p-4 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openEdit(client)}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium font-body text-foreground">{client.full_name}</p>
                    <p className="text-xs text-muted-foreground font-body">{client.email}</p>
                  </div>
                  {client.travel_profile && travelProfiles[client.travel_profile] && (
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${travelProfiles[client.travel_profile].color}`}>
                      {travelProfiles[client.travel_profile].label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-body">
                  {client.city && <span>{client.city}{client.state ? `, ${client.state}` : ""}</span>}
                  {client.phone && <span>{client.phone}</span>}
                  <span className={passportLabel === 'Válido' ? 'text-success' : passportLabel === 'Vencido' ? 'text-destructive' : ''}>
                    Passaporte: {passportLabel}
                  </span>
                </div>
                {(client.preferred_airports ?? []).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {(client.preferred_airports ?? []).map((a) => (
                      <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground font-body">{a}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size="sm" className="text-destructive font-body" onClick={(e) => { e.stopPropagation(); if (confirm("Remover cliente?")) deleteMutation.mutate(client.id); }}>Excluir</Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
