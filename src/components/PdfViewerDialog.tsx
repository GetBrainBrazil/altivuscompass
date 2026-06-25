import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Download } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filePath: string | null;
  fileName: string;
  pendingFile?: File | null;
  bucket?: string;
}

export function PdfViewerDialog({ open, onOpenChange, filePath, fileName, pendingFile, bucket = "task-attachments" }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setSrc(null); return; }
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        let blob: Blob | null = null;
        if (pendingFile) {
          blob = pendingFile;
        } else if (filePath) {
          const { data, error } = await supabase.storage
            .from("task-attachments")
            .download(filePath);
          if (error || !data) return;
          blob = data;
        }
        if (!blob || cancelled) return;
        const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        revoke = url;
        setSrc(url);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [open, filePath, pendingFile]);

  const handleDownload = async () => {
    if (pendingFile) {
      const url = URL.createObjectURL(pendingFile);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!filePath) return;
    const { data } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(filePath, 60 * 5, { download: fileName });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-6xl max-h-[95vh] h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b shrink-0 flex flex-row items-center justify-between gap-2">
          <DialogTitle className="font-display text-base truncate">{fileName}</DialogTitle>
          <div className="flex gap-2 mr-6">
            <Button type="button" variant="outline" size="sm" onClick={() => src && window.open(src, "_blank")} disabled={!src}>
              <ExternalLink size={14} className="mr-1.5" /> Nova guia
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download size={14} className="mr-1.5" /> Baixar
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30">
          {!src ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <iframe src={src} title={fileName} className="w-full h-full border-0" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
