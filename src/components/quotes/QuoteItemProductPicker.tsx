import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Package, AlertTriangle, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pickTemplateAttributes } from "@/lib/type-schema";

type Suggestion = {
  id: string;
  name: string;
  item_type: string | null;
  supplier_id: string | null;
  cost: number | null;
  sale_price: number | null;
  currency: string | null;
  similarity: number | null;
};

interface Props {
  itemType: string;
  productId: string | null | undefined;
  /** Permite que o picker pré-preencha custo/preço e atributos a partir do catálogo */
  onSelect: (patch: {
    product_id: string | null;
    title?: string;
    unit_cost?: number;
    unit_price?: number;
    /** Snapshot dos atributos template (apenas) do produto. */
    attributes?: Record<string, any>;
  }) => void;
}

export default function QuoteItemProductPicker({ itemType, productId, onSelect }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProd, setNewProd] = useState({ name: "", cost: 0, sale_price: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Carrega nome do produto já vinculado
  useEffect(() => {
    let cancelled = false;
    if (productId) {
      supabase
        .from("products")
        .select("name")
        .eq("id", productId)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data?.name) setSelectedName(data.name);
        });
    } else {
      setSelectedName(null);
    }
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("search_products", {
        q: debounced,
        _type: itemType,
      });
      if (cancelled) return;
      if (error) {
        setResults([]);
        return;
      }
      setResults((data as Suggestion[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, itemType, open]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = async (p: Suggestion) => {
    setSelectedName(p.name);
    setQuery("");
    setOpen(false);
    // Busca atributos do produto para snapshot no item
    let attributes: Record<string, any> | undefined;
    try {
      const { data } = await supabase
        .from("products")
        .select("attributes")
        .eq("id", p.id)
        .maybeSingle();
      const raw = (data as any)?.attributes;
      attributes = raw && typeof raw === "object" ? pickTemplateAttributes(itemType, raw) : undefined;
    } catch { /* segue sem atributos */ }
    onSelect({
      product_id: p.id,
      title: p.name,
      unit_cost: Number(p.cost ?? 0) || undefined,
      unit_price: Number(p.sale_price ?? 0) || undefined,
      attributes,
    });
  };

  const clearSelection = () => {
    setSelectedName(null);
    onSelect({ product_id: null });
  };

  const handleCreate = async () => {
    if (!newProd.name.trim()) {
      toast({ title: "Informe o nome do produto", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: newProd.name.trim(),
        item_type: itemType,
        cost: Number(newProd.cost) || 0,
        sale_price: Number(newProd.sale_price) || 0,
        currency: "BRL",
        is_active: true,
      })
      .select("id, name, cost, sale_price")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({
        title: "Erro ao criar produto",
        description: error?.message,
        variant: "destructive",
      });
      return;
    }
    setCreateOpen(false);
    setNewProd({ name: "", cost: 0, sale_price: 0 });
    setSelectedName(data.name);
    onSelect({
      product_id: data.id,
      title: data.name,
      unit_cost: Number(data.cost ?? 0) || undefined,
      unit_price: Number(data.sale_price ?? 0) || undefined,
    });
    toast({ title: "Produto cadastrado no catálogo" });
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Package className="w-3 h-3" />
          Produto do catálogo
        </Label>
        {!productId && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            produto não cadastrado
          </span>
        )}
      </div>

      {productId && selectedName ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/30 px-2.5 py-1.5">
          <span className="text-xs inline-flex items-center gap-1.5 font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            {selectedName}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="text-[11px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> trocar
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar produto no catálogo (ignora acento/ordem)..."
            className="h-8 text-xs"
          />
          {open && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
              {results.length > 0 ? (
                <ul className="py-1">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pick(p)}
                        className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {p.sale_price != null
                            ? `R$ ${Number(p.sale_price).toFixed(2)}`
                            : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  Nenhum produto parecido. Use o botão abaixo para cadastrar.
                </div>
              )}
              <div className="border-t p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-7 text-xs gap-1.5"
                  onClick={() => {
                    setNewProd({ name: query, cost: 0, sale_price: 0 });
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" /> Criar novo produto
                  {query ? <span className="text-muted-foreground">"{query}"</span> : null}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo produto no catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                value={newProd.name}
                onChange={(e) => setNewProd((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Hotel Copacabana"
                className="h-8 text-xs"
              />
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
              Tipo: <strong>{itemType}</strong> — valores abaixo são <strong>referência de catálogo</strong>. O preço cobrado nessa cotação você ajusta no item.
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
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Salvando..." : "Cadastrar e usar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
