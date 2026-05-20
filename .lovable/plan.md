# Thu gọn màn hình chi tiết review + nâng cấp Trao đổi nội bộ

Mục tiêu: rút gọn trang chi tiết yêu cầu review bằng accordion, đồng thời nâng cấp khung chat nội bộ với reply, edit, soft-delete, tag nhân viên, notification.

## 1. Database (migration)

Cập nhật bảng `review_request_messages`:
- Thêm `reply_to_message_id uuid null` (self-reference, không cần FK cứng — chỉ index).
- Thêm `edited_at timestamptz null`.
- Thêm `deleted_at timestamptz null`.
- Giữ `is_deleted boolean` (đã có) để filter nhanh.
- Index `(request_id, created_at)` và `(reply_to_message_id)`.

RLS bổ sung:
- UPDATE: chỉ `sender_id = auth.uid()` (sửa nội dung) hoặc admin (soft delete bất kỳ).
- Người được reply: cập nhật `can_access_review_request_chat` để chấp nhận user là sender của tin nhắn gốc được reply trong cùng request.

Notification (dùng bảng `notifications` hiện có): client tự insert khi gửi tin có mention / reply.

## 2. Component

Tách `InternalChat.tsx` hiện tại, viết lại:
- Header thu gọn (luôn hiển thị, dùng cho accordion ngoài): chỉ truyền count ra ngoài qua prop callback hoặc render tự trigger.
- Bên trong: list tin nhắn + ô nhập + reply preview + mention picker (đã có).
- Mỗi message:
  - Nếu `is_deleted`: hiển thị "Tin nhắn đã bị xóa" italic muted, vẫn render reply chain.
  - Nếu có `reply_to_message_id`: render block quote (nền `bg-muted/40`, border-l-2 accent) với tên + trích đoạn tin gốc; click → scroll tới `#msg-<id>` và highlight ngắn.
  - Menu dropdown (`...`) ở góc phải tin: Trả lời (mọi user có quyền), Chỉnh sửa (chỉ sender), Xóa (sender hoặc admin).
  - Hover/edit mode: textarea + Lưu/Hủy. Nhãn "Đã chỉnh sửa" khi `edited_at`.
- Reply preview bar phía trên ô nhập với nút X hủy.
- Mention chip có tooltip (email · phòng ban · vai trò) qua `Tooltip` shadcn.

## 3. Trang chi tiết

Chỉnh `src/pages/AdminReviewRequests.tsx` và `src/pages/UserDashboard.tsx`:
- Bọc 3 khối thành `Collapsible` (shadcn) — mặc định đóng:
  1. **Mô tả chi tiết** — đặt ngay sau thông tin tổng quan, trước Đợt thanh toán.
  2. **Nhận xét các bước duyệt (N)** — sau Tiến trình duyệt.
  3. **Trao đổi nội bộ (N)** — sau khối nhận xét.
- Trigger thu gọn: box border mảnh, nền `bg-card`, padding gọn, icon trái + tiêu đề + `ChevronDown` xoay khi mở.
- Số lượng tin nhắn: query nhanh `count` riêng cho header, hoặc lazy: chỉ mount `InternalChat` khi mở (giữ count ở state cha).
- Thứ tự cuối: Header → Tổng quan → Mô tả (acc) → Đợt thanh toán → Tiến trình duyệt → Nhận xét (acc) → Trao đổi nội bộ (acc) → Tài liệu → Nút thao tác.

## 4. Notification deep-link

`Notifications.tsx` đã append `#internal-chat`. Bổ sung:
- Khi URL có hash `#internal-chat` hoặc `#msg-<id>`: trang tự mở accordion "Trao đổi nội bộ" của request đúng, sau đó scroll.
- Khi reply, tạo notification cho sender của tin nhắn gốc (nếu khác người trả lời) với content + marker `<!--SCROLL:msg-<id>-->`.

## 5. Phân quyền

`can_access_review_request_chat` mở rộng (đã có viewers + roles). Reply người ngoài luồng → grant viewer cho họ (giống mention) khi insert reply.

## 6. Files chạm

- migration mới (cột + RLS update).
- `src/components/review/InternalChat.tsx` — rewrite.
- `src/pages/AdminReviewRequests.tsx`, `src/pages/UserDashboard.tsx` — bọc Collapsible.
- `src/pages/Notifications.tsx` — đảm bảo hash deep-link.
- Cập nhật `mem://features/internal-chat`.

## 7. Kiểm thử thủ công

1. Mặc định 3 accordion đóng → trang ngắn gọn.
2. Mở Trao đổi → gửi tin có `@user`, user nhận notification, click → mở đúng request + accordion + scroll.
3. Reply 1 tin → tin mới có quote, click quote → scroll tới gốc; người được reply nhận notification.
4. Sửa tin mình → hiện "Đã chỉnh sửa"; không sửa được tin người khác.
5. Xóa tin mình → "Tin nhắn đã bị xóa"; reply trỏ tới tin đã xóa hiển thị "Tin nhắn gốc đã bị xóa".
6. User ngoài luồng và không được tag/reply → RLS chặn.
