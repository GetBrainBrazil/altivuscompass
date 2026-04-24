import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Download, Trash2, FileText, FileImage, File as FileIcon, Loader2 } from "lucide-react";

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

  const handleDelete = async (id: string, path: string) => {
    await supabase.storage.from("task-attachments").remove([path]);
    await supabase.from("task_attachments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
  };

  const items = taskId ? attachments : pending.map((f, i) => ({
    id: `pending-${i}`, file_name: f.name, file_size: f.size, file_type: f.type, file_path: "", _pending: true as const,
  }));

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
              return (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-border text-sm">
                  <Icon size={14} className="text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{a.file_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{bytes(a.file_size)}</span>
                  {!a._pending ? (
                    <>
                      <button type="button" onClick={() => handleDownload(a.file_path, a.file_name)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Baixar">
                        <Download size={13} />
                      </button>
                      <button type="button" onClick={() => handleDelete(a.id, a.file_path)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPendingChange?.(pending.filter((_, i) => `pending-${i}` !== a.id))}
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
    </div>
  );
}
