import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Paperclip, Trash2, FileText, Image as ImageIcon, Loader2, Eye, EyeOff, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AttachmentRow {
  id: string;
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
  is_public: boolean;
}

interface PendingFile {
  localId: string;
  file: File;
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
  const ts = Date.now() + Math.floor(Math.random() * 1000);
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
  const [pending, setPending] = useState<PendingFile[]>([]);
  const ready = !!quoteId && !!itemId && !isNew;

  // Carrega anexos salvos
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

  const uploadOne = async (
    file: File,
    is_public: boolean,
    qId: string,
    iId: string,
  ): Promise<AttachmentRow | null> => {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const filename = buildSmartName({ quoteId: qId, itemType, locator, ext });
    const path = `${qId}/${iId}/${filename}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) throw upErr;

    const { data: row, error: insErr } = await supabase
      .from("quote_item_attachments")
      .insert({
        quote_id: qId,
        quote_item_id: iId,
        file_path: path,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        is_public,
      })
      .select("id, file_path, original_name, mime_type, is_public")
      .single();
    if (insErr) throw insErr;
    return row as AttachmentRow;
  };

  // Sobe arquivos pendentes assim que o item for persistido
  useEffect(() => {
    if (!ready || !quoteId || !itemId || pending.length === 0 || uploading) return;
    let cancelled = false;
    (async () => {
      setUploading(true);
      const progressToast = toast({
        title: "Enviando anexos pendentes…",
        description: `${pending.length} arquivo(s)`,
        duration: 60000,
      });
      const ok: AttachmentRow[] = [];
      const failed: string[] = [];
      for (const p of pending) {
        try {
          const row = await uploadOne(p.file, p.is_public, quoteId, itemId);
          if (row) ok.push(row);
        } catch (err: any) {
          failed.push(`${p.file.name}: ${err?.message ?? "erro"}`);
        }
      }
      if (cancelled) return;
      progressToast.dismiss();
      if (ok.length) {
        setRows((prev) => [...prev, ...ok]);
        toast({ title: `${ok.length} anexo(s) salvo(s)`, duration: 1500 });
      }
      if (failed.length) {
        toast({
          title: "Falha em alguns anexos",
          description: failed.join("\n"),
          variant: "destructive",
        });
      }
      setPending([]);
      setUploading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, quoteId, itemId]);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;

    const oversized = Array.from(files).find((f) => f.size > MAX_SIZE_BYTES);
    if (oversized) {
      toast({
        title: "Arquivo muito grande",
        description: `${oversized.name} ultrapassa 15MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Sem id ainda → guarda em buffer local
    if (!ready || !quoteId || !itemId) {
      const buffered: PendingFile[] = Array.from(files).map((file) => ({
        localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        is_public: false,
      }));
      setPending((prev) => [...prev, ...buffered]);
      toast({
        title: "Anexo na fila",
        description: "Será enviado automaticamente ao salvar a cotação.",
        duration: 2000,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Upload imediato
    setUploading(true);
    const progressToast = toast({
      title: "Enviando anexo…",
      description: files.length > 1 ? `${files.length} arquivos` : files[0].name,
      duration: 60000,
    });
    try {
      const inserted: AttachmentRow[] = [];
      for (const file of Array.from(files)) {
        const row = await uploadOne(file, false, quoteId, itemId);
        if (row) inserted.push(row);
      }
      setRows((prev) => [...prev, ...inserted]);
      progressToast.dismiss();
      toast({ title: "Anexo salvo", duration: 1500 });
    } catch (err: any) {
      progressToast.dismiss();
      toast({
        title: "Erro ao enviar anexo",
        description: err?.message ?? String(err),
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
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_public: !next } : r)));
      toast({ title: "Erro ao atualizar visibilidade", variant: "destructive" });
    }
  };

  const togglePendingPublic = (localId: string, next: boolean) => {
    setPending((prev) => prev.map((p) => (p.localId === localId ? { ...p, is_public: next } : p)));
  };

  const removePending = (localId: string) => {
    setPending((prev) => prev.filter((p) => p.localId !== localId));
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

  const totalCount = rows.length + pending.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wide">
          Arquivos {itemType === "flight" ? "do voo" : "do item"}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={uploading}
          onClick={openFilePicker}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Paperclip className="w-3.5 h-3.5" />
          )}
          Anexar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {totalCount === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Nenhum arquivo anexado.
        </p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((p) => (
            <div
              key={p.localId}
              className="flex flex-row flex-nowrap items-center gap-2 px-2 py-1.5 border border-dashed border-border rounded-md bg-muted/30 text-xs"
              title="Será enviado ao salvar a cotação"
            >
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 min-w-0 truncate text-muted-foreground">
                {p.file.name}{" "}
                <span className="italic">(aguardando salvar)</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        {p.is_public ? (
                          <Eye className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <Switch
                          checked={p.is_public}
                          onCheckedChange={(v) => togglePendingPublic(p.localId, v)}
                          className="scale-75 origin-center"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {p.is_public ? "Visível para o cliente" : "Apenas uso interno"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                  onClick={() => removePending(p.localId)}
                  title="Remover da fila"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {rows.map((row) => {
            const name = row.original_name || row.file_path.split("/").pop() || "arquivo";
            return (
              <div
                key={row.id}
                className="flex flex-row flex-nowrap items-center gap-2 px-2 py-1.5 border border-border rounded-md bg-muted/20 text-xs"
              >
                {isImage(row.file_path, row.mime_type) ? (
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <button
                  type="button"
                  onClick={() => openAttachment(row)}
                  className="flex-1 min-w-0 truncate text-left hover:text-primary transition-colors"
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
