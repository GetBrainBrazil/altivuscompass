import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type FinancialCategory = {
  id: string; name: string; code: string | null; type: string;
  parent_id: string | null; description: string | null; is_active: boolean;
  account_nature: string;
  created_at: string; updated_at: string;
};

const typeLabels: Record<string, { label: string; color: string }> = {
  revenue: { label: "Receita", color: "bg-success/10 text-success" },
  expense: { label: "Despesa", color: "bg-destructive/10 text-destructive" },
  cost: { label: "Custo", color: "bg-gold/10 text-gold" },
  transfer: { label: "Transferência", color: "bg-muted text-muted-foreground" },
};

type SortDir = "asc" | "desc" | null;

function SortHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDir; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 group font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
      {label}
      {active && direction === "asc" ? <ArrowUp size={12} /> :
       active && direction === "desc" ? <ArrowDown size={12} /> :
       <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100" />}
    </button>
  );
}

function buildTree(categories: FinancialCategory[], parentId: string | null = null): (FinancialCategory & { children: any[] })[] {
  return categories
    .filter(c => c.parent_id === parentId)
    .map(c => ({ ...c, children: buildTree(categories, c.id) }));
}

export default function ChartOfAccountsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
  };

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["financial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_categories").select("*").order("code").order("name");
      if (error) throw error;
      return data as FinancialCategory[];
    },
  });

  // Flatten tree for table display, maintaining hierarchy via depth
  const flatList = useMemo(() => {
    if (sortKey && sortDir) {
      // When sorting, show flat list sorted by the key
      return [...categories].sort((a, b) => {
        const va = (a as any)[sortKey] ?? "";
        const vb = (b as any)[sortKey] ?? "";
        const cmp = String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      }).map(c => ({ ...c, depth: 0, hasChildren: categories.some(x => x.parent_id === c.id) }));
    }
    // Default: tree order
    const result: (FinancialCategory & { depth: number; hasChildren: boolean })[] = [];
    const flatten = (cats: (FinancialCategory & { children: any[] })[], depth: number) => {
      cats.forEach(c => {
        const hasChildren = c.children.length > 0;
        result.push({ ...c, depth, hasChildren });
        if (hasChildren && expandedIds.has(c.id)) {
          flatten(c.children, depth + 1);
        }
      });
    };
    flatten(buildTree(categories), 0);
    return result;
  }, [categories, expandedIds, sortKey, sortDir]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name, code: form.code || null, type: form.type || "expense",
        parent_id: form.parent_id || null, description: form.description || null,
        is_active: form.is_active ?? true,
      };
      if (editing) {
        const { error } = await supabase.from("financial_categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Categoria atualizada" : "Categoria criada" });
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Categoria removida" });
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = (parentId?: string) => {
    setEditing(null);
    setForm({ type: "expense", is_active: true, parent_id: parentId || null });
    setDialogOpen(true);
  };

  const openEdit = (c: FinancialCategory) => {
    setEditing(c);
    setForm({
      name: c.name, code: c.code ?? "", type: c.type, parent_id: c.parent_id ?? "",
      description: c.description ?? "", is_active: c.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({}); };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isSorting = !!sortKey && !!sortDir;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openCreate()} className="font-body text-xs sm:text-sm">
          <Plus size={16} /> Nova Categoria
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma categoria cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="p-4 text-left">
                  <SortHeader label="Código" active={sortKey === "code"} direction={sortKey === "code" ? sortDir : null} onClick={() => toggleSort("code")} />
                </th>
                <th className="p-4 text-left">
                  <SortHeader label="Nome" active={sortKey === "name"} direction={sortKey === "name" ? sortDir : null} onClick={() => toggleSort("name")} />
                </th>
                <th className="p-4 text-left">
                  <SortHeader label="Tipo" active={sortKey === "type"} direction={sortKey === "type" ? sortDir : null} onClick={() => toggleSort("type")} />
                </th>
                <th className="p-4 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="p-4 text-right font-medium text-xs uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {flatList.map((cat) => {
                const tp = typeLabels[cat.type] ?? typeLabels.expense;
                const isExpanded = expandedIds.has(cat.id);
                return (
                  <tr key={cat.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(cat)}>
                    <td className="p-4 font-body text-muted-foreground font-mono text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1" style={{ paddingLeft: isSorting ? 0 : `${cat.depth * 20}px` }}>
                        {!isSorting && cat.hasChildren ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
                            className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                          >
                            <ChevronRight size={12} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        ) : !isSorting ? (
                          <span className="h-5 w-5 shrink-0" />
                        ) : null}
                        {cat.code || "—"}
                      </div>
                    </td>
                    <td className="p-4 font-body font-medium text-foreground">
                      <div>
                        {cat.name}
                        {cat.description && <p className="text-xs text-muted-foreground font-normal mt-0.5">{cat.description}</p>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${tp.color}`}>{tp.label}</span>
                    </td>
                    <td className="p-4">
                      {cat.is_active ? (
                        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-success/10 text-success font-body">Ativa</span>
                      ) : (
                        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-body">Inativa</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openCreate(cat.id)} title="Adicionar subcategoria">
                          <Plus size={12} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(cat)}>
                          <Pencil size={12} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                              <Trash2 size={12} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {cat.hasChildren ? "Subcategorias ficarão órfãs. " : ""}Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(cat.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-body">Nome *</Label>
                <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Código</Label>
                <Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: 1.1.01" />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Tipo</Label>
                <Select value={form.type ?? "expense"} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="cost">Custo</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Categoria Pai</Label>
                <Select value={form.parent_id ?? "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (raiz)</SelectItem>
                    {categories.filter(c => c.id !== editing?.id).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code ? `${c.code} - ` : ""}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-body">Descrição</Label>
                <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="font-body">Categoria ativa</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog} className="font-body">Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="font-body">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
