import { useEffect, useRef, useState } from "react";
import Cropper, { ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, RotateCw, Crop as CropIcon, Save, Loader2, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface SavedAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  _pending?: false;
}
interface PendingAttachment {
  id: string;
  file_name: string;
  file_type?: string | null;
  _pending: true;
  _file: File;
}
export type ViewerAttachment = SavedAttachment | PendingAttachment;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  attachment: ViewerAttachment | null;
  taskId: string | null;
  pending?: File[];
  onPendingChange?: (files: File[]) => void;
  bucket?: string;
  tableName?: string;
  invalidateKey?: unknown[];
  sizeColumn?: string;
}

export function ImageViewerDialog({
  open, onOpenChange, attachment, taskId, pending = [], onPendingChange,
  bucket = "task-attachments",
  tableName = "task_attachments",
  invalidateKey,
  sizeColumn = "file_size",
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const cropperRef = useRef<ReactCropperElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open || !attachment) return;
    setName(attachment.file_name);
    setCropMode(false);
    setRotation(0);
    setZoom(1);
    setDirty(false);

    let revoke: string | null = null;
    (async () => {
      if (attachment._pending) {
        const url = URL.createObjectURL((attachment as PendingAttachment)._file);
        revoke = url;
        setSrc(url);
      } else {
        const { data } = await supabase.storage
          .from("task-attachments")
          .createSignedUrl((attachment as SavedAttachment).file_path, 60 * 10);
        setSrc(data?.signedUrl ?? null);
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [open, attachment]);

  const rotateBy = (deg: number) => {
    setDirty(true);
    if (cropMode && cropperRef.current?.cropper) {
      cropperRef.current.cropper.rotate(deg);
    } else {
      setRotation((r) => r + deg);
    }
  };

  const blobFromCanvas = (canvas: HTMLCanvasElement, type: string): Promise<Blob> =>
    new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob fail"))), type, 0.92),
    );

  const buildModifiedBlob = async (): Promise<Blob | null> => {
    if (!src) return null;
    const type = attachment?.file_type || "image/jpeg";

    if (cropMode && cropperRef.current?.cropper) {
      const canvas = cropperRef.current.cropper.getCroppedCanvas();
      if (!canvas) return null;
      return blobFromCanvas(canvas, type);
    }
    if (rotation % 360 !== 0) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = src;
      });
      const rad = (rotation * Math.PI) / 180;
      const swap = Math.abs(rotation % 180) === 90;
      const cw = swap ? img.height : img.width;
      const ch = swap ? img.width : img.height;
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      return blobFromCanvas(canvas, type);
    }
    return null;
  };

  const handleSave = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      const blob = await buildModifiedBlob();
      const newName = name.trim() || attachment.file_name;

      if (attachment._pending) {
        const orig = (attachment as PendingAttachment)._file;
        const file = blob
          ? new File([blob], newName, { type: orig.type })
          : new File([orig], newName, { type: orig.type });
        const next = pending.map((f) => (f === orig ? file : f));
        onPendingChange?.(next);
      } else {
        const saved = attachment as SavedAttachment;
        if (blob) {
          const { error: upErr } = await supabase.storage
            .from("task-attachments")
            .upload(saved.file_path, blob, {
              contentType: attachment.file_type || "image/jpeg",
              upsert: true,
            });
          if (upErr) throw upErr;
        }
        const { error } = await supabase
          .from("task_attachments")
          .update({
            file_name: newName,
            ...(blob ? { file_size: blob.size } : {}),
          })
          .eq("id", saved.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      }
      toast({ title: "Imagem atualizada" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-5xl max-h-[95vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-3 border-b shrink-0">
          <DialogTitle className="font-display text-base">Visualizar imagem</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-end gap-2 flex-wrap shrink-0">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome do arquivo</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                className="mt-1"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button type="button" variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))} disabled={cropMode} title="Diminuir zoom">
                <ZoomOut size={16} />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => setZoom(1)} disabled={cropMode} title="Tamanho original (100%)">
                <Maximize2 size={16} />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(8, z + 0.25))} disabled={cropMode} title="Aumentar zoom">
                <ZoomIn size={16} />
              </Button>
              <span className="text-xs text-muted-foreground self-center w-12 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button type="button" variant="outline" size="icon" onClick={() => rotateBy(-90)} title="Girar -90°">
                <RotateCcw size={16} />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => rotateBy(90)} title="Girar 90°">
                <RotateCw size={16} />
              </Button>
              <Button
                type="button"
                variant={cropMode ? "default" : "outline"}
                size="icon"
                onClick={() => {
                  setCropMode((v) => !v);
                  setDirty(true);
                }}
                title="Recortar"
              >
                <CropIcon size={16} />
              </Button>
            </div>
          </div>

          <div
            className="bg-muted/30 rounded-md flex items-center justify-center flex-1 min-h-0 overflow-auto"
            onWheel={(e) => {
              if (cropMode) return;
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setZoom((z) => Math.min(8, Math.max(0.1, z - e.deltaY * 0.002)));
              }
            }}
          >
            {!src ? (
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            ) : cropMode ? (
              <Cropper
                ref={cropperRef}
                src={src}
                style={{ height: "100%", width: "100%" }}
                viewMode={1}
                background={false}
                autoCropArea={1}
                guides
              />
            ) : (
              <img
                src={src}
                alt={name}
                style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: "center center" }}
                className="transition-transform select-none"
                draggable={false}
              />
            )}
          </div>
        </div>




        <DialogFooter className="p-4 pt-3 border-t flex sm:justify-between gap-2 shrink-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <X size={14} className="mr-1.5" /> Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || (!dirty && name === attachment?.file_name)}>
            {saving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
