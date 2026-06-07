import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Paperclip, Upload, Download, Trash2, FileText, FileImage, File as FileIcon, Loader2 } from "lucide-react";
import { ImageViewerDialog, ViewerAttachment } from "@/components/ImageViewerDialog";
import { PdfViewerDialog } from "@/components/PdfViewerDialog";
import { cn } from "@/lib/utils";

function isPdf(type?: string | null, name?: string) {
  if (type === "application/pdf") return true;
  if (name && /\.pdf$/i.test(name)) return true;
  return false;
}

function isImage(type?: string | null, name?: string) {
  if (type?.startsWith("image/")) return true;
  if (name && /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(name)) return true;
  return false;
}


interface Props {
  taskId: string | null;
  /** Para tarefas ainda não criadas, mantemos anexos pendentes em memória */
  pending?: File[];
  onPendingChange?: (files: File[]) => void;
}

function bytes(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(type?: string | null) {
  if (!type) return FileIcon;
  if (type.startsWith("image/")) return FileImage;
  if (type.includes("pdf") || type.includes("text") || type.includes("word")) return FileText;
  return FileIcon;
}

export function TaskAttachments({ taskId, pending = [], onPendingChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<ViewerAttachment | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ filePath: string | null; fileName: string; pendingFile?: File | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; path: string; name: string; type?: string | null; pending?: boolean; pendingIndex?: number; file?: File } | null>(null);
  const [confirmThumb, setConfirmThumb] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    (async () => {
      if (!confirmDelete) { setConfirmThumb(null); return; }
      if (!isImage(confirmDelete.type, confirmDelete.name)) { setConfirmThumb(null); return; }
      if (confirmDelete.pending && confirmDelete.file) {
        const url = URL.createObjectURL(confirmDelete.file);
        revoke = url;
        setConfirmThumb(url);
      } else if (confirmDelete.path) {
        const { data } = await supabase.storage.from("task-attachments").createSignedUrl(confirmDelete.path, 60 * 5);
        setConfirmThumb(data?.signedUrl ?? null);
      }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [confirmDelete]);



  const { data: attachments = [] } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!taskId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!taskId) throw new Error("no task");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_name: file.name,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-attachments", taskId] }),
    onError: (e: any) => toast({ title: "Erro ao enviar arquivo", description: e.message, variant: "destructive" }),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files);
    if (!taskId) {
      onPendingChange?.([...pending, ...arr]);
      return;
    }
    setUploading(true);
    for (const f of arr) {
      if (f.size > 25 * 1024 * 1024) {
        toast({ title: `${f.name} excede 25MB`, variant: "destructive" });
        continue;
      }
      await uploadMutation.mutateAsync(f).catch(() => {});
    }
    setUploading(false);
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(path, 60 * 5, { download: name });
    if (error || !data) {
      toast({ title: "Erro ao baixar", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDeleteClick = (a: any, pendingIndex?: number) => {
    setConfirmDelete({
      id: a.id,
      path: a.file_path || "",
      name: a.file_name,
      type: a.file_type,
      pending: !!a._pending,
      pendingIndex,
      file: a._file,
    });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.pending) {
      onPendingChange?.(pending.filter((_, i) => i !== (confirmDelete.pendingIndex ?? -1)));
    } else {
      await supabase.storage.from("task-attachments").remove([confirmDelete.path]);
      await supabase.from("task_attachments").delete().eq("id", confirmDelete.id);
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    }
    setConfirmDelete(null);
  };

  const items: any[] = taskId ? attachments : pending.map((f, i) => ({
    id: `pending-${i}`, file_name: f.name, file_size: f.size, file_type: f.type, file_path: "", _pending: true as const, _file: f,
  }));

  const openImage = (a: any) => {
    if (!isImage(a.file_type, a.file_name)) return;
    if (a._pending) {
      setViewer({ id: a.id, file_name: a.file_name, file_type: a.file_type, _pending: true, _file: a._file });
    } else {
      setViewer({ id: a.id, file_name: a.file_name, file_type: a.file_type, file_path: a.file_path });
    }
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="font-body text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Paperclip size={12} /> Anexos
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-7 text-xs gap-1.5"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Adicionar arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      <div
        className="rounded-md border border-dashed border-input bg-muted/20 p-3 min-h-[64px]"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Arraste arquivos aqui ou clique em "Adicionar arquivo" (imagens, PDF, documentos — até 25MB)
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((a: any) => {
              const Icon = iconFor(a.file_type);
              const img = isImage(a.file_type, a.file_name);
              return (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-border text-sm">
                  <Icon size={14} className="text-muted-foreground shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      if (img) openImage(a);
                      else if (isPdf(a.file_type, a.file_name)) {
                        setPdfViewer({
                          filePath: a._pending ? null : a.file_path,
                          fileName: a.file_name,
                          pendingFile: a._pending ? a._file : null,
                        });
                      } else handleDownload(a.file_path, a.file_name);
                    }}
                    className={cn("flex-1 truncate text-left hover:underline cursor-pointer")}
                    title={img ? "Visualizar imagem" : isPdf(a.file_type, a.file_name) ? "Visualizar PDF" : "Abrir em nova guia"}
                  >
                    {a.file_name}
                  </button>
                  <span className="text-xs text-muted-foreground shrink-0">{bytes(a.file_size)}</span>

                  {!a._pending ? (
                    <>
                      <button type="button" onClick={() => handleDownload(a.file_path, a.file_name)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Baixar">
                        <Download size={13} />
                      </button>
                      <button type="button" onClick={() => handleDeleteClick(a)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(a, Number(a.id.replace("pending-", "")))}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {!taskId && pending.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-1.5">Os arquivos serão enviados ao salvar a tarefa.</p>
      )}
      <ImageViewerDialog
        open={!!viewer}
        onOpenChange={(v) => !v && setViewer(null)}
        attachment={viewer}
        taskId={taskId}
        pending={pending}
        onPendingChange={onPendingChange}
      />
      <PdfViewerDialog
        open={!!pdfViewer}
        onOpenChange={(v) => !v && setPdfViewer(null)}
        filePath={pdfViewer?.filePath ?? null}
        fileName={pdfViewer?.fileName ?? ""}
        pendingFile={pdfViewer?.pendingFile ?? null}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {confirmThumb && (
                  <div className="flex justify-center">
                    <img
                      src={confirmThumb}
                      alt={confirmDelete?.name}
                      className="max-h-40 max-w-full rounded border border-border object-contain bg-muted/30"
                    />
                  </div>
                )}
                <p>
                  Tem certeza que deseja excluir <strong>{confirmDelete?.name}</strong>? Esta ação não poderá ser desfeita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
