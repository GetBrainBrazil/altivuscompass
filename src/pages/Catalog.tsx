import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Search, Tag } from "lucide-react";
import { ITEM_TYPES } from "@/lib/item-types";

// Voo fica fora do catálogo (dinâmico).
const CATALOG_TYPES: Array<{ value: string; label: string }> = [
  { value: "hotel", label: "Hospedagem" },
  { value: "experience", label: "Experiência" },
  { value: "transport", label: "Transporte" },
  { value: "cruise", label: "Cruzeiro" },
  { value: "insurance", label: "Seguro" },
  { value: "other_service", label: "Outro serviço" },
];

const typeLabel = (t: string | null | undefined) =>
  CATALOG_TYPES.find((x) => x.value === t)?.label ??
  ITEM_TYPES[t as keyof typeof ITEM_TYPES]?.label ??
  t ??
  "—";

const formatBRL = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

type FormState = {
  id?: string;
  name: string;
  item_type: string;
  description: string;
  destination: string;
  supplier_id: string;
  category_id: string;
  cost: string | number | "";
  sale_price: string | number | "";
  currency: string;
  tags: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  item_type: "hotel",
  description: "",
  destination: "",
  supplier_id: "",
  category_id: "",
  cost: "",
  sale_price: "",
  currency: "BRL",
  tags: "",
  is_active: true,
};

export default function Catalog() {
  const { userRole, user } = useAuth();
  const isManagerPlus = userRole === "admin" || userRole === "manager";
  const canSeeCost = isManagerPlus;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["catalog-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, suppliers(name), product_categories(name)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["catalog-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products as any[]).filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (typeFilter !== "all" && p.item_type !== typeFilter) return false;
      if (!q) return true;
      return [p.name, p.description, p.destination, p.suppliers?.name, p.product_categories?.name]
        .some((f: string | null) => f?.toLowerCase().includes(q));
    });
  }, [products, search, typeFilter, showInactive]);

  const openNew = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name ?? "",
      item_type: p.item_type ?? "hotel",
      description: p.description ?? "",
      destination: p.destination ?? "",
      supplier_id: p.supplier_id ?? "",
      category_id: p.category_id ?? "",
      cost: p.cost ?? "",
      sale_price: p.sale_price ?? "",
      currency: p.currency ?? "BRL",
      tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
      is_active: p.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do produto.");
      if (!form.item_type) throw new Error("Selecione o tipo.");
      const payload: any = {
        name: form.name.trim(),
        item_type: form.item_type,
        description: form.description || null,
        destination: form.destination || null,
        supplier_id: form.supplier_id || null,
        category_id: form.category_id || null,
        sale_price: form.sale_price !== "" ? Number(form.sale_price) : null,
        currency: form.currency || "BRL",
        tags: form.tags
          ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        is_active: form.is_active,
      };
      if (canSeeCost) {
        payload.cost = form.cost !== "" ? Number(form.cost) : null;
      }
      if (form.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog-products"] });
      toast({ title: form.id ? "Produto atualizado" : "Produto cadastrado" });
      setDialogOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display flex items-center gap-2">
            <Package className="w-6 h-6" />
            Catálogo de Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Produtos reutilizáveis que podem ser puxados para dentro de uma cotação.
            Voos não entram no catálogo.
          </p>
        </div>
        {isManagerPlus && (
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Novo produto
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, destino, fornecedor…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {CATALOG_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Ver inativos
          </label>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado.
            {isManagerPlus && (
              <div className="mt-3">
                <Button onClick={openNew} size="sm" variant="outline" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Cadastrar primeiro produto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p: any) => (
            <Card
              key={p.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                !p.is_active ? "opacity-60" : ""
              }`}
              onClick={() => openEdit(p)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2">{p.name}</h3>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {typeLabel(p.item_type)}
                  </Badge>
                </div>
                {p.destination && (
                  <p className="text-xs text-muted-foreground">{p.destination}</p>
                )}
                {p.suppliers?.name && (
                  <p className="text-xs text-muted-foreground truncate">
                    Fornecedor: {p.suppliers.name}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1 border-t">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Preço
                    </p>
                    <p className="text-sm font-semibold">{formatBRL(p.sale_price)}</p>
                  </div>
                  {canSeeCost && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Custo
                      </p>
                      <p className="text-sm text-muted-foreground">{formatBRL(p.cost)}</p>
                    </div>
                  )}
                </div>
                {!p.is_active && (
                  <Badge variant="outline" className="text-[10px]">
                    Inativo
                  </Badge>
                )}
                {Array.isArray(p.tags) && p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.tags.slice(0, 3).map((t: string) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <Label>
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Hotel Copacabana Palace — Vista Mar"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Tipo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.item_type}
                  onValueChange={(v) => setForm({ ...form, item_type: v })}
                  disabled={!isManagerPlus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOG_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                disabled={!isManagerPlus}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Destino</Label>
                <Input
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  placeholder="Ex.: Rio de Janeiro / RJ"
                  disabled={!isManagerPlus}
                />
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Select
                  value={form.supplier_id || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, supplier_id: v === "none" ? "" : v })
                  }
                  disabled={!isManagerPlus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem fornecedor —</SelectItem>
                    {(suppliers as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {canSeeCost && (
                <div className="space-y-1">
                  <Label>Custo-base (R$)</Label>
                  <CurrencyInput
                    value={form.cost as any}
                    onChange={(v) => setForm({ ...form, cost: (v ?? "") as any })}
                    placeholder="0,00"
                    disabled={!isManagerPlus}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label>Preço-base (R$)</Label>
                <CurrencyInput
                  value={form.sale_price as any}
                  onChange={(v) => setForm({ ...form, sale_price: (v ?? "") as any })}
                  placeholder="0,00"
                  disabled={!isManagerPlus}
                />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select
                  value={form.category_id || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, category_id: v === "none" ? "" : v })
                  }
                  disabled={!isManagerPlus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem categoria —</SelectItem>
                    {(categories as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Ex.: praia, luxo, café da manhã"
                disabled={!isManagerPlus}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                disabled={!isManagerPlus}
              />
              <Label>Ativo</Label>
            </div>

            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-2">
              Valores aqui são <strong>referência de catálogo</strong>. Quando o produto for
              puxado para uma cotação, custo e preço viram <strong>cópia editável</strong> dentro
              do item — alterações futuras no catálogo não mudam cotações já criadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            {isManagerPlus && (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
