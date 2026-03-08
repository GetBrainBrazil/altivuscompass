import { useState } from "react";
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

  const { data: countries = [] } = useCountries();
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
      return matchSearch && matchCountry;
    }),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-lg">
          <Input placeholder="Buscar cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
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

// ── Main Locations Tab ──

export default function LocationsTab() {
  return (
    <Tabs defaultValue="countries" className="space-y-4">
      <TabsList>
        <TabsTrigger value="countries">Países</TabsTrigger>
        <TabsTrigger value="states">Estados/Regiões</TabsTrigger>
        <TabsTrigger value="cities">Cidades</TabsTrigger>
      </TabsList>
      <TabsContent value="countries"><CountriesSubTab /></TabsContent>
      <TabsContent value="states"><StatesSubTab /></TabsContent>
      <TabsContent value="cities"><CitiesSubTab /></TabsContent>
    </Tabs>
  );
}
