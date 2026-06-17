import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { ArrowLeft, ChevronRight, Loader2, Upload, X } from "lucide-react";
import PrivateImage from "@/components/PrivateImage";
import { DynamicCategoryFields } from "@/components/quotes/DynamicCategoryFields";
import {
  hasTypeSchema,
  getTypeSchema,
  getTemplateFields,
  isValidCategoryForType,
  asCategorySchema,
} from "@/lib/type-schema";

const TYPE_OPTIONS = [
  { value: "voo", label: "Voo" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "experiencia", label: "Experiência" },
  { value: "seguro", label: "Seguro" },
  { value: "transporte", label: "Transporte" },
  { value: "cruzeiro", label: "Cruzeiro" },
  { value: "outro", label: "Outro" },
] as const;
type TypeValue = (typeof TYPE_OPTIONS)[number]["value"];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

const BUCKET = "product-images";

type FormState = {
  name: string;
  item_type: TypeValue | "";
  description: string;
  destination: string;
  category_id: string;
  tags: string[];
  cost: string;
  sale_price: string;
  currency: string;
  supplier_id: string;
  images: string[];
  attributes: Record<string, any>;
  is_active: boolean;
};

const EMPTY: FormState = {
  name: "",
  item_type: "",
  description: "",
  destination: "",
  category_id: "",
  tags: [],
  cost: "",
  sale_price: "",
  currency: "BRL",
  supplier_id: "",
  images: [],
  attributes: {},
  is_active: true,
};

