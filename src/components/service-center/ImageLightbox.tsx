import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Download, X } from "lucide-react";

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  caption?: string | null;
}

export function ImageLightbox({ open, onOpenChange, url, caption }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
    }
  }, [open, url]);

  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-5xl h-[92vh] p-0 gap-0 overflow-hidden flex flex-col bg-black/95 border-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/60 text-white shrink-0">
          <div className="text-xs opacity-80 truncate max-w-[60%]">{caption || "Imagem"}</div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setZoom(z => Math.max(0.2, z - 0.25))} title="Diminuir zoom">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setZoom(z => Math.min(8, z + 0.25))} title="Aumentar zoom">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
              onClick={() => { setZoom(1); setRotation(0); }} title="Tamanho original">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setRotation(r => r + 90)} title="Girar 90°">
              <RotateCw className="h-4 w-4" />
            </Button>
            <a href={url} target="_blank" rel="noreferrer" download
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/15" title="Abrir em nova aba">
              <Download className="h-4 w-4" />
            </a>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
              onClick={() => onOpenChange(false)} title="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image area */}
        <div
          className="flex-1 min-h-0 overflow-auto flex items-center justify-center"
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              setZoom(z => Math.min(8, Math.max(0.2, z - e.deltaY * 0.002)));
            }
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
        >
          <img
            src={url}
            alt={caption || "Imagem"}
            draggable={false}
            style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: "center center" }}
            className="select-none transition-transform max-h-full max-w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
