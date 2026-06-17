import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { logAuditEvent } from "@/lib/audit";
import { Layers, Trash2 } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";



function CategoriesSubTab({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = categories.filter((c: any) =>
    [c.name, c.description].some((f: string) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const openCategory = (id: string) => navigate(`/registrations/categories/${id}/fields`);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Button size="sm" onClick={() => navigate("/registrations/categories/new/fields")}>+ Categoria</Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} categoria(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                <TableHead className="w-28">Campos</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => openCategory(c.id)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.description || "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs tabular-nums">
                        {Array.isArray(c.field_schema) ? c.field_schema.length : 0}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Ativa" : "Inativa"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

    </div>
  );
}

function ProductsListSubTab({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name), suppliers(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = products.filter((p: any) =>
    [p.name, p.description, p.product_categories?.name, p.suppliers?.name, p.item_type].some((f: string) =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const formatBRL = (value: number | null) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const TYPE_LABEL: Record<string, string> = {
    hospedagem: "Hospedagem",
    experiencia: "Experiência",
    seguro: "Seguro",
    transporte: "Transporte",
    cruzeiro: "Cruzeiro",
    outro: "Outro",
  };



  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        {isAdmin && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>+ Produto</Button>
        )}
      </div>

      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 gap-3">
                <div><Label>Nome <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Transfer aeroporto GRU" /></div>
              </div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem categoria —</SelectItem>
                      {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem fornecedor —</SelectItem>
                      {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Markup <span className="text-xs font-normal text-muted-foreground">— escolha apenas um</span></Label>
                <RadioGroup
                  value={form.markup_type}
                  onValueChange={(v) => setForm({ ...form, markup_type: v as "percent" | "fixed" })}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="mk-percent"
                    className={cn(
                      "flex items-center gap-2 rounded-md border bg-background p-2.5 cursor-pointer transition-colors",
                      form.markup_type === "percent" ? "border-primary ring-1 ring-primary/30" : "border-input hover:bg-muted/40"
                    )}
                  >
                    <RadioGroupItem value="percent" id="mk-percent" />
                    <span className="text-sm whitespace-nowrap">Percentual (%)</span>
                    <div className="ml-auto w-24">
                      <CurrencyInput
                        prefix=""
                        decimals={2}
                        value={form.markup_percent}
                        onChange={(v) => setForm({ ...form, markup_type: "percent", markup_percent: v ?? "" })}
                        placeholder="0,00"
                        disabled={form.markup_type !== "percent"}
                        className="h-8 text-xs"
                      />
                    </div>
                  </label>
                  <label
                    htmlFor="mk-fixed"
                    className={cn(
                      "flex items-center gap-2 rounded-md border bg-background p-2.5 cursor-pointer transition-colors",
                      form.markup_type === "fixed" ? "border-primary ring-1 ring-primary/30" : "border-input hover:bg-muted/40"
                    )}
                  >
                    <RadioGroupItem value="fixed" id="mk-fixed" />
                    <span className="text-sm whitespace-nowrap">Fixo (R$)</span>
                    <div className="ml-auto w-28">
                      <CurrencyInput
                        decimals={2}
                        value={form.markup_fixed}
                        onChange={(v) => setForm({ ...form, markup_type: "fixed", markup_fixed: v ?? "" })}
                        placeholder="0,00"
                        disabled={form.markup_type !== "fixed"}
                        className="h-8 text-xs"
                      />
                    </div>
                  </label>
                </RadioGroup>
              </div>


              <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Ativo</Label>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t">
                <div className="flex flex-col gap-1">
                  {editing && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="text-destructive hover:text-destructive border-destructive/30 w-fit"
                          disabled={quoteCount > 0}
                          title={quoteCount > 0 ? `Existem ${quoteCount} negócio(s) vinculados` : "Excluir produto"}
                        >
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Excluir produto
                          {quoteCount > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({quoteCount} negócio{quoteCount > 1 ? "s" : ""})
                            </span>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir "{form.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(editing.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {editing && quoteCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Para excluir, remova este produto dos {quoteCount} negócio(s) vinculados.
                    </p>
                  )}
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.name}>
                  {editing ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="text-sm text-muted-foreground">{filtered.length} produto(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                <TableHead className="hidden sm:table-cell">Markup</TableHead>
                <TableHead className="w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow
                  key={p.id}
                  className={isAdmin ? "cursor-pointer hover:bg-muted/40" : undefined}
                  onClick={isAdmin ? () => openEdit(p) : undefined}
                >
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{p.product_categories?.name || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{p.suppliers?.name || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">{formatMarkup(p)}</TableCell>

                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function ProductsTab() {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin" || userRole === "manager";
  const [tab, setTab] = useState<string>(() => {
    try { return localStorage.getItem("registrations:products-tab") || "list"; } catch { return "list"; }
  });
  const handleTab = (v: string) => {
    setTab(v);
    try { localStorage.setItem("registrations:products-tab", v); } catch {}
  };

  return (
    <Tabs value={tab} onValueChange={handleTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="list">Produtos</TabsTrigger>
        <TabsTrigger value="categories">Categorias</TabsTrigger>
      </TabsList>
      <TabsContent value="list"><ProductsListSubTab isAdmin={isAdmin} /></TabsContent>
      <TabsContent value="categories"><CategoriesSubTab isAdmin={isAdmin} /></TabsContent>
    </Tabs>
  );
}
