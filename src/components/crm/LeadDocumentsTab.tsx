import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image as ImageIcon, Download, Trash2, Loader2, FileBox } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
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

type LeadDocument = {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ACCEPT =
  "application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic";

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string | null) {
  if (mime?.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  return FileBox;
}

export function LeadDocumentsTab({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<LeadDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar documentos");
    } else {
      setDocs(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!leadId) return;
    load();
    const channel = supabase
      .channel(`lead-documents-${leadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_documents", filter: `lead_id=eq.${leadId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE) {
          toast.error(`"${file.name}" excede o limite de 25MB.`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${leadId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("lead-documents")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Falha ao enviar "${file.name}"`);
          continue;
        }
        const userName =
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          null;
        const { error: insErr } = await supabase.from("lead_documents").insert({
          lead_id: leadId,
          user_id: user.id,
          user_name: userName,
          file_name: file.name,
          file_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (insErr) {
          await supabase.storage.from("lead-documents").remove([path]);
          toast.error(`Falha ao registrar "${file.name}"`);
        }
      }
      toast.success("Documentos enviados");
      await load();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: LeadDocument) => {
    const { data, error } = await supabase.storage
      .from("lead-documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const { error: stErr } = await supabase.storage
      .from("lead-documents")
      .remove([target.file_path]);
    const { error: dbErr } = await supabase
      .from("lead_documents")
      .delete()
      .eq("id", target.id);
    if (stErr || dbErr) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Documento removido");
      setDocs((prev) => prev.filter((d) => d.id !== target.id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-muted-foreground font-body">
          Anexe PDFs e fotos relacionados a este lead. Limite de 25MB por arquivo.
        </p>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Adicionar documento
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg py-12 px-6 text-center">
          <FileBox className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhum documento anexado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Clique em "Adicionar documento" para enviar PDFs ou imagens.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
          {docs.map((doc) => {
            const Icon = fileIcon(doc.mime_type);
            const canDelete = user?.id === doc.user_id;
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <button
                  onClick={() => handleDownload(doc)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.user_name ?? "Usuário"} ·{" "}
                    {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                    {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ""}
                  </p>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => handleDownload(doc)}
                  title="Baixar"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(doc)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O arquivo "{deleteTarget?.file_name}"
              será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
