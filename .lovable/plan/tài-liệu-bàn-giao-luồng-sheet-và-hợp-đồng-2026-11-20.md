# Tài liệu bàn giao luồng Sheet và hợp đồng

Tạo hai tài liệu tiếng Việt từ mã nguồn hiện tại, không sửa ứng dụng:

- `ARCHITECTURE-SHEET-SYNC.html`: bản HTML dễ đọc, gồm mục lục, các bước đánh số, sơ đồ luồng dạng văn bản, bảng mapping cột Sheet A–P sang trường dữ liệu và danh sách file liên quan.
- `ARCHITECTURE-SHEET-SYNC.md`: bản Markdown có cùng nội dung, phù hợp để đưa vào công cụ khác.

## Nội dung

1. **Đồng bộ từ Google Sheet:** nút giao diện, Edge Function, xác thực service account/JWT và scope, tên biến secrets, điều kiện READY, đối chiếu PDF để tạo mới/cập nhật, mapping trường, chuẩn hóa dữ liệu, ghi DONE và nhật ký `sync_logs`, phân quyền và cơ chế cron.
2. **Lưu trữ và xử lý hợp đồng:** phân biệt hợp đồng thêm thủ công với nhập Sheet; các trường và bảng lưu link/tệp; cách mở/tải link Drive hoặc Storage; bucket và chính sách truy cập; xóa hợp đồng, ghi REJECT về Sheet và xử lý lỗi.
3. **Đối chiếu nhất quán:** ghi rõ chỗ nào được xác nhận trong code, chỗ nào chưa thấy cấu hình, và các điểm có thể gây lỗi; không đưa giá trị bí mật vào tài liệu.
4. **Chuẩn bị khi xây lại:** checklist biến môi trường, Sheet/tab/quyền service account, bucket, bảng dữ liệu và quyền truy cập.

## Kỹ thuật

- Đối chiếu tài liệu với mã nguồn hiện tại, đặc biệt `sync-google-sheet`, `delete-contracts-sync-sheet`, `EntitySyncButton`, `ContractCategories` và các migration quyền lưu trữ.
- Chỉ ghi tên biến môi trường, không đọc hoặc đưa giá trị secret vào tài liệu.
- Kiểm tra HTML và Markdown sau khi tạo; chỉ lưu hai tài liệu bàn giao vào Files.