# Đính kèm file/ảnh/folder cho Trao đổi nội bộ & Mô tả chi tiết yêu cầu review

Mục tiêu: cho phép gửi kèm ảnh, file tài liệu, link folder Google Drive trong tin nhắn nội bộ; cho phép upload ảnh minh hoạ cho phần Mô tả chi tiết của yêu cầu review. Không đụng workflow duyệt, quyền duyệt, trạng thái, hay logic thông báo hiện có.

## 1. Database (1 migration)

Tạo bảng `review_attachments`:

- `id uuid pk default gen_random_uuid()`
- `review_request_id uuid not null` — luôn gắn với 1 request
- `message_id uuid null` — null = attachment của mô tả chi tiết; not null = attachment của tin nhắn nội bộ
- `attachment_type text not null check in ('image','file','folder')`
- `file_url text not null` — URL Supabase Storage (image/file) hoặc link Google Drive (folder)
- `file_name text not null default ''`
- `file_type text not null default ''` — MIME hoặc 'folder'
- `file_size bigint null`
- `uploaded_by uuid not null`
- `created_at timestamptz not null default now()`
- Index `(review_request_id)`, `(message_id)`

RLS:
- SELECT: ai access được request (giống `can_access_review_request_chat` cho message_id is not null; đối với attachment của description thì dùng quyền xem request — admin/manager_chung/finance/accountant/manager cùng dept/requester).
- INSERT: `uploaded_by = auth.uid()` AND (message-level: `can_access_review_request_chat`; description-level: requester của request hoặc admin).
- DELETE: chỉ `uploaded_by = auth.uid()` hoặc admin.

Tạo helper RPC `can_view_review_request(_req_id uuid, _user_id uuid)` security definer để dùng trong policy SELECT của attachments (tránh lặp logic).

Storage bucket: thêm bucket `review-attachments` (private). Policy:
- INSERT/SELECT/DELETE giới hạn theo path prefix `<review_request_id>/...` và quyền `can_view_review_request`. Read dùng signed URL từ client khi hiển thị (hoặc public bucket nếu chấp nhận — chọn private + signed url 1h cho an toàn).

## 2. Helper module

`src/lib/attachments.ts`:
- `uploadAttachment(file, reviewRequestId, messageId?) -> { url, name, type, size }` — upload vào bucket path `<requestId>/<messageId|description>/<uuid>-<filename>`.
- `addFolderAttachment(driveUrl, reviewRequestId, messageId?)` — validate URL pattern `drive.google.com/drive/folders/...`.
- `getSignedUrl(path, expiresIn=3600)`.
- `deleteAttachment(id)` — remove DB row + storage object nếu có.
- Validate kích thước (≤ 20MB/file), tổng số file/message (≤ 10).

## 3. InternalChat.tsx

