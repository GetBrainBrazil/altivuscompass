import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Paperclip,
  Trash2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  Pencil,
  Check,
  X,
  UploadCloud,
} from "lucide-react";
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
  const [dragging, setDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const ready = !!quoteId && !!itemId && !isNew;

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

  const handleFiles = async (filesInput: FileList | File[] | null) => {
    if (!filesInput) return;
    const filesArr = Array.from(filesInput);
    if (!filesArr.length) return;

    const oversized = filesArr.find((f) => f.size > MAX_SIZE_BYTES);
    if (oversized) {
      toast({
        title: "Arquivo muito grande",
        description: `${oversized.name} ultrapassa 15MB.`,
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!ready || !quoteId || !itemId) {
      const buffered: PendingFile[] = filesArr.map((file) => ({
        localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        is_public: false,
      }));
      setPending((prev) => [...prev, ...buffered]);
      toast({
        title: filesArr.length > 1 ? "Anexos na fila" : "Anexo na fila",
        description: "Será enviado automaticamente ao salvar a cotação.",
        duration: 2000,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    const progressToast = toast({
      title: filesArr.length > 1 ? "Enviando anexos…" : "Enviando anexo…",
      description: filesArr.length > 1 ? `${filesArr.length} arquivos` : filesArr[0].name,
      duration: 60000,
    });
    try {
      const inserted: AttachmentRow[] = [];
      for (const file of filesArr) {
        const row = await uploadOne(file, false, quoteId, itemId);
        if (row) inserted.push(row);
      }
      setRows((prev) => [...prev, ...inserted]);
      progressToast.dismiss();
      toast({ title: `${inserted.length} anexo(s) salvo(s)`, duration: 1500 });
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

  const getSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    return data?.signedUrl ?? null;
  };

  const openAttachment = async (row: AttachmentRow) => {
    const url = await getSignedUrl(row.file_path);
    if (!url) {
      toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
      return;
    }
    const name = row.original_name || row.file_path.split("/").pop() || "arquivo";
    if (isImage(row.file_path, row.mime_type)) {
      setViewer({ url, name });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
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
      /* ignore */
    }
    const { error } = await supabase.from("quote_item_attachments").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const startRename = (row: AttachmentRow) => {
    setEditingId(row.id);
    setEditingName(row.original_name || row.file_path.split("/").pop() || "arquivo");
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveRename = async (row: AttachmentRow) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    const { error } = await supabase
      .from("quote_item_attachments")
      .update({ original_name: trimmed })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Erro ao renomear", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, original_name: trimmed } : r)));
    cancelRename();
    toast({ title: "Arquivo renomeado", duration: 1500 });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) handleFiles(files);
  };

  const totalCount = rows.length + pending.length;

  return (
    <div
      className="space-y-2"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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

      <div
        className={`rounded-md border-2 border-dashed px-3 py-3 transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10"
        }`}
      >
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-3 text-center gap-1">
            <UploadCloud className="w-5 h-5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Arraste arquivos aqui ou clique em <strong>Anexar</strong>. Vários arquivos suportados.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pending.map((p) => (
              <div
                key={p.localId}
                className="flex items-center gap-2 px-2 py-1.5 border border-dashed border-border rounded-md bg-muted/30 text-xs"
                title="Será enviado ao salvar a cotação"
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate text-muted-foreground">
                  {p.file.name} <span className="italic">(aguardando salvar)</span>
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
              const isImg = isImage(row.file_path, row.mime_type);
              const editing = editingId === row.id;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-2 px-2 py-1.5 border border-border rounded-md bg-muted/20 text-xs"
                >
                  {isImg ? (
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}

                  {editing ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(row);
                          if (e.key === "Escape") cancelRename();
                        }}
                        autoFocus
                        className="h-6 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-primary"
                        onClick={() => saveRename(row)}
                        title="Salvar nome"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={cancelRename}
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openAttachment(row)}
                        className="flex-1 truncate text-left hover:text-primary transition-colors"
                        title={`Abrir ${name}`}
                      >
                        {name}
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => startRename(row)}
                          title="Renomear"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Viewer */}
      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-5xl max-h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b shrink-0">
            <DialogTitle className="font-display text-base truncate pr-8">
              {viewer?.name ?? "Visualizar"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 flex items-center justify-center flex-1 min-h-0 overflow-auto p-4">
            {viewer ? (
              <img
                src={viewer.url}
                alt={viewer.name}
                className="max-w-full max-h-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
