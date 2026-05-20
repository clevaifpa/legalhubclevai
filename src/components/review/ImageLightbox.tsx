import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: { url: string; name?: string }[];
  startIndex: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ImageLightbox({ images, startIndex, open, onOpenChange }: Props) {
  const [idx, setIdx] = useState(startIndex);

  // Reset index when opened with new start
  if (open && idx >= images.length) setIdx(0);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const cur = images[idx];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 bg-background/95 border-0">
        <div className="relative flex items-center justify-center min-h-[60vh]">
          {cur && (
            <img
              src={cur.url}
              alt={cur.name || ""}
              className="max-h-[85vh] max-w-full object-contain"
            />
          )}
          {images.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center"
                aria-label="Trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center"
                aria-label="Sau"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded bg-background/80">
                {idx + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