Bổ sung dưới ô input:
- 3 icon button: `ImagePlus` (chọn ảnh, accept=image/*), `Paperclip` (file bất kỳ), `FolderPlus` (mở dialog dán link Drive).
- State `pendingAttachments: PendingAttachment[]` với progress per item. Hiển thị chip preview phía trên input (thumbnail ảnh nhỏ + tên file + nút X). Trạng thái: `uploading` (spinner + progress), `done`, `error` (icon đỏ + tooltip).
- Khi gửi: insert message như cũ → lấy message.id → insert N row vào `review_attachments` với `message_id`. Nếu chỉ có attachment không có text → cho phép gửi (message = '').
- Render message:
  - Sau text, render block attachments:
    - Ảnh: grid (1 ảnh full-width nhỏ max 240px; 2–3 ảnh grid-cols-3; >3 ảnh grid-cols-3, ảnh thứ 4 hiện overlay `+N`). Click → mở Dialog xem lớn với điều hướng prev/next.
    - File: card `bg-muted/40 border rounded p-2 flex gap-2 items-center`: icon theo loại (FileText/FileImage/FileSpreadsheet/File) + tên + size + nút "Xem" (open signed url _blank).
    - Folder: card với `FolderOpen` icon + tên/link + nút "Mở folder" (_blank).
- Giữ nguyên @mention, reply, edit, soft-delete, scroll-to-hash.
- Lazy fetch attachments cùng với messages query (`select(*, review_attachments(*))` — nhưng bảng không có FK relationship, nên query song song theo `message_id in (...)` rồi map vào state).
- Realtime: subscribe thêm `review_attachments` filter theo `review_request_id`.

## 4. Form Mô tả chi tiết (AdminReviewRequests.tsx + UserDashboard.tsx)

Trong dialog tạo/sửa yêu cầu, dưới Textarea "Mô tả chi tiết":
- Component `<DescriptionImageUploader requestId={editingId|null} value={images} onChange={...} />`.
- Khi tạo mới (chưa có requestId): upload vào path tạm `_drafts/<auth.uid()>/<uuid>-<filename>`, sau khi tạo request thành công thì move (copy + delete + insert DB row với review_request_id mới). Đơn giản hơn: chỉ giữ trong state khi tạo mới, upload thật + insert DB sau khi request được tạo (Promise.all sau insert review_request).
- Khi sửa: load attachments hiện có (message_id is null), render grid thumbnails có nút X xoá. Thêm ảnh mới → upload + insert ngay với review_request_id.
- Xem chi tiết: hiển thị grid thumbnails dưới phần "Mô tả chi tiết", click mở viewer lớn.

Component dùng chung: `src/components/review/AttachmentChips.tsx` (preview pending), `src/components/review/AttachmentRenderer.tsx` (render đã gửi), `src/components/review/ImageLightbox.tsx` (Dialog xem ảnh lớn + prev/next).

## 5. UI/UX

- Icon set: lucide `ImagePlus`, `Paperclip`, `FolderPlus`, `FolderOpen`, `FileText`, `File`, `X`, `Loader2`.
- Progress: small linear bar (component `Progress` shadcn) hoặc spinner trong chip.
- Toast lỗi tiếng Việt: "Tải file thất bại", "File vượt quá 20MB", "Link Drive không hợp lệ".
- Mobile: chip wrap, grid ảnh `grid-cols-3 gap-1`, card file full width.

## 6. Files chạm

- migration mới: tạo bảng, policies, bucket + policies, RPC `can_view_review_request`.
- mới: `src/lib/attachments.ts`, `src/components/review/AttachmentChips.tsx`, `src/components/review/AttachmentRenderer.tsx`, `src/components/review/ImageLightbox.tsx`, `src/components/review/DescriptionImageUploader.tsx`.
- sửa: `src/components/review/InternalChat.tsx` — thêm attach UI + render.
- sửa: `src/pages/AdminReviewRequests.tsx` — form + view dialog.
- sửa: `src/pages/UserDashboard.tsx` — form + view dialog.
- cập nhật memory `mem://features/internal-chat` và thêm `mem://features/review-attachments`.

## 7. Không thay đổi

- Workflow duyệt, RLS của review_requests, trạng thái, notifications hiện tại.
- `notifications.ts` chỉ nhận thêm note "(có Y đính kèm)" nếu cần — không bắt buộc, sẽ giữ nguyên.

## 8. Kiểm thử thủ công

1. Chat: gửi tin chỉ có ảnh → thumbnail hiển thị, click xem lớn.
2. Gửi 1 message với 2 ảnh + 1 file PDF + 1 link Drive folder.
3. Link Drive sai pattern → báo lỗi.
4. File >20MB → báo lỗi.
5. Mô tả chi tiết: tạo request mới với 3 ảnh → xem lại thấy 3 ảnh dưới mô tả.
6. Sửa request: xoá 1 ảnh cũ, thêm 1 ảnh mới → reload thấy đúng.
7. User không thuộc luồng không xem được attachment (RLS chặn).
8. Mobile 360px: layout chip + grid không vỡ.
