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
import PrivateImage from "@/components/PrivateImage";
import { ImageIcon } from "lucide-react";
import { getCategoryOptions } from "@/lib/type-schema";




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

const TYPE_LABEL: Record<string, string> = {
  hospedagem: "Hospedagem",
  voo: "Voo",
  transporte: "Transporte",
  experiencia: "Experiência",
  seguro: "Seguro",
  cruzeiro: "Cruzeiro",
  outro: "Outro",
};

const TYPE_KEYS = ["hospedagem", "voo", "transporte", "experiencia", "seguro", "cruzeiro", "outro"] as const;

const FALLBACK_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  transporte: [
    { value: "carro", label: "Carro" },
    { value: "van", label: "Van" },
    { value: "onibus", label: "Ônibus" },
    { value: "trem", label: "Trem" },
    { value: "barco", label: "Barco" },
  ],
  experiencia: [
    { value: "passeio", label: "Passeio" },
    { value: "ingresso", label: "Ingresso" },
    { value: "gastronomia", label: "Gastronomia" },
  ],
  seguro: [
    { value: "viagem", label: "Viagem" },
    { value: "bagagem", label: "Bagagem" },
  ],
  cruzeiro: [
    { value: "maritimo", label: "Marítimo" },
    { value: "fluvial", label: "Fluvial" },
  ],
  outro: [],
};

function ProductsListSubTab({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, suppliers(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });


  const categoryOptionsForType = (type: string | null | undefined): { value: string; label: string }[] => {
    if (!type) return [];
    const fromSchema = getCategoryOptions(type);
    if (fromSchema.length) return fromSchema;
    return FALLBACK_CATEGORIES[type] ?? [];
  };

  const formatBRL = (value: number | null) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const categoryLabel = (type: string | null, value: string | null) => {
    if (!value) return "—";
    const opts = categoryOptionsForType(type);
    return opts.find((o) => o.value === value)?.label ?? value;
  };

  const filtered = products.filter((p: any) => {
    if (!showInactive && !p.is_active) return false;
    const cat = (p.attributes as any)?.categoria ?? null;
    if (typeFilter !== "all" && p.item_type !== typeFilter) return false;
    if (categoryFilter !== "all" && cat !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.name, p.description, categoryLabel(p.item_type, cat), p.suppliers?.name, TYPE_LABEL[p.item_type] ?? p.item_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handleTypeChange = (v: string) => {
    setTypeFilter(v);
    setCategoryFilter("all");
  };

  const categoryOpts = typeFilter === "all" ? [] : categoryOptionsForType(typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TYPE_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            disabled={typeFilter === "all" || categoryOpts.length === 0}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder={typeFilter === "all" ? "Todas as categorias" : "Categoria"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categoryOpts.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground px-1 whitespace-nowrap">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Inativos
          </label>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => navigate("/catalog/new")}>+ Novo produto</Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} produto(s)</div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum produto com esses filtros.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-32">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                <TableHead className="hidden sm:table-cell w-32">Preço</TableHead>
                <TableHead className="w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => {
                const cat = (p.attributes as any)?.categoria ?? null;
                return (
                  <TableRow
                    key={p.id}
                    className={isAdmin ? "cursor-pointer hover:bg-muted/40" : undefined}
                    onClick={isAdmin ? () => navigate(`/catalog/${p.id}/edit`) : undefined}
                  >
                    <TableCell>
                      <div className="w-12 h-12 rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                        {p.cover_image ? (
                          <PrivateImage bucket="product-images" source={p.cover_image} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
                        )}
                      </div>
                    </TableCell>
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
                    <TableCell className="hidden md:table-cell text-muted-foreground">{categoryLabel(p.item_type, cat)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{p.suppliers?.name || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">{formatBRL(p.sale_price)}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
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
