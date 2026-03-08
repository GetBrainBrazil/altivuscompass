import { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RotateCw, FlipHorizontal, FlipVertical } from "lucide-react";

interface ImageEditorProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onSave: (file: File) => void;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  flipH: boolean,
  flipV: boolean
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const bW = image.width * cos + image.height * sin;
  const bH = image.width * sin + image.height * cos;

  canvas.width = bW;
  canvas.height = bH;

  ctx.translate(bW / 2, bH / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  const cropCanvas = document.createElement("canvas");
  const cropCtx = cropCanvas.getContext("2d")!;
  cropCanvas.width = pixelCrop.width;
  cropCanvas.height = pixelCrop.height;
  cropCtx.drawImage(
    canvas,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve) => {
    cropCanvas.toBlob((blob) => {
      resolve(new File([blob!], "edited.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  });
}

/**
 * To apply flips visually, we pre-process the image source on a canvas
 * and pass the flipped version to react-easy-crop.
 */
function flipImage(src: string, flipH: boolean, flipV: boolean): Promise<string> {
  if (!flipH && !flipV) return Promise.resolve(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.translate(flipH ? img.width : 0, flipV ? img.height : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/jpeg", 0.95));
    };
    img.src = src;
  });
}

export function ImageEditor({ open, imageSrc, onClose, onSave }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [displaySrc, setDisplaySrc] = useState(imageSrc);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset state when a new image opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setDisplaySrc(imageSrc);
    }
  }, [open, imageSrc]);

  // Update displayed source when flips change
  useEffect(() => {
    if (!open) return;
    flipImage(imageSrc, flipH, flipV).then(setDisplaySrc);
  }, [flipH, flipV, imageSrc, open]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      // Since flips are already baked into displaySrc, pass flipH/flipV as false
      // and use displaySrc for the crop
      const file = await getCroppedImg(displaySrc, croppedAreaPixels, rotation, false, false);
      onSave(file);
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] p-5">
        <DialogHeader>
          <DialogTitle className="text-sm font-display">Editar Imagem</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[450px] bg-muted rounded-lg overflow-hidden">
          <Cropper
            image={displaySrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid
          />
        </div>

        <div className="space-y-3 mt-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs w-14 shrink-0">Zoom</Label>
            <Slider min={1} max={5} step={0.1} value={[zoom]} onValueChange={([v]) => setZoom(v)} className="flex-1" />
          </div>

          <div className="flex items-center gap-3">
            <Label className="text-xs w-14 shrink-0">Rotação</Label>
            <Slider min={0} max={360} step={1} value={[rotation]} onValueChange={([v]) => setRotation(v)} className="flex-1" />
            <span className="text-xs text-muted-foreground w-8 text-right">{rotation}°</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRotate} className="gap-1.5 text-xs">
              <RotateCw className="h-3.5 w-3.5" />90°
            </Button>
            <Button type="button" variant={flipH ? "default" : "outline"} size="sm" onClick={() => setFlipH(!flipH)} className="gap-1.5 text-xs">
              <FlipHorizontal className="h-3.5 w-3.5" />Horizontal
            </Button>
            <Button type="button" variant={flipV ? "default" : "outline"} size="sm" onClick={() => setFlipV(!flipV)} className="gap-1.5 text-xs">
              <FlipVertical className="h-3.5 w-3.5" />Vertical
            </Button>
          </div>
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
