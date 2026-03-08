import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

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

// ── Hooks for shared data ──

export function useCountries() {
  return useQuery({
    queryKey: ["locations-countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useStates(countryId?: string) {
  return useQuery({
    queryKey: ["locations-states", countryId],
    queryFn: async () => {
      let q = supabase.from("states").select("*, countries(name)").order("name");
      if (countryId) q = q.eq("country_id", countryId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCities(countryId?: string, stateId?: string) {
  return useQuery({
    queryKey: ["locations-cities", countryId, stateId],
    queryFn: async () => {
      let q = supabase.from("cities").select("*, countries(name), states(name)").order("name");
      if (countryId) q = q.eq("country_id", countryId);
      if (stateId) q = q.eq("state_id", stateId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

// ── Countries Sub-Tab ──

function CountriesSubTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const { data: countries = [], isLoading } = useCountries();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("countries").update({ name }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("countries").insert({ name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-countries"] });
      toast({ title: editing ? "País atualizado" : "País adicionado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("countries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-countries"] });
      toast({ title: "País removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setName(""); };
  const openEdit = (c: any) => { setEditing(c); setName(c.name); setDialogOpen(true); };

  const filtered = sortData(
    countries.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase())),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar país..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <>
            <Button size="sm" onClick={() => setDialogOpen(true)}>+ País</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Editar País" : "Novo País"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do país" /></div>
                  <Button onClick={() => saveMutation.mutate()} disabled={!name}>{editing ? "Salvar" : "Adicionar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{filtered.length} país(es)</div>
      {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>✏️</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm">🗑️</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir país?</AlertDialogTitle>
                              <AlertDialogDescription>Excluir {c.name} também removerá todos os estados e cidades associados.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── States Sub-Tab ──

function StatesSubTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", country_id: "" });
  const [sort, setSort] = useState<SortState>(null);
  const [filterCountry, setFilterCountry] = useState("all");

  const { data: countries = [] } = useCountries();
  const { data: states = [], isLoading } = useStates();

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("states").update({ name: form.name, country_id: form.country_id }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("states").insert({ name: form.name, country_id: form.country_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-states"] });
      toast({ title: editing ? "Estado atualizado" : "Estado adicionado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("states").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-states"] });
      toast({ title: "Estado removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ name: "", country_id: "" }); };
  const openEdit = (s: any) => { setEditing(s); setForm({ name: s.name, country_id: s.country_id }); setDialogOpen(true); };

  const enriched = states.map((s: any) => ({ ...s, country_name: s.countries?.name ?? "" }));
  const filtered = sortData(
    enriched.filter((s: any) => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.country_name.toLowerCase().includes(search.toLowerCase());
      const matchCountry = filterCountry === "all" || s.country_id === filterCountry;
      return matchSearch && matchCountry;
    }),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <Input placeholder="Buscar estado..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          <Select value={filterCountry} onValueChange={setFilterCountry}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filtrar país" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">Todos os países</SelectItem>
              {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <>
            <Button size="sm" onClick={() => setDialogOpen(true)}>+ Estado/Região</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Editar Estado/Região" : "Novo Estado/Região"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label>País <span className="text-destructive">*</span></Label>
                    <Select value={form.country_id} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o país" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do estado/região" /></div>
                  <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.country_id}>{editing ? "Salvar" : "Adicionar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{filtered.length} estado(s)/região(ões)</div>
      {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <SortableHead label="País" sortKey="country_name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.country_name}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>✏️</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm">🗑️</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir estado/região?</AlertDialogTitle>
                              <AlertDialogDescription>Excluir {s.name} pode afetar cidades associadas.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length > 100 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm">Mostrando 100 de {filtered.length}. Use a busca para refinar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Cities Sub-Tab ──

function CitiesSubTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", country_id: "", state_id: "" });
  const [sort, setSort] = useState<SortState>(null);
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterState, setFilterState] = useState("all");

  const { data: countries = [] } = useCountries();
  const { data: statesForFilter = [] } = useStates(filterCountry !== "all" ? filterCountry : undefined);
  const { data: statesForForm = [] } = useStates(form.country_id || undefined);
  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["locations-cities-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("*, countries(name), states(name)").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, country_id: form.country_id, state_id: form.state_id || null };
      if (editing) {
        const { error } = await supabase.from("cities").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-cities"] });
      queryClient.invalidateQueries({ queryKey: ["locations-cities-all"] });
      toast({ title: editing ? "Cidade atualizada" : "Cidade adicionada" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-cities"] });
      queryClient.invalidateQueries({ queryKey: ["locations-cities-all"] });
      toast({ title: "Cidade removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({ name: "", country_id: "", state_id: "" }); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, country_id: c.country_id, state_id: c.state_id || "" }); setDialogOpen(true); };

  const enriched = (cities ?? []).map((c: any) => ({
    ...c,
    country_name: c.countries?.name ?? "",
    state_name: c.states?.name ?? "",
  }));
  const filtered = sortData(
    enriched.filter((c: any) => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.country_name.toLowerCase().includes(search.toLowerCase()) || c.state_name.toLowerCase().includes(search.toLowerCase());
      const matchCountry = filterCountry === "all" || c.country_id === filterCountry;
      const matchState = filterState === "all" || c.state_id === filterState;
      return matchSearch && matchCountry && matchState;
    }),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <Input placeholder="Buscar cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setFilterState("all"); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filtrar país" /></SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">Todos os países</SelectItem>
              {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {filterCountry !== "all" && (statesForFilter as any[]).length > 0 && (
            <Select value={filterState} onValueChange={setFilterState}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Filtrar estado" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Todos os estados</SelectItem>
                {(statesForFilter as any[]).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {isAdmin && (
          <>
            <Button size="sm" onClick={() => setDialogOpen(true)}>+ Cidade</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Editar Cidade" : "Nova Cidade"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label>País <span className="text-destructive">*</span></Label>
                    <Select value={form.country_id} onValueChange={(v) => setForm({ ...form, country_id: v, state_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o país" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {countries.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estado/Região</Label>
                    <Select value={form.state_id} onValueChange={(v) => setForm({ ...form, state_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {statesForForm.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da cidade" /></div>
                  <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.country_id}>{editing ? "Salvar" : "Adicionar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{filtered.length} cidade(s)</div>
      {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <SortableHead label="Estado/Região" sortKey="state_name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <SortableHead label="País" sortKey="country_name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.state_name || "—"}</TableCell>
                  <TableCell>{c.country_name}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>✏️</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm">🗑️</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir cidade?</AlertDialogTitle>
                              <AlertDialogDescription>Tem certeza que deseja excluir {c.name}?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
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

// ── Continents Sub-Tab ──

export function useContinents() {
  return useQuery({
    queryKey: ["locations-continents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("continents").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useContinentCountries(continentId?: string) {
  return useQuery({
    queryKey: ["continent-countries", continentId],
    queryFn: async () => {
      let q = supabase.from("continent_countries").select("*, continents(name), countries(name)").order("created_at");
      if (continentId) q = q.eq("continent_id", continentId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

function ContinentsSubTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const { data: continents = [], isLoading } = useContinents();
  const { data: countries = [] } = useCountries();
  const { data: allContinentCountries = [] } = useContinentCountries();

  const saveMutation = useMutation({
    mutationFn: async () => {
      let continentId: string;
      if (editing) {
        const { error } = await supabase.from("continents").update({ name }).eq("id", editing.id);
        if (error) throw error;
        continentId = editing.id;
      } else {
        const { data, error } = await supabase.from("continents").insert({ name }).select("id").single();
        if (error) throw error;
        continentId = data.id;
      }
      // Sync countries
      await supabase.from("continent_countries").delete().eq("continent_id", continentId);
      if (selectedCountryIds.length > 0) {
        const { error } = await supabase.from("continent_countries").insert(
          selectedCountryIds.map(cid => ({ continent_id: continentId, country_id: cid }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-continents"] });
      queryClient.invalidateQueries({ queryKey: ["continent-countries"] });
      toast({ title: editing ? "Continente atualizado" : "Continente adicionado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("continents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations-continents"] });
      queryClient.invalidateQueries({ queryKey: ["continent-countries"] });
      toast({ title: "Continente removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setName(""); setSelectedCountryIds([]); setCountrySearch(""); };
  const openEdit = (c: any) => {
    setEditing(c);
    setName(c.name);
    const linked = allContinentCountries.filter((cc: any) => cc.continent_id === c.id).map((cc: any) => cc.country_id);
    setSelectedCountryIds(linked);
    setDialogOpen(true);
  };

  const countriesPerContinent = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cc of allContinentCountries as any[]) {
      if (!map[cc.continent_id]) map[cc.continent_id] = [];
      map[cc.continent_id].push(cc.countries?.name ?? "");
    }
    return map;
  }, [allContinentCountries]);

  const filtered = sortData(
    continents.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase())),
    sort
  );

  const filteredCountriesForDialog = countries.filter((c: any) =>
    !countrySearch || c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar continente..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <>
            <Button size="sm" onClick={() => setDialogOpen(true)}>+ Continente</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing ? "Editar Continente" : "Novo Continente"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do continente" /></div>
                  <div>
                    <Label>Países do continente</Label>
                    <Input placeholder="Buscar país..." value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} className="mt-1 mb-2" />
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {filteredCountriesForDialog.map((c: any) => (
                        <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedCountryIds.includes(c.id)}
                            onCheckedChange={(checked) => setSelectedCountryIds(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{selectedCountryIds.length} país(es) selecionado(s)</p>
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={!name}>{editing ? "Salvar" : "Adicionar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{filtered.length} continente(s)</div>
      {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <TableHead>Países</TableHead>
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(countriesPerContinent[c.id] ?? []).join(", ") || "—"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>✏️</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm">🗑️</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir continente?</AlertDialogTitle>
                              <AlertDialogDescription>Excluir {c.name}? Os vínculos com países serão removidos.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Custom Destinations (Diversos) Sub-Tab ──

export function useCustomDestinations() {
  return useQuery({
    queryKey: ["custom-destinations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_destinations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomDestinationItems(customDestId?: string) {
  return useQuery({
    queryKey: ["custom-destination-items", customDestId],
    queryFn: async () => {
      let q = supabase.from("custom_destination_items").select("*");
      if (customDestId) q = q.eq("custom_destination_id", customDestId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

function DiversosSubTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [selectedItems, setSelectedItems] = useState<{ type: string; id: string; label: string }[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [sort, setSort] = useState<SortState>(null);

  const { data: customDests = [], isLoading } = useCustomDestinations();
  const { data: allItems = [] } = useCustomDestinationItems();
  const { data: continents = [] } = useContinents();
  const { data: countries = [] } = useCountries();
  const { data: states = [] } = useStates();
  const { data: cities = [] } = useCities();

  // Build searchable options
  const allOptions = useMemo(() => {
    const opts: { type: string; id: string; label: string; group: string }[] = [];
    for (const c of continents) opts.push({ type: "continent", id: c.id, label: c.name, group: "Continentes" });
    for (const c of countries) opts.push({ type: "country", id: c.id, label: c.name, group: "Países" });
    for (const s of states as any[]) opts.push({ type: "state", id: s.id, label: `${s.name} (${s.countries?.name ?? ""})`, group: "Estados/Regiões" });
    for (const c of cities as any[]) opts.push({ type: "city", id: c.id, label: `${c.name} (${c.countries?.name ?? ""})`, group: "Cidades" });
    return opts;
  }, [continents, countries, states, cities]);

  const filteredOptions = useMemo(() => {
    if (!itemSearch) return allOptions.slice(0, 50);
    const q = itemSearch.toLowerCase();
    return allOptions.filter(o => o.label.toLowerCase().includes(q)).slice(0, 50);
  }, [allOptions, itemSearch]);

  // Build label map
  const labelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of allOptions) map[`${o.type}:${o.id}`] = o.label;
    return map;
  }, [allOptions]);

  const itemsPerDest = useMemo(() => {
    const map: Record<string, { type: string; id: string }[]> = {};
    for (const item of allItems as any[]) {
      if (!map[item.custom_destination_id]) map[item.custom_destination_id] = [];
      map[item.custom_destination_id].push({ type: item.item_type, id: item.item_id });
    }
    return map;
  }, [allItems]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let destId: string;
      if (editing) {
        const { error } = await supabase.from("custom_destinations").update({ name: formName, description: formDesc }).eq("id", editing.id);
        if (error) throw error;
        destId = editing.id;
      } else {
        const { data, error } = await supabase.from("custom_destinations").insert({ name: formName, description: formDesc }).select("id").single();
        if (error) throw error;
        destId = data.id;
      }
      await supabase.from("custom_destination_items").delete().eq("custom_destination_id", destId);
      if (selectedItems.length > 0) {
        const { error } = await supabase.from("custom_destination_items").insert(
          selectedItems.map(si => ({ custom_destination_id: destId, item_type: si.type, item_id: si.id }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-destinations"] });
      queryClient.invalidateQueries({ queryKey: ["custom-destination-items"] });
      toast({ title: editing ? "Destino atualizado" : "Destino adicionado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_destinations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-destinations"] });
      queryClient.invalidateQueries({ queryKey: ["custom-destination-items"] });
      toast({ title: "Destino removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setFormName(""); setFormDesc(""); setSelectedItems([]); setItemSearch(""); };
  const openEdit = (d: any) => {
    setEditing(d);
    setFormName(d.name);
    setFormDesc(d.description ?? "");
    const items = (itemsPerDest[d.id] ?? []).map(i => ({
      type: i.type, id: i.id, label: labelMap[`${i.type}:${i.id}`] ?? "Desconhecido"
    }));
    setSelectedItems(items);
    setDialogOpen(true);
  };

  const toggleItem = (opt: { type: string; id: string; label: string }) => {
    const exists = selectedItems.some(si => si.type === opt.type && si.id === opt.id);
    if (exists) setSelectedItems(selectedItems.filter(si => !(si.type === opt.type && si.id === opt.id)));
    else setSelectedItems([...selectedItems, { type: opt.type, id: opt.id, label: opt.label }]);
  };

  const typeLabels: Record<string, string> = { continent: "Continente", country: "País", state: "Estado", city: "Cidade" };

  const filtered = sortData(
    customDests.filter((d: any) => d.name.toLowerCase().includes(search.toLowerCase())),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar destino..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <>
            <Button size="sm" onClick={() => setDialogOpen(true)}>+ Destino</Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing ? "Editar Destino" : "Novo Destino"}</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Praias do Caribe" /></div>
                  <div><Label>Descrição</Label><Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Descrição opcional" /></div>
                  <div>
                    <Label>Localidades incluídas</Label>
                    <Input placeholder="Buscar continente, país, estado ou cidade..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} className="mt-1 mb-2" />
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                      {filteredOptions.map((o) => {
                        const isSelected = selectedItems.some(si => si.type === o.type && si.id === o.id);
                        return (
                          <label key={`${o.type}-${o.id}`} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleItem(o)} />
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{typeLabels[o.type]}</span>
                            {o.label}
                          </label>
                        );
                      })}
                    </div>
                    {selectedItems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedItems.map((si) => (
                          <span key={`${si.type}-${si.id}`} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {si.label}
                            <button type="button" onClick={() => toggleItem(si)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={!formName}>{editing ? "Salvar" : "Adicionar"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
      <div className="text-sm text-muted-foreground">{filtered.length} destino(s)</div>
      {isLoading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <TableHead>Descrição</TableHead>
                <TableHead>Itens</TableHead>
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">Nenhum destino cadastrado.</TableCell></TableRow>
              ) : (
                filtered.map((d: any) => {
                  const items = itemsPerDest[d.id] ?? [];
                  const labels = items.map(i => labelMap[`${i.type}:${i.id}`] ?? "?").join(", ");
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.description || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{labels || "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>✏️</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="sm">🗑️</Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir destino?</AlertDialogTitle>
                                  <AlertDialogDescription>Excluir "{d.name}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(d.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Main Locations Tab ──

export default function LocationsTab() {
  return (
    <Tabs defaultValue="continents" className="space-y-4">
      <TabsList>
        <TabsTrigger value="continents">Continentes</TabsTrigger>
        <TabsTrigger value="countries">Países</TabsTrigger>
        <TabsTrigger value="states">Estados/Regiões</TabsTrigger>
        <TabsTrigger value="cities">Cidades</TabsTrigger>
        <TabsTrigger value="diversos">Diversos</TabsTrigger>
      </TabsList>
      <TabsContent value="continents"><ContinentsSubTab /></TabsContent>
      <TabsContent value="countries"><CountriesSubTab /></TabsContent>
      <TabsContent value="states"><StatesSubTab /></TabsContent>
      <TabsContent value="cities"><CitiesSubTab /></TabsContent>
      <TabsContent value="diversos"><DiversosSubTab /></TabsContent>
    </Tabs>
  );
}
