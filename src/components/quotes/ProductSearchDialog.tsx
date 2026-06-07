import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deriveItemTypeFromCategoryName } from "@/lib/category-schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
}

type Product = {
  id: string;
  name: string;
  cost: number | null;
  sale_price: number | null;
  category_id: string | null;
};

type Category = {
  id: string;
  name: string;
  is_active: boolean;
};

export function ProductSearchDialog({ open, onOpenChange, quoteId }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Painéis secundários
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", category_id: "", cost: 0, sale_price: 0 });


  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Carrega catálogo
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const [catsRes, prodsRes] = await Promise.all([
        supabase.from("product_categories").select("id, name, is_active").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, cost, sale_price, category_id").eq("is_active", true).order("name").limit(1000),
      ]);
      setCategories((catsRes.data as Category[]) ?? []);
      setProducts((prodsRes.data as Product[]) ?? []);
      setLoading(false);
    })();
  }, [open]);

  const grouped = useMemo(() => {
    const q = debounced.toLowerCase();
    const groups: { category: Category | null; products: Product[] }[] = [];
    for (const cat of categories) {
      const list = products
        .filter((p) => p.category_id === cat.id)
        .filter((p) => !q || p.name.toLowerCase().includes(q));
      if (list.length > 0 || !q) {
        if (list.length > 0) groups.push({ category: cat, products: list.slice(0, 50) });
      }
    }
    // Sem categoria
    const uncat = products
      .filter((p) => !p.category_id)
      .filter((p) => !q || p.name.toLowerCase().includes(q));
    if (uncat.length > 0) {
      groups.push({ category: null, products: uncat.slice(0, 50) });
    }
    return groups;
  }, [categories, products, debounced]);

  const handleClose = () => {
    setQuery("");
    setNewProductOpen(false);
    setNoProductOpen(false);
    onOpenChange(false);
  };

  const createItemFromProduct = async (p: Product, category: Category | null) => {
    setCreating(true);
    // sort_order = max+1
    const { data: maxRow } = await supabase
      .from("quote_items")
      .select("sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? -1) + 1;
    const itemType = deriveItemTypeFromCategoryName(category?.name);

    const { data, error } = await supabase
      .from("quote_items")
      .insert({
        quote_id: quoteId,
        product_id: p.id,
        item_type: itemType,
        title: p.name,
        unit_price: Number(p.sale_price ?? 0) || 0,
        unit_cost: Number(p.cost ?? 0) || 0,
        quantity: 1,
        details: {},
        sort_order: nextSort,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Erro ao adicionar item", description: error?.message, variant: "destructive" });
      return;
    }
    handleClose();
    navigate(`/quotes/${quoteId}/items/${data.id}`);
  };

  const handleCreateProduct = async () => {
    if (!newProd.name.trim()) {
      toast({ title: "Informe o nome do produto", variant: "destructive" });
      return;
    }
    setCreating(true);
    const cat = categories.find((c) => c.id === newProd.category_id) ?? null;
    const itemType = deriveItemTypeFromCategoryName(cat?.name);
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: newProd.name.trim(),
        category_id: newProd.category_id || null,
        item_type: itemType,
        cost: Number(newProd.cost) || 0,
        sale_price: Number(newProd.sale_price) || 0,
        currency: "BRL",
        is_active: true,
      })
      .select("id, name, cost, sale_price, category_id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Erro ao criar produto", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Produto cadastrado" });
    setNewProductOpen(false);
    setNewProd({ name: "", category_id: "", cost: 0, sale_price: 0 });
    await createItemFromProduct(data as Product, cat);
  };

  const handleCreateWithoutProduct = async () => {
    if (!noProductCategory) {
      toast({ title: "Escolha uma categoria", variant: "destructive" });
      return;
    }
    setCreating(true);
    const cat = categories.find((c) => c.id === noProductCategory) ?? null;
    const itemType = deriveItemTypeFromCategoryName(cat?.name);
    const { data: maxRow } = await supabase
      .from("quote_items")
      .select("sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? -1) + 1;
    const { data, error } = await supabase
      .from("quote_items")
      .insert({
        quote_id: quoteId,
        item_type: itemType,
        title: cat?.name ?? "Novo item",
        quantity: 1,
        details: {},
        sort_order: nextSort,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Erro ao criar item", description: error?.message, variant: "destructive" });
      return;
    }
    handleClose();
    navigate(`/quotes/${quoteId}/items/${data.id}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-3">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <DialogTitle className="font-display flex items-center gap-2">
              <Package className="w-4 h-4" /> Adicionar item
            </DialogTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => setNewProductOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" /> Novo produto
            </Button>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto em todas as categorias..."
              className="pl-8 h-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 min-h-[280px]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando catálogo...
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Nenhum produto encontrado{debounced ? ` para "${debounced}"` : ""}.
                </p>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setNewProductOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Cadastrar novo produto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map((g) => (
                  <div key={g.category?.id ?? "uncat"}>
                    <div className="sticky top-0 z-10 bg-background py-1.5 border-b border-border/60 mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.category?.name ?? "Sem categoria"} · {g.products.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-border/40">
                      {g.products.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={creating}
                            onClick={() => createItemFromProduct(p, g.category)}
                            className="w-full text-left px-2 py-2 hover:bg-accent rounded flex items-center justify-between gap-3 transition-colors disabled:opacity-50"
                          >
                            <span className="text-sm font-body truncate">{p.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {p.sale_price != null && Number(p.sale_price) > 0
                                ? `R$ ${Number(p.sale_price).toFixed(2)}`
                                : "—"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Fechar
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Novo produto */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Cadastrar novo produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                value={newProd.name}
                onChange={(e) => setNewProd((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Hotel Copacabana Palace"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={newProd.category_id}
                onValueChange={(v) => setNewProd((p) => ({ ...p, category_id: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Custo-base (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newProd.cost}
                  onChange={(e) => setNewProd((p) => ({ ...p, cost: Number(e.target.value) || 0 }))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preço-base (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newProd.sale_price}
                  onChange={(e) => setNewProd((p) => ({ ...p, sale_price: Number(e.target.value) || 0 }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewProductOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateProduct} disabled={creating}>
              {creating ? "Salvando..." : "Cadastrar e usar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
