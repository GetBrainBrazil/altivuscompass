import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Paperclip, Trash2, FileText, Image as ImageIcon, Loader2, Eye, EyeOff, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AttachmentRow {
  id: string;
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
  is_public: boolean;
}

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

interface Props {
  quoteId?: string;
  itemId?: string;
  itemType: string;
  /** locator/PNR (only meaningful for flights, optional for others) */
  locator?: string | null;
  isNew: boolean;
}

const BUCKET = "quote-item-attachments";

const isImage = (path: string, mime?: string | null) =>
  (mime?.startsWith("image/") ?? false) || /\.(png|jpe?g|webp|gif)$/i.test(path);

const sanitize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

function buildSmartName(opts: {
  quoteId: string;
  itemType: string;
  locator?: string | null;
  ext: string;
}) {
  const { quoteId, itemType, locator, ext } = opts;
  const id8 = quoteId.replace(/-/g, "").slice(0, 8);
  const ts = Date.now();
  if (itemType === "flight") {
    const loc = sanitize(locator || "") || "sem-localizador";
    return `cotacao-${id8}_voo-${loc}_${ts}.${ext}`;
  }
  const tipo = sanitize(itemType || "item");
  return `cotacao-${id8}_${tipo}_${ts}.${ext}`;
}

export default function QuoteItemAttachmentsV2({
  quoteId,
  itemId,
  itemType,
  locator,
  isNew,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const canUpload = !!quoteId && !!itemId && !isNew;

  useEffect(() => {
    if (!itemId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("quote_item_attachments")
        .select("id, file_path, original_name, mime_type, is_public")
        .eq("quote_item_id", itemId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) return;
      setRows((data ?? []) as AttachmentRow[]);
    })();
    return () => {
      active = false;
    };
  }, [itemId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || !canUpload || !quoteId || !itemId) return;
    setUploading(true);
    try {
      const inserted: AttachmentRow[] = [];
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const filename = buildSmartName({ quoteId, itemType, locator, ext });
        const path = `${quoteId}/${itemId}/${filename}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase
          .from("quote_item_attachments")
          .insert({
            quote_id: quoteId,
            quote_item_id: itemId,
            file_path: path,
            original_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
            is_public: false,
          })
          .select("id, file_path, original_name, mime_type, is_public")
          .single();
        if (insErr) throw insErr;
        if (row) inserted.push(row as AttachmentRow);
      }
      setRows((prev) => [...prev, ...inserted]);
      toast({ title: "Anexo enviado", duration: 1500 });
    } catch (err: any) {
      toast({
        title: "Erro ao enviar",
        description: err.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openAttachment = async (row: AttachmentRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const togglePublic = async (row: AttachmentRow, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_public: next } : r)));
    const { error } = await supabase
      .from("quote_item_attachments")
      .update({ is_public: next })
      .eq("id", row.id);
    if (error) {
      // revert
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_public: !next } : r)));
      toast({ title: "Erro ao atualizar visibilidade", variant: "destructive" });
    }
  };

  const removeAttachment = async (row: AttachmentRow) => {
    try {
      await supabase.storage.from(BUCKET).remove([row.file_path]);
    } catch {
      /* ignore — still remove DB row */
    }
    const { error } = await supabase.from("quote_item_attachments").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wide">
          Arquivos {itemType === "flight" ? "do voo" : "do item"}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={!canUpload || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5" />
                  )}
                  Anexar
                </Button>
              </span>
            </TooltipTrigger>
            {!canUpload && (
              <TooltipContent side="top" className="text-xs">
                Salve a cotação primeiro pra anexar arquivos a este item.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Nenhum arquivo anexado.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const name = row.original_name || row.file_path.split("/").pop() || "arquivo";
            return (
              <div
                key={row.id}
                className="flex items-center gap-2 px-2 py-1.5 border border-border rounded-md bg-muted/20 text-xs"
              >
                {isImage(row.file_path, row.mime_type) ? (
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => openAttachment(row)}
                  className="flex-1 truncate text-left hover:text-primary transition-colors"
                  title={name}
                >
                  {name}
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          {row.is_public ? (
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <Switch
                            checked={row.is_public}
                            onCheckedChange={(v) => togglePublic(row, v)}
                            className="scale-75 origin-center"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {row.is_public
                          ? "Visível para o cliente na cotação pública"
                          : "Apenas uso interno"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                    onClick={() => removeAttachment(row)}
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
