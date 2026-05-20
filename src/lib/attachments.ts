import { supabase } from "@/integrations/supabase/client";

export const BUCKET = "review-attachments";
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILES_PER_MESSAGE = 10;

export type AttachmentType = "image" | "file" | "folder";

export interface Attachment {
  id: string;
  review_request_id: string;
  message_id: string | null;
  attachment_type: AttachmentType;
  file_url: string;
  storage_path: string | null;
  file_name: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
}

export const DRIVE_FOLDER_RE = /^https?:\/\/drive\.google\.com\/drive\/(u\/\d+\/)?folders\/[\w-]+/i;

export function isValidDriveFolderUrl(url: string): boolean {
  return DRIVE_FOLDER_RE.test(url.trim());
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function pathFor(reviewRequestId: string | null, userId: string, filename: string): string {
  const uid = (globalThis.crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const folder = reviewRequestId ?? `_drafts/${userId}`;
  return `${folder}/${uid}-${safeName(filename)}`;
}

export async function uploadFileToBucket(
  file: File,
  reviewRequestId: string | null,
  userId: string,
): Promise<{ path: string; url: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File vượt quá 20MB");
  }
  const path = pathFor(reviewRequestId, userId, file.name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  // Signed URL for display (1 day)
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signed.error) throw signed.error;
  return { path, url: signed.data.signedUrl };
}

export async function getSignedUrl(path: string, expiresIn = 60 * 60): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function insertAttachmentRow(row: {
  review_request_id: string;
  message_id: string | null;
  attachment_type: AttachmentType;
  file_url: string;
  storage_path: string | null;
  file_name: string;
  file_type: string;
  file_size: number | null;
  uploaded_by: string;
}): Promise<Attachment> {
  const { data, error } = await supabase
    .from("review_attachments" as any)
    .insert(row as any)
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

export async function deleteAttachment(att: Attachment): Promise<void> {
  if (att.storage_path) {
    await supabase.storage.from(BUCKET).remove([att.storage_path]);
  }
  const { error } = await supabase.from("review_attachments" as any).delete().eq("id", att.id);
  if (error) throw error;
}

export async function listAttachmentsForRequest(
  reviewRequestId: string,
  messageIdFilter?: "description" | "messages" | "all",
): Promise<Attachment[]> {
  let q = supabase
    .from("review_attachments" as any)
    .select("*")
    .eq("review_request_id", reviewRequestId)
    .order("created_at", { ascending: true });
  if (messageIdFilter === "description") q = q.is("message_id", null);
  else if (messageIdFilter === "messages") q = q.not("message_id", "is", null);
  const { data, error } = await q;
  if (error) return [];
  return (data as any[]) as Attachment[];
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

export function classifyFile(file: File): AttachmentType {
  return isImageMime(file.type) ? "image" : "file";
}

export function humanSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
