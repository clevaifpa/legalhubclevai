# Kế hoạch: Trao đổi nội bộ trong yêu cầu review

Thêm khu vực chat "Trao đổi nội bộ" gắn với từng review request, hỗ trợ @mention, notification và phân quyền theo luồng duyệt.

## 1. Database (migration)

Bảng mới `public.review_request_messages`:
- `id uuid pk`
- `request_id uuid not null` (trỏ tới `review_requests.id`)
- `sender_id uuid not null`
- `sender_name text not null`
- `sender_role text` (vai trò tại thời điểm gửi: admin / manager_chung / manager / user / accountant / finance)
- `sender_department text`
- `message text not null check (length(trim(message)) > 0)`
- `mentioned_user_ids uuid[] default '{}'`
- `is_deleted boolean default false`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Index trên `(request_id, created_at)`.

Bảng phụ `public.review_request_message_viewers` để cấp quyền xem cho người được tag (nằm ngoài luồng duyệt):
- `id uuid pk`
- `request_id uuid not null`
- `user_id uuid not null`
- `created_at timestamptz default now()`
- unique `(request_id, user_id)`

### RLS

Helper SECURITY DEFINER function `can_access_review_request_chat(_req_id uuid, _user_id uuid)` trả về bool:
- true nếu admin
- true nếu user là `requester_id`, `manager_id`, `global_manager_id`, `legal_reviewer_id`, `accountant_reviewer_id`, `finance_reviewer_id` của request
- true nếu user có role `accountant` hoặc `finance` (đã có quyền xem mọi request)
- true nếu user có role `manager_chung`
- true nếu user nằm trong `review_request_message_viewers` cho request đó

Policies trên `review_request_messages`:
- SELECT: `can_access_review_request_chat(request_id, auth.uid()) AND is_deleted = false`
- INSERT: `sender_id = auth.uid() AND can_access_review_request_chat(request_id, auth.uid())`
- UPDATE: chỉ sender hoặc admin (cho soft-delete)

Policies trên `review_request_message_viewers`:
- SELECT: `can_access_review_request_chat(request_id, auth.uid())`
- INSERT: bất kỳ ai đã `can_access_review_request_chat` (để khi gửi tin có mention, cấp viewer cho người được tag)

Bật realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.review_request_messages;`

## 2. UI

Tạo component `src/components/review/InternalChat.tsx`:
- Props: `requestId`, `contractTitle`
- Header "Trao đổi nội bộ (N)" + dòng nhắc quyền nhỏ
- Danh sách card tin nhắn: avatar chữ cái đầu, tên + role + thời gian, nội dung render mention `@xxx` thành chip màu primary
- Tin của user hiện tại: nền `bg-primary/5`
- Max-height ~400px, scroll riêng, auto-scroll xuống cuối khi có tin mới
- Ô nhập textarea + nút Gửi (disabled khi rỗng / đang gửi)
- Mention picker: khi gõ `@`, hiện popover danh sách từ `profiles` (filter theo từ khoá sau `@`), chọn → chèn `@tên` và lưu `user_id` vào danh sách mentions
- Realtime subscribe INSERT theo `filter: request_id=eq.<id>`
- Khi gửi: insert row + cho mỗi user được tag (không phải sender) → insert notification + insert viewer row

Tích hợp vào trang chi tiết review request (xem `AdminReviewRequests.tsx` / `UserDashboard.tsx`): chèn ngay sau khối "Nhận xét các bước duyệt", trước "Tài liệu" / nút thao tác. Thêm `id="internal-chat"` cho anchor scroll.

## 3. Notification

Khi insert tin nhắn có mention, client tạo notification cho từng người được tag (trừ sender):
- `title`: "Bạn được nhắc đến trong yêu cầu review"
- `content`: `[Tên hợp đồng] {sender_name}: {trích đoạn message}`
- `review_request_id`: requestId

Khi click notification (logic hiện có ở `NotificationBell` / `Notifications.tsx`), điều hướng tới trang chi tiết request — bổ sung query `#internal-chat` để page tự `scrollIntoView`.

## 4. Phân quyền tóm tắt

- Admin / Pháp chế (admin) / accountant / finance / manager_chung: xem & gửi mọi chat
- Requester, các reviewer trong luồng (manager, global manager, legal, accountant, finance reviewer): xem & gửi
- User được tag: tự động thêm vào `review_request_message_viewers` → xem & gửi
- Người khác: 403 (RLS chặn)

## 5. UX

- Empty state: "Chưa có trao đổi nào. Hãy bắt đầu cuộc trò chuyện."
- Loading skeleton khi fetch lần đầu
- Toast lỗi khi insert thất bại; giữ nội dung trong ô nhập
- Không cho gửi tin trống / chỉ whitespace
- Nút Gửi loading state khi đang insert
- Realtime đảm bảo cập nhật ngay; auto scroll chỉ khi user đã ở đáy

## 6. Các file dự kiến chạm

- migration mới (bảng + RLS + helper function + realtime)
- `src/components/review/InternalChat.tsx` (mới)
- `src/components/review/MentionInput.tsx` (mới, dùng nội bộ)
- `src/pages/AdminReviewRequests.tsx` (chèn component)
- `src/pages/UserDashboard.tsx` (chèn component)
- `src/pages/Notifications.tsx` hoặc `NotificationBell.tsx` (giữ điều hướng, hash `#internal-chat`)
- `mem://features/internal-chat` (memory mới) + cập nhật `mem://index.md`

## 7. Kiểm thử thủ công

1. Requester gửi tin → admin và các reviewer thấy ngay (realtime).
2. Tag một user ngoài luồng → user đó nhận notification, click vào mở đúng request, scroll xuống chat, có quyền đọc/ghi.
3. User không liên quan và không được tag → không gọi được API (RLS chặn).
4. Tin trống / chỉ space → không gửi.
5. Mention picker filter đúng theo ký tự sau `@`.