export default function CatalogEdit() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const canSeeCost = userRole === "admin" || userRole === "manager";
  const canEdit = canSeeCost; // mesma regra das policies

  const [form, setForm] = useState<FormState>(EMPTY);
  const [tagsInput, setTagsInput] = useState("");
  const [uploading, setUploading] = useState(false);

  // ---- Loaders ----
  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["product", id],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["product_categories", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "for-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Populate form when loaded
  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name ?? "",
      item_type: (product.item_type as TypeValue) ?? "",
      description: product.description ?? "",
      destination: product.destination ?? "",
      category_id: product.category_id ?? "",
      tags: Array.isArray((product as any).tags) ? ((product as any).tags as string[]) : [],
      cost: product.cost != null ? String(product.cost) : "",
      sale_price: product.sale_price != null ? String(product.sale_price) : "",
      currency: product.currency ?? "BRL",
      supplier_id: product.supplier_id ?? "",
      images: Array.isArray(product.images) ? product.images : [],
      attributes: (product.attributes && typeof product.attributes === "object" ? product.attributes : {}) as Record<string, any>,
      is_active: !!product.is_active,
    });
  }, [product]);

  // ---- Save ----
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do produto.");
      if (!form.item_type) throw new Error("Selecione o tipo do produto.");

      const basePayload: Record<string, any> = {
        name: form.name.trim(),
        item_type: form.item_type,
        description: form.description || null,
        destination: form.destination || null,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        tags: form.tags.length ? form.tags : null,
        sale_price: form.sale_price !== "" ? Number(form.sale_price) : null,
        currency: form.currency || "BRL",
        images: form.images.length ? form.images : null,
        attributes: form.attributes ?? {},
        is_active: form.is_active,
      };
      if (canSeeCost) {
        basePayload.cost = form.cost !== "" ? Number(form.cost) : null;
      }

      if (isEdit) {
        const { error } = await supabase.from("products").update(basePayload as any).eq("id", id!);
        if (error) throw error;
        await logAuditEvent({ action: "update", tableName: "products", recordId: id!, recordLabel: basePayload.name, oldData: product, newData: basePayload });
        return id!;
      } else {
        const { data, error } = await supabase.from("products").insert(basePayload as any).select("id").single();
        if (error) throw error;
        await logAuditEvent({ action: "create", tableName: "products", recordId: data.id, recordLabel: basePayload.name, newData: basePayload });
        return data.id as string;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      toast({ title: isEdit ? "Produto atualizado" : "Produto criado" });
      navigate("/catalog");
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  // ---- Tags ----
  const commitTags = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setForm((f) => ({ ...f, tags: Array.from(new Set([...(f.tags || []), ...parts])) }));
    setTagsInput("");
  };
  const removeTag = (t: string) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }));

  // ---- Images ----
  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        uploaded.push(path);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
      toast({ title: `${uploaded.length} imagem(ns) enviada(s)` });
    } catch (e: any) {
      toast({ title: "Falha no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  const removeImage = async (src: string) => {
    setForm((f) => ({ ...f, images: f.images.filter((s) => s !== src) }));
  };

  // ---- Attributes by type ----
  const setAttr = (key: string, value: any) =>
    setForm((f) => ({ ...f, attributes: { ...(f.attributes ?? {}), [key]: value } }));

  // Render dinâmico via TIPO_SCHEMA (template-only) para tipos com schema.
  // Tipos sem schema mostram bloco simples de "Observações" em attributes.notas.
  const typedSchema = useMemo(() => getTypeSchema(form.item_type || null), [form.item_type]);
  const typeAttributesUI = useMemo(() => {
    if (typedSchema) {
      return (
        <DynamicCategoryFields
          schema={asCategorySchema(typedSchema)}
          value={form.attributes}
          onChange={(next) => setForm((f) => ({ ...f, attributes: next }))}
          scopeFilter="template"
        />
      );
    }
    if (!form.item_type) {
      return <p className="text-xs text-muted-foreground">Selecione um tipo para ver os campos específicos.</p>;
    }
    return (
      <Field label="Observações específicas">
        <Textarea
          value={form.attributes.notas ?? ""}
          onChange={(e) => setAttr("notas", e.target.value)}
          rows={3}
          placeholder="Detalhes livres deste produto..."
        />
      </Field>
    );
  }, [typedSchema, form.item_type, form.attributes]);

  const isValid = form.name.trim().length > 0 && !!form.item_type;
  const breadcrumbName = isEdit ? (product?.name ?? "Editar produto") : "Novo produto";

  if (isEdit && loadingProduct) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando produto...
      </div>
    );
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/catalog" className="hover:text-foreground transition-colors">Catálogo</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground/80 truncate">{breadcrumbName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/catalog")} className="gap-1">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <h1 className="text-2xl font-display font-bold">
              {isEdit ? "Editar produto" : "Novo produto"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            <Label className="text-xs">{form.is_active ? "Ativo" : "Inativo"}</Label>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-6 space-y-5">
        {/* Identificação */}
        <Section title="Identificação" description="Como esse produto é encontrado no catálogo e exibido nas cotações.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex.: Hotel Copacabana Palace"
              />
            </Field>
            <Field label="Tipo" required>
              <Select
                value={form.item_type || undefined}
                onValueChange={(v) =>
                  setForm((f) =>
                    f.item_type === v
                      ? f
                      : { ...f, item_type: v as TypeValue, attributes: {}, category_id: "" }
                  )
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Resumo do produto, diferenciais, condições..."
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Destino / Local">
              <Input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="Rio de Janeiro, Paris..." />
            </Field>
            {!typedSchema && (
              <Field label="Categoria">
                <Select value={form.category_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem categoria —</SelectItem>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label="Tags" hint="Pressione Enter ou vírgula para adicionar.">
            <Input
              value={tagsInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v.includes(",")) { commitTags(v); } else { setTagsInput(v); }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitTags(tagsInput); }
                if (e.key === "Backspace" && !tagsInput && form.tags.length) {
                  removeTag(form.tags[form.tags.length - 1]);
                }
              }}
              onBlur={() => commitTags(tagsInput)}
              placeholder="luxo, lua-de-mel, praia..."
            />
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </Field>
        </Section>

        {/* Comercial */}
        <Section title="Comercial" description="Valores de referência. Quando o produto for puxado para uma cotação, custo e preço viram cópia editável dentro do item — alterações futuras no catálogo não mudam cotações já criadas.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {canSeeCost && (
              <Field label="Custo-base (R$)">
                <CurrencyInput value={form.cost} onChange={(v) => setForm((f) => ({ ...f, cost: v == null ? "" : String(v) }))} placeholder="0,00" />
              </Field>
            )}
            <Field label="Preço-base (R$)">
              <CurrencyInput value={form.sale_price} onChange={(v) => setForm((f) => ({ ...f, sale_price: v == null ? "" : String(v) }))} placeholder="0,00" />
            </Field>
            <Field label="Moeda">
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL — Real</SelectItem>
                  <SelectItem value="USD">USD — Dólar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Fornecedor">
            <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v === "none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem fornecedor —</SelectItem>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Mídia */}
        <Section title="Mídia" description="Imagens que ajudam o cliente a visualizar o produto.">
          <div className="flex items-center gap-3">
            <label
              htmlFor="product-images-input"
              className={`inline-flex items-center gap-2 rounded-md border border-input bg-background hover:bg-muted/40 px-3 py-2 text-sm cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Adicionar imagens"}
            </label>
            <input
              id="product-images-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleUpload(e.target.files); e.currentTarget.value = ""; }}
            />
            <span className="text-xs text-muted-foreground">{form.images.length} imagem(ns)</span>
          </div>
          {form.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {form.images.map((src) => (
                <div key={src} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
                  <PrivateImage bucket={BUCKET} source={src} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(src)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Atributos específicos */}
        <Section
          title="Atributos específicos"
          description={form.item_type ? `Campos próprios para ${TYPE_LABEL[form.item_type]}.` : "Selecione um tipo para ver os campos específicos."}
        >
          {typeAttributesUI}
        </Section>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Valores aqui são <strong>referência de catálogo</strong>. Ao puxar o produto para uma cotação, custo e preço viram cópia editável dentro do item.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => navigate("/catalog")} disabled={saveMutation.isPending}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!isValid || saveMutation.isPending || !canEdit}
              title={!canEdit ? "Sem permissão para editar" : undefined}
            >
              {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando...</> : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="px-5 py-3 border-b">
        <h2 className="text-sm font-display font-semibold tracking-wide uppercase text-foreground/90">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export { TYPE_OPTIONS, TYPE_LABEL };
