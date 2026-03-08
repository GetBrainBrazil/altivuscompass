import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRIES_STATES, COUNTRY_LIST } from "@/lib/countries-states";
import LocationsTab from "@/components/LocationsTab";

import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

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
    const cmp = va.localeCompare(vb);
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function toggleSort(sort: SortState, key: string): SortState {
  if (sort?.key === key) {
    if (sort.dir === "asc") return { key, dir: "desc" };
    return null; // third click → reset
  }
  return { key, dir: "asc" };
}

// ── Airports Tab ──

function AirportsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ iata_code: "", name: "", city: "", state: "", country: "" });
  const [sort, setSort] = useState<SortState>(null);

  const { data: airports = [], isLoading } = useQuery({
    queryKey: ["airports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airports").select("*").order("iata_code");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, iata_code: form.iata_code.toUpperCase() };
      if (editing) {
        const { error } = await supabase.from("airports").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("airports").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["airports"] });
      toast({ title: editing ? "Aeroporto atualizado" : "Aeroporto adicionado" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("airports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["airports"] });
      toast({ title: "Aeroporto removido" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ iata_code: "", name: "", city: "", state: "", country: "" });
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ iata_code: a.iata_code, name: a.name, city: a.city, state: a.state || "", country: a.country });
    setDialogOpen(true);
  };

  const filtered = sortData(
    airports.filter((a: any) =>
      [a.iata_code, a.name, a.city, a.country].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
    ),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar aeroporto..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm">+ Aeroporto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar Aeroporto" : "Novo Aeroporto"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Código IATA <span className="text-destructive">*</span></Label><Input value={form.iata_code} onChange={(e) => setForm({ ...form, iata_code: e.target.value })} maxLength={4} placeholder="GRU" /></div>
                  <div>
                    <Label>País <span className="text-destructive">*</span></Label>
                    <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v, state: "", city: "" })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o país" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRY_LIST.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aeroporto Internacional de Guarulhos" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Estado/Região</Label>
                    {form.country && COUNTRIES_STATES[form.country]?.length > 0 ? (
                      <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {COUNTRIES_STATES[form.country].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Estado/Região" />
                    )}
                  </div>
                  <div><Label>Cidade <span className="text-destructive">*</span></Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" /></div>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.iata_code || !form.name || !form.city || !form.country}>
                  {editing ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} aeroporto(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="IATA" sortKey="iata_code" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} className="w-20" />
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <SortableHead label="Cidade" sortKey="city" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <SortableHead label="Estado" sortKey="state" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} className="hidden sm:table-cell" />
                <SortableHead label="País" sortKey="country" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono font-bold text-primary">{a.iata_code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.city}</TableCell>
                  <TableCell className="hidden sm:table-cell">{a.state || "—"}</TableCell>
                  <TableCell>{a.country}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>✏️</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">🗑️</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir aeroporto?</AlertDialogTitle>
                              <AlertDialogDescription>Tem certeza que deseja excluir o aeroporto {a.iata_code} - {a.name}? Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length > 100 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Mostrando 100 de {filtered.length}. Use a busca para refinar.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Airlines Tab ──

function AirlinesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", iata_code: "", country: "", mileage_program_name: "", program_url: "" });
  const [sort, setSort] = useState<SortState>(null);

  const { data: airlines = [], isLoading } = useQuery({
    queryKey: ["airlines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airlines").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, iata_code: form.iata_code?.toUpperCase() || null };
      if (editing) {
        const { error } = await supabase.from("airlines").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("airlines").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["airlines"] });
      toast({ title: editing ? "Cia aérea atualizada" : "Cia aérea adicionada" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("airlines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["airlines"] });
      toast({ title: "Cia aérea removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", iata_code: "", country: "", mileage_program_name: "" });
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ name: a.name, iata_code: a.iata_code || "", country: a.country || "", mileage_program_name: a.mileage_program_name || "" });
    setDialogOpen(true);
  };

  const filtered = sortData(
    airlines.filter((a: any) =>
      [a.name, a.iata_code, a.country, a.mileage_program_name].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
    ),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar cia aérea..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm">+ Cia Aérea</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar Cia Aérea" : "Nova Cia Aérea"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="LATAM Airlines" /></div>
                  <div><Label>Código IATA</Label><Input value={form.iata_code} onChange={(e) => setForm({ ...form, iata_code: e.target.value })} maxLength={3} placeholder="LA" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>País <span className="text-destructive">*</span></Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Brasil" /></div>
                  <div><Label>Programa de Milhagem</Label><Input value={form.mileage_program_name} onChange={(e) => setForm({ ...form, mileage_program_name: e.target.value })} placeholder="LATAM Pass" /></div>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.country}>
                  {editing ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} cia(s) aérea(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="IATA" sortKey="iata_code" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} className="w-20" />
                <SortableHead label="Nome" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <SortableHead label="País" sortKey="country" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} className="hidden sm:table-cell" />
                <SortableHead label="Programa de Milhagem" sortKey="mileage_program_name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono font-bold text-primary">{a.iata_code || "—"}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{a.country || "—"}</TableCell>
                  <TableCell>{a.mileage_program_name || "—"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>✏️</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">🗑️</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir cia aérea?</AlertDialogTitle>
                              <AlertDialogDescription>Tem certeza que deseja excluir {a.name}? Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>Excluir</AlertDialogAction>
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

// ── Tags Tab ──

const TAG_COLORS = [
  { value: "blue", label: "Azul", class: "bg-blue-500/15 text-blue-600" },
  { value: "green", label: "Verde", class: "bg-green-500/15 text-green-600" },
  { value: "red", label: "Vermelho", class: "bg-red-500/15 text-red-600" },
  { value: "yellow", label: "Amarelo", class: "bg-yellow-500/15 text-yellow-700" },
  { value: "purple", label: "Roxo", class: "bg-purple-500/15 text-purple-600" },
  { value: "orange", label: "Laranja", class: "bg-orange-500/15 text-orange-600" },
  { value: "pink", label: "Rosa", class: "bg-pink-500/15 text-pink-600" },
  { value: "gray", label: "Cinza", class: "bg-muted text-muted-foreground" },
];

function getTagColorClass(color: string | null) {
  return TAG_COLORS.find((c) => c.value === color)?.class ?? "bg-primary/10 text-primary";
}

function TagsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", color: "blue" });
  const [sort, setSort] = useState<SortState>(null);

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Count how many clients use each tag
  const { data: clientsWithTags = [] } = useQuery({
    queryKey: ["clients-tags-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, tags");
      if (error) throw error;
      return data ?? [];
    },
  });

  const tagUsageCount = clientsWithTags.reduce((acc: Record<string, number>, client: any) => {
    (client.tags ?? []).forEach((tag: string) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        // If name changed, update clients that use the old tag name
        if (editing.name !== form.name) {
          const affectedClients = clientsWithTags.filter((c: any) => (c.tags ?? []).includes(editing.name));
          for (const client of affectedClients) {
            const newTags = (client.tags as string[]).map((t: string) => t === editing.name ? form.name : t);
            await supabase.from("clients").update({ tags: newTags }).eq("id", client.id);
          }
        }
        const { error } = await supabase.from("tags").update({ name: form.name, color: form.color }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tags").insert({ name: form.name, color: form.color });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["clients-tags-count"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: editing ? "Etiqueta atualizada" : "Etiqueta adicionada" });
      closeDialog();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (tag: any) => {
      // Remove tag from all clients that use it
      const affectedClients = clientsWithTags.filter((c: any) => (c.tags ?? []).includes(tag.name));
      for (const client of affectedClients) {
        const newTags = (client.tags as string[]).filter((t: string) => t !== tag.name);
        await supabase.from("clients").update({ tags: newTags }).eq("id", client.id);
      }
      const { error } = await supabase.from("tags").delete().eq("id", tag.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["clients-tags-count"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Etiqueta removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", color: "blue" });
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, color: t.color || "blue" });
    setDialogOpen(true);
  };

  const filtered = sortData(
    tags.filter((t: any) => t.name?.toLowerCase().includes(search.toLowerCase())),
    sort
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar etiqueta..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm">+ Etiqueta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar Etiqueta" : "Nova Etiqueta"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Nome <span className="text-destructive">*</span></Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: VIP, Corporativo, Frequente..." />
                </div>
                <div>
                  <Label>Cor</Label>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {TAG_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm({ ...form, color: c.value })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${c.class} ${form.color === c.value ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "opacity-60 hover:opacity-100"}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : editing ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} etiqueta(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Etiqueta" sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))} />
                <TableHead>Cor</TableHead>
                <TableHead>Clientes</TableHead>
                {isAdmin && <TableHead className="w-24">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">Nenhuma etiqueta cadastrada.</TableCell></TableRow>
              ) : (
                filtered.map((t: any) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30" onClick={() => isAdmin && openEdit(t)}>
                    <TableCell>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getTagColorClass(t.color)}`}>
                        {t.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{TAG_COLORS.find(c => c.value === t.color)?.label || "Padrão"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{tagUsageCount[t.name] || 0}</span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(t); }}>✏️</Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>🗑️</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir etiqueta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  A etiqueta "{t.name}" será removida de {tagUsageCount[t.name] || 0} cliente(s). Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(t)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function Registrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Cadastros</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie localidades, aeroportos, companhias aéreas e etiquetas</p>
      </div>

      <Tabs defaultValue="locations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">Localidades</TabsTrigger>
          <TabsTrigger value="airports">Aeroportos</TabsTrigger>
          <TabsTrigger value="airlines">Cias Aéreas & Programas</TabsTrigger>
          <TabsTrigger value="tags">Etiquetas</TabsTrigger>
        </TabsList>
        <TabsContent value="locations"><LocationsTab /></TabsContent>
        <TabsContent value="airports"><AirportsTab /></TabsContent>
        <TabsContent value="airlines"><AirlinesTab /></TabsContent>
        <TabsContent value="tags"><TagsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
