import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, Download, Trash2, Paperclip, Pencil, Check, X, ExternalLink } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageViewerDialog, ViewerAttachment } from "@/components/ImageViewerDialog";
import { cn } from "@/lib/utils";

interface AttachmentRow {
  id: string;
  client_id: string;
  user_id: string | null;
  user_name: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

const BUCKET = "client-attachments";

const formatSize = (n: number | null) => {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

export function ClientAttachments({ clientId }: { clientId: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AttachmentRow | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [previewRow, setPreviewRow] = useState<AttachmentRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!previewRow) { setPreviewUrl(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(previewRow.file_path, 60 * 60);
      if (cancelled) return;
      setPreviewLoading(false);
      if (error || !data?.signedUrl) {
        toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
        setPreviewRow(null);
        return;
      }
      setPreviewUrl(data.signedUrl);
    })();
    return () => { cancelled = true; };
  }, [previewRow, toast]);

  const downloadRow = async (row: AttachmentRow) => {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 60 * 5, { download: row.file_name });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const startRename = (r: AttachmentRow) => {
    setRenamingId(r.id);
    setRenameValue(r.file_name);
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };
  const confirmRename = async (r: AttachmentRow) => {
    const newName = renameValue.trim();
    if (!newName || newName === r.file_name) { cancelRename(); return; }
    setRenaming(true);
    const { error } = await supabase
      .from("client_attachments" as any)
      .update({ file_name: newName })
      .eq("id", r.id);
    setRenaming(false);
    if (error) {
      toast({ title: "Falha ao renomear", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["client-attachments", clientId] });
    toast({ title: "Anexo renomeado" });
    cancelRename();
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["client-attachments", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_attachments" as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AttachmentRow[];
    },
  });

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!clientId) {
      toast({ title: "Salve o cliente primeiro", description: "Anexe arquivos após criar o cliente.", variant: "destructive" });
      return;
    }
    if (!user) return;
    if (files.length === 0) return;
    setUploading(true);
    try {
      const userName = (user.user_metadata as any)?.full_name || user.email || "Usuário";
      for (const f of files) {
        const ext = f.name.includes(".") ? f.name.split(".").pop() : "bin";
        const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, f, { contentType: f.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase
          .from("client_attachments" as any)
          .insert({
            client_id: clientId,
            user_id: user.id,
            user_name: userName,
            file_name: f.name,
            file_path: path,
            mime_type: f.type || null,
            size_bytes: f.size,
          });
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["client-attachments", clientId] });
      toast({ title: `${files.length} arquivo(s) enviado(s)` });
    } catch (err: any) {
      toast({ title: "Falha no envio", description: err?.message ?? "Erro desconhecido", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [clientId, user, qc, toast]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length) uploadFiles(list);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length) uploadFiles(list);
  };

  const onOpen = (row: AttachmentRow) => {
    setPreviewRow(row);
  };

  const confirmDelete = async () => {
    const row = pendingDelete;
    if (!row) return;
    setPendingDelete(null);
    const { error: stErr } = await supabase.storage.from(BUCKET).remove([row.file_path]);
    if (stErr) {
      toast({ title: "Falha ao excluir arquivo", description: stErr.message, variant: "destructive" });
      return;
    }
    const { error: delErr } = await supabase
      .from("client_attachments" as any)
      .delete()
      .eq("id", row.id);
    if (delErr) {
      toast({ title: "Falha ao excluir registro", description: delErr.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["client-attachments", clientId] });
    toast({ title: "Anexo excluído" });
  };

  return (
    <div className="border-t border-border/50 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-medium text-foreground flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Anexos
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !clientId}
        >
          <Upload className="h-3 w-3 mr-1" />
          Adicionar arquivos
        </Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-4 text-center text-xs font-body transition-colors",
          isDragging ? "border-primary bg-primary/5 text-foreground" : "border-border/60 bg-muted/20 text-muted-foreground",
          (!clientId || uploading) && "opacity-60"
        )}
      >
        {uploading ? (
          <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</span>
        ) : (
          <>Arraste arquivos aqui ou clique em <span className="text-foreground font-medium">Adicionar arquivos</span>. Vários arquivos de uma vez.</>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground font-body">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body">Nenhum anexo.</p>
        ) : (
          rows.map((r) => {
            const isRenaming = renamingId === r.id;
            return (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); confirmRename(r); }
                    if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                  }}
                  disabled={renaming}
                  className="flex-1 min-w-0 text-xs font-body bg-background border border-border/60 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  className="flex-1 min-w-0 text-left text-xs font-body text-foreground hover:text-primary truncate"
                  title={r.file_name}
                >
                  {r.file_name}
                </button>
              )}
              <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">
                {formatSize(r.size_bytes)}
              </span>
              <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap hidden sm:inline">
                {r.user_name || "—"} · {formatDate(r.created_at)}
              </span>
              {isRenaming ? (
                <>
                  <button
                    type="button"
                    onClick={() => confirmRename(r)}
                    disabled={renaming}
                    className="text-muted-foreground hover:text-primary"
                    title="Salvar"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    disabled={renaming}
                    className="text-muted-foreground hover:text-foreground"
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startRename(r)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Renomear"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadRow(r)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Baixar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(r)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
            );
          })
        )}
      </div>

      <Dialog open={!!previewRow} onOpenChange={(o) => { if (!o) setPreviewRow(null); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-5xl max-h-[95vh] h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b shrink-0 flex flex-row items-center justify-between gap-2">
            <DialogTitle className="font-display text-base truncate">{previewRow?.file_name}</DialogTitle>
            <div className="flex gap-2 mr-6">
              <Button type="button" variant="outline" size="sm" onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")} disabled={!previewUrl}>
                <ExternalLink size={14} className="mr-1.5" /> Nova guia
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => previewRow && downloadRow(previewRow)}>
                <Download size={14} className="mr-1.5" /> Baixar
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/30 flex items-center justify-center overflow-auto">
            {previewLoading || !previewUrl ? (
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            ) : previewRow?.mime_type?.startsWith("image/") ? (
              <img src={previewUrl} alt={previewRow.file_name} className="max-w-full max-h-full object-contain" />
            ) : previewRow?.mime_type === "application/pdf" ? (
              <iframe src={previewUrl} title={previewRow.file_name} className="w-full h-full border-0" />
            ) : previewRow?.mime_type?.startsWith("video/") ? (
              <video src={previewUrl} controls className="max-w-full max-h-full" />
            ) : previewRow?.mime_type?.startsWith("audio/") ? (
              <audio src={previewUrl} controls />
            ) : (
              <div className="text-center p-6 space-y-3">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-body">
                  Pré-visualização não disponível para este tipo de arquivo.
                </p>
                <Button type="button" size="sm" onClick={() => previewRow && downloadRow(previewRow)}>
                  <Download size={14} className="mr-1.5" /> Baixar arquivo
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>O arquivo <span className="font-medium text-foreground">"{pendingDelete.file_name}"</span> será removido permanentemente. Esta ação não pode ser desfeita.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
