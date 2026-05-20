import { useState } from "react";
import { File, FileText, FolderOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Attachment } from "@/lib/attachments";
import { humanSize } from "@/lib/attachments";
import { ImageLightbox } from "./ImageLightbox";

interface Props {
  attachments: Attachment[];
  compact?: boolean;
}

function fileIcon(mime: string) {
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("text")) return FileText;
  return File;
}

export function AttachmentRenderer({ attachments, compact }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIdx, setStartIdx] = useState(0);

  if (!attachments?.length) return null;
  const images = attachments.filter((a) => a.attachment_type === "image");
  const files = attachments.filter((a) => a.attachment_type === "file");
  const folders = attachments.filter((a) => a.attachment_type === "folder");

  const openImg = (i: number) => {
    setStartIdx(i);
    setLightboxOpen(true);
  };

  return (
    <div className={`space-y-2 ${compact ? "mt-1.5" : "mt-2"}`}>
      {images.length > 0 && (
        <div
          className={`grid gap-1 ${
            images.length === 1 ? "grid-cols-1 max-w-[240px]" : "grid-cols-3 max-w-[360px]"
          }`}
        >
          {images.slice(0, 4).map((a, i) => {
            const showMore = i === 3 && images.length > 4;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => openImg(i)}
                className="relative aspect-square overflow-hidden rounded-md border bg-muted hover:opacity-90 transition-opacity"
              >
                <img src={a.file_url} alt={a.file_name} className="w-full h-full object-cover" />
                {showMore && (
                  <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-sm font-semibold">
                    +{images.length - 4}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {files.map((a) => {
        const Icon = fileIcon(a.file_type || "");
        return (
          <div
            key={a.id}
            className="flex items-center gap-2 bg-muted/40 border rounded-md px-2 py-1.5 max-w-md"
          >
            <Icon className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{a.file_name}</div>
              {a.file_size != null && (
                <div className="text-[10px] text-muted-foreground">{humanSize(a.file_size)}</div>
              )}
            </div>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
            >
              <a href={a.file_url} target="_blank" rel="noreferrer">
                Xem
              </a>
            </Button>
          </div>
        );
      })}

      {folders.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 bg-muted/40 border rounded-md px-2 py-1.5 max-w-md"
        >
          <FolderOpen className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{a.file_name || "Google Drive folder"}</div>
            <div className="text-[10px] text-muted-foreground truncate">{a.file_url}</div>
          </div>
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <a href={a.file_url} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              Mở folder
            </a>
          </Button>
        </div>
      ))}

      <ImageLightbox
        images={images.map((a) => ({ url: a.file_url, name: a.file_name }))}
        startIndex={startIdx}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
