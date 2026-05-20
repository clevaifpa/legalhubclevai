import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Attachment,
  MAX_FILE_SIZE,
  listAttachmentsForRequest,
  uploadFileToBucket,
  insertAttachmentRow,
  deleteAttachment,
} from "@/lib/attachments";
import { ImageLightbox } from "./ImageLightbox";

export interface PendingImage {
  tempId: string;
  file: File;
  previewUrl: string;
  uploading?: boolean;
}

interface Props {
  /** When editing, the existing review request id. null when creating new. */
  requestId: string | null;
  /** Local pending images (only used when requestId is null) */
  pendingImages: PendingImage[];
  onPendingChange: (next: PendingImage[]) => void;
  /** Saved attachments (only used when requestId != null) */
  savedImages?: Attachment[];
  onSavedChange?: (next: Attachment[]) => void;
}

/**
 * Uploader for review-request description images.
 * - When creating (requestId null): keep File objects locally; parent uploads after request insert.
 * - When editing (requestId set): upload + insert DB row immediately; delete removes immediately.
 */
export function DescriptionImageUploader({
  requestId,
  pendingImages,
  onPendingChange,
  savedImages = [],
  onSavedChange,
}: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Load existing attachments when editing
  useEffect(() => {
    if (!requestId || !onSavedChange) return;
    let cancelled = false;
    (async () => {
      const list = await listAttachmentsForRequest(requestId, "description");
      if (!cancelled) onSavedChange(list.filter((a) => a.attachment_type === "image"));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const onPick = () => inputRef.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    const arr = Array.from(files);
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" không phải là ảnh`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`"${f.name}" vượt quá 20MB`);
        continue;
      }
      if (requestId) {
        // Upload now
        setUploading(true);
        try {
          const { path, url } = await uploadFileToBucket(f, requestId, user.id);
          const row = await insertAttachmentRow({
            review_request_id: requestId,
            message_id: null,
            attachment_type: "image",
            file_url: url,
            storage_path: path,
            file_name: f.name,
            file_type: f.type,
            file_size: f.size,
            uploaded_by: user.id,
          });
          onSavedChange?.([...savedImages, row]);
        } catch (e: any) {
          toast.error(`Tải "${f.name}" thất bại`, { description: e?.message });
        } finally {
          setUploading(false);
        }
      } else {
        const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(f);
        onPendingChange([...pendingImages, { tempId, file: f, previewUrl }]);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePending = (tempId: string) => {
    const next = pendingImages.filter((p) => p.tempId !== tempId);
    onPendingChange(next);
  };

  const removeSaved = async (att: Attachment) => {
    try {
      await deleteAttachment(att);
      onSavedChange?.(savedImages.filter((a) => a.id !== att.id));
    } catch (e: any) {
      toast.error("Không thể xoá ảnh", { description: e?.message });
    }
  };

  const allItems: { url: string; name: string }[] = [
    ...savedImages.map((a) => ({ url: a.file_url, name: a.file_name })),
    ...pendingImages.map((p) => ({ url: p.previewUrl, name: p.file.name })),
  ];

  const openLightbox = (i: number) => {
    setLightboxIdx(i);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onPick}
          disabled={uploading}
          className="h-8"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          <span className="ml-1 text-xs">Thêm ảnh minh hoạ</span>
        </Button>
        {allItems.length > 0 && (
          <span className="text-xs text-muted-foreground">{allItems.length} ảnh</span>
        )}
      </div>

      {allItems.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {savedImages.map((a, i) => (
            <div key={a.id} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
              <button type="button" onClick={() => openLightbox(i)} className="w-full h-full">
                <img src={a.file_url} alt={a.file_name} className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => removeSaved(a)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Xoá ảnh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {pendingImages.map((p, i) => (
            <div
              key={p.tempId}
              className="relative group aspect-square rounded-md overflow-hidden border bg-muted"
            >
              <button
                type="button"
                onClick={() => openLightbox(savedImages.length + i)}
                className="w-full h-full"
              >
                <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => removePending(p.tempId)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Xoá ảnh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ImageLightbox
        images={allItems}
        startIndex={lightboxIdx}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}

/** Helper used by parent forms after creating a brand-new request to flush pending images. */
export async function flushPendingImages(
  pending: PendingImage[],
  requestId: string,
  userId: string,
) {
  for (const p of pending) {
    try {
      const { path, url } = await uploadFileToBucket(p.file, requestId, userId);
      await insertAttachmentRow({
        review_request_id: requestId,
        message_id: null,
        attachment_type: "image",
        file_url: url,
        storage_path: path,
        file_name: p.file.name,
        file_type: p.file.type,
        file_size: p.file.size,
        uploaded_by: userId,
      });
    } catch (e: any) {
      toast.error(`Tải ảnh "${p.file.name}" thất bại`, { description: e?.message });
    }
  }
}
