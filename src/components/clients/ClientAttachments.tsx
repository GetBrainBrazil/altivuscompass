import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, FileText, Download, Trash2, Paperclip } from "lucide-react";
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

  const onOpen = async (row: AttachmentRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const onDelete = async (row: AttachmentRow) => {
    if (!confirm(`Excluir "${row.file_name}"?`)) return;
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
          rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="flex-1 min-w-0 text-left text-xs font-body text-foreground hover:text-primary truncate"
                title={r.file_name}
              >
                {r.file_name}
              </button>
              <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap">
                {formatSize(r.size_bytes)}
              </span>
              <span className="text-[10px] text-muted-foreground font-body whitespace-nowrap hidden sm:inline">
                {r.user_name || "—"} · {formatDate(r.created_at)}
              </span>
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="text-muted-foreground hover:text-foreground"
                title="Abrir / baixar"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(r)}
                className="text-muted-foreground hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
