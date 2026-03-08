import { useState, useRef, useCallback, useEffect } from "react";
import Cropper, { ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical } from "lucide-react";

interface ImageEditorProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onSave: (file: File) => void;
}

export function ImageEditor({ open, imageSrc, onClose, onSave }: ImageEditorProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [saving, setSaving] = useState(false);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setScaleX(1);
      setScaleY(1);
    }
  }, [open]);

  const handleRotateRight = () => {
    cropperRef.current?.cropper.rotate(90);
  };

  const handleRotateLeft = () => {
    cropperRef.current?.cropper.rotate(-90);
  };

  const handleFlipH = () => {
    const newScale = scaleX * -1;
    setScaleX(newScale);
    cropperRef.current?.cropper.scaleX(newScale);
  };

  const handleFlipV = () => {
    const newScale = scaleY * -1;
    setScaleY(newScale);
    cropperRef.current?.cropper.scaleY(newScale);
  };

  const handleZoom = useCallback((value: number) => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    cropper.zoomTo(value);
  }, []);

  const handleSave = async () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    setSaving(true);
    try {
      const canvas = cropper.getCroppedCanvas();
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92);
      });
      const file = new File([blob], "edited.jpg", { type: "image/jpeg" });
      onSave(file);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[96vw] p-5">
        <DialogHeader>
          <DialogTitle className="text-sm font-display">Editar Imagem</DialogTitle>
        </DialogHeader>

        <div className="w-full rounded-lg overflow-hidden bg-muted" style={{ height: "500px" }}>
          <Cropper
            ref={cropperRef}
            src={imageSrc}
            style={{ height: "100%", width: "100%" }}
            guides
            viewMode={1}
            dragMode="move"
            autoCropArea={1}
            background={false}
            responsive
            checkOrientation={false}
          />
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={handleRotateLeft} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />-90°
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleRotateRight} className="gap-1.5 text-xs">
            <RotateCw className="h-3.5 w-3.5" />+90°
          </Button>
          <Button type="button" variant={scaleX < 0 ? "default" : "outline"} size="sm" onClick={handleFlipH} className="gap-1.5 text-xs">
            <FlipHorizontal className="h-3.5 w-3.5" />Horizontal
          </Button>
          <Button type="button" variant={scaleY < 0 ? "default" : "outline"} size="sm" onClick={handleFlipV} className="gap-1.5 text-xs">
            <FlipVertical className="h-3.5 w-3.5" />Vertical
          </Button>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Processando..." : "Aplicar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
