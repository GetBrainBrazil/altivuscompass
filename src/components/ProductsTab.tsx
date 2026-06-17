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
          <Button size="sm" onClick={() => navigate("/catalog/new")}>+ Novo produto</Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} produto(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                <TableHead className="hidden sm:table-cell w-32">Preço</TableHead>
                <TableHead className="w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow
                  key={p.id}
                  className={isAdmin ? "cursor-pointer hover:bg-muted/40" : undefined}
                  onClick={isAdmin ? () => navigate(`/catalog/${p.id}/edit`) : undefined}
                >
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                  </TableCell>
                  <TableCell>
                    {p.item_type ? (
                      <Badge variant="outline">{TYPE_LABEL[p.item_type] ?? p.item_type}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{p.product_categories?.name || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{p.suppliers?.name || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">{formatBRL(p.sale_price)}</TableCell>
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
