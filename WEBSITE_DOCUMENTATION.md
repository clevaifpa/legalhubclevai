# 📋 WEBSITE DOCUMENTATION — LegalHub CLEVAI

> **Hệ thống quản lý hợp đồng & pháp chế** (Legal Contract Management & Compliance Platform)
> 
> Cập nhật: 2026-02-12

---

## 🏗️ Tổng quan kiến trúc

| Thành phần | Công nghệ |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI Framework** | shadcn/ui (Radix UI) + Tailwind CSS |
| **State Management** | React Query (TanStack) + React Context |
| **Routing** | React Router DOM v6 |
| **Backend / BaaS** | Supabase (Auth, Database, Storage, Edge Functions) |
| **AI** | Lovable AI Gateway (Gemini 3 Flash) |
| **Charts** | Recharts |
| **Form** | React Hook Form + Zod |
| **Deployment** | Lovable Platform |

---

## 👤 Hệ thống phân quyền (Role-based Access Control)

### Hai vai trò chính:

| Vai trò | Quyền hạn |
|---|---|
| **Admin (Pháp chế)** | Toàn quyền: Dashboard, Kho điều khoản, Tổng hợp đồng, Yêu cầu review (đa phòng ban), AI Kiểm tra |
| **User (Người dùng)** | Chỉ truy cập: UserDashboard (xem/tạo/xóa yêu cầu review của mình, xem tiến trình review đa phòng ban), AI Kiểm tra |

### Hệ thống review đa phòng ban:

| Phòng ban | Vai trò review |
|---|---|
| **⚖️ Pháp lý** | Kiểm tra tính hợp pháp, điều khoản ràng buộc |
| **💰 Tài chính** | Đánh giá giá trị, điều khoản thanh toán |
| **📊 Kế toán** | Kiểm tra hạch toán, thuế, chứng từ |

### Luồng xác thực:
1. Đăng ký/Đăng nhập qua **Supabase Auth** (email + password)
2. Khi đăng ký → trigger tự động tạo profile + gán role `user`
3. `useAuth` hook quản lý session, role, profile
4. `AuthGuard` chặn user đã đăng nhập vào trang Auth → redirect về `/`
5. `ProtectedRoutes` chặn user chưa đăng nhập → redirect về `/auth`

---

## 🗺️ Cấu trúc trang & Routes

### Routes cho Admin:
| Route | Page Component | Chức năng |
|---|---|---|
| `/` | `Dashboard` | Tổng quan thống kê hợp đồng |
| `/dieu-khoan` | `ClauseLibrary` | Kho điều khoản chuẩn |
| `/tong-hop-dong` | `ContractCategories` | Quản lý danh mục & hợp đồng |
| `/yeu-cau-review` | `AdminReviewRequests` | Quản lý yêu cầu review từ user |
| `/ai-kiem-tra` | `AIReview` | AI phân tích hợp đồng |

### Routes cho User:
| Route | Page Component | Chức năng |
|---|---|---|
| `/` | `UserDashboard` | Xem & tạo yêu cầu review |

### Route chung:
| Route | Page Component |
|---|---|
| `/auth` | `Auth` (Đăng nhập/Đăng ký) |
| `*` | `NotFound` (404) |

---

## 📄 Chi tiết chức năng từng trang

### 1. 🔐 Auth — Đăng nhập / Đăng ký
**File:** `src/pages/Auth.tsx`

- **Đăng nhập:** Email + Password → `supabase.auth.signInWithPassword()`
- **Đăng ký:** Email + Password + Họ tên + Bộ phận → `supabase.auth.signUp()` (kèm metadata `full_name`)
- Gửi email xác thực sau đăng ký
- Toggle giữa form đăng nhập/đăng ký

---

### 2. 📊 Dashboard (Admin) — Tổng quan
**File:** `src/pages/Dashboard.tsx`

- **Thống kê tổng hợp:**
  - Tổng số hợp đồng
  - Hợp đồng đang chờ review
  - Hợp đồng sắp hết hạn (30 ngày)
  - Hợp đồng đã ký
- **Biểu đồ:** PieChart phân bổ theo trạng thái (Nháp, Đang review, Đã ký, Hết hiệu lực)
- **Hợp đồng gần đây:** Danh sách hợp đồng mới nhất
- **Real-time:** Lắng nghe thay đổi qua Supabase Realtime channel
- Hook: `useContractStats()` → tính toán stats từ dữ liệu contracts

---

### 3. 📚 Kho điều khoản chuẩn (Admin) — ClauseLibrary
**File:** `src/pages/ClauseLibrary.tsx`

- **Hiển thị:** Grid 2 cột danh sách điều khoản mẫu
- **Bộ lọc:**
  - Tìm kiếm theo tên/nội dung
  - Lọc theo loại hợp đồng (Mua bán, Dịch vụ, NDA, Hợp tác, Lao động, Thuê, Khác)
  - Lọc theo mức rủi ro (Thấp, Trung bình, Cao)
- **Thao tác:** Copy điều khoản vào clipboard
- **Dữ liệu:** Hiện sử dụng `mockData` (chưa kết nối Supabase)
- **Badge:** ContractTypeBadge, RiskBadge

---

### 4. 📁 Tổng hợp đồng (Admin) — ContractCategories
**File:** `src/pages/ContractCategories.tsx`

- **Quản lý danh mục:**
  - Tạo danh mục mới (tên + mô tả)
  - Xóa danh mục
  - Xem danh mục với số lượng hợp đồng
- **Quản lý hợp đồng trong danh mục:**
  - Upload hợp đồng mới (file đính kèm + metadata)
  - Thông tin: Tiêu đề, Đối tác, Loại HĐ, Giá trị, Ngày hiệu lực/hết hạn, Mức rủi ro
  - Upload biên bản thanh lý
  - Xóa hợp đồng
  - Download / Xem file đính kèm
- **Trạng thái:** Nháp, Đang review, Đã ký, Hết hiệu lực
- **Storage:** Supabase Storage bucket `contracts`
- **Database:** Bảng `contract_categories` + `contracts`

---

### 5. 📝 Yêu cầu Review (Admin) — AdminReviewRequests
**File:** `src/pages/AdminReviewRequests.tsx`

- **Danh sách:** Tất cả yêu cầu review từ users
- **Chi tiết yêu cầu:**
  - Tiêu đề HĐ, Đối tác, Giá trị, Thời hạn
  - Người yêu cầu, Bộ phận
  - Deadline review, Mức ưu tiên (Cao/Trung bình/Thấp)
  - Mô tả, File đính kèm
- **Review đa phòng ban:**
  - 3 phòng ban review: Pháp lý (⚖️), Tài chính (💰), Kế toán (📊)
  - Mỗi phòng ban có trạng thái riêng: Chờ review / Đã duyệt / Từ chối / Cần chỉnh sửa
  - Hiển thị tiến trình review (compact icons + progress bar + department cards)
  - Dashboard tổng hợp số lượng chờ review theo từng phòng ban
  - Dialog xử lý cho phép chọn phòng ban + đánh giá + ghi chú riêng
- **Thao tác Admin:**
  - Cập nhật trạng thái tổng thể: Chờ xử lý → Đang review → Đã hoàn thành / Yêu cầu chỉnh sửa / Từ chối
  - Thêm đánh giá theo từng phòng ban
  - Thêm ghi chú admin
  - Xóa yêu cầu
- **Bộ lọc:** Theo trạng thái, theo phòng ban review
- **Lọc:** Cards phòng ban + status filter

---

### 6. 🤖 AI Kiểm tra (Admin) — AIReview
**File:** `src/pages/AIReview.tsx`

- **Đầu vào:** Paste nội dung hợp đồng vào textarea
- **Xử lý:** Gọi Supabase Edge Function `analyze-contract`
  - Sử dụng **Lovable AI Gateway** → model `google/gemini-3-flash-preview`
  - System prompt: Chuyên gia pháp chế Việt Nam
  - Hỗ trợ so sánh với điều khoản chuẩn
- **Kết quả phân tích:**
  - 📝 Tóm tắt tổng quan
  - ⚡ Mức rủi ro tổng thể (Thấp/Trung bình/Cao)
  - 🔍 Danh sách vấn đề phát hiện (clause, riskLevel, reason, suggestion)
  - ⚠️ Điều khoản bắt buộc bị thiếu
  - 💡 Khuyến nghị chung
- **Xử lý lỗi:** Rate limit (429), Credit hết (402), AI gateway error

---

### 7. 👤 User Dashboard — UserDashboard
**File:** `src/pages/UserDashboard.tsx`

- **Form gửi yêu cầu review mới:**
  - Tiêu đề HĐ, Đối tác, Giá trị HĐ
  - Ngày bắt đầu/kết thúc HĐ
  - Deadline review, Mức ưu tiên
  - Mô tả chi tiết
  - Upload file HĐ
- **Danh sách yêu cầu:** Chỉ hiển thị yêu cầu của user đang đăng nhập
- **Thao tác:** Xóa yêu cầu (chỉ yêu cầu "Chờ xử lý")
- **Realtime:** Tự động gán `requester_name` và `department` từ profile

---

## 🗄️ Cấu trúc Database (Supabase PostgreSQL)

### Bảng chính:

| Bảng | Mô tả | RLS |
|---|---|---|
| `profiles` | Thông tin user (full_name, department) | User xem/sửa của mình, Admin xem tất cả |
| `user_roles` | Phân quyền (admin/user) | User xem của mình, Admin quản lý tất cả |
| `clauses` | Điều khoản chuẩn | Tất cả xem, Admin quản lý |
| `contract_categories` | Danh mục hợp đồng | Tất cả xem, Admin quản lý |
| `contracts` | Hợp đồng | Tất cả xem, Admin quản lý |
| `review_requests` | Yêu cầu review | User xem/tạo của mình, Admin xem/sửa tất cả |
| `review_notes` | Ghi chú review | Owner xem, Admin quản lý |

### Enum types:
- `app_role`: admin, user
- `priority_level`: cao, trung_binh, thap
- `review_request_status`: cho_xu_ly, dang_review, da_hoan_thanh, yeu_cau_chinh_sua, tu_choi
- `contract_type`: mua_ban, dich_vu, nda, hop_tac, lao_dong, thue, khac
- `risk_level`: thap, trung_binh, cao
- `contract_status`: nhap, dang_review, da_ky, het_hieu_luc

### Storage:
- Bucket `contracts` (private) — Lưu file HĐ, biên bản thanh lý

### Triggers:
- `on_auth_user_created`: Tự tạo profile + role khi đăng ký
- `update_*_updated_at`: Tự cập nhật `updated_at` khi sửa record

---

## ⚡ Supabase Edge Functions

| Function | Mô tả |
|---|---|
| `analyze-contract` | AI phân tích hợp đồng qua Lovable AI Gateway (Gemini 3 Flash) |
| `send-notification-email` | Gửi email thông báo (chưa xem chi tiết) |

---

## 🧩 Cấu trúc Components

```
src/
├── App.tsx                    # Root app + routing logic
├── main.tsx                   # Entry point
├── index.css                  # Global styles
├── components/
│   ├── NavLink.tsx            # Navigation link wrapper
│   ├── common/
│   │   ├── ContractTypeBadge.tsx       # Badge hiển thị loại HĐ
│   │   ├── DepartmentReviewTracker.tsx # ★ Tiến trình review đa phòng ban
│   │   ├── RiskBadge.tsx               # Badge mức rủi ro
│   │   └── StatusBadge.tsx             # Badge trạng thái
│   ├── layout/
│   │   ├── AppLayout.tsx      # Layout chung (Sidebar + Content)
│   │   └── AppSidebar.tsx     # Sidebar navigation
│   └── ui/                    # 49 shadcn/ui components
├── hooks/
│   ├── useAuth.tsx            # Auth context + provider
│   ├── useContracts.ts        # Contracts data + stats (realtime)
│   ├── use-mobile.tsx         # Responsive detection
│   └── use-toast.ts           # Toast notifications
├── data/
│   └── mockData.ts            # Dữ liệu mẫu (clauses, etc.)
├── integrations/
│   └── supabase/              # Supabase client + types
├── lib/
│   └── format.ts              # Utility functions (formatDate, formatCurrency)
├── pages/                     # 10 page components
├── types/
│   ├── index.ts               # TypeScript types & label constants
│   └── reviewDepartments.ts   # ★ Types & utils cho review đa phòng ban
└── test/                      # Test files
```

---

## 🔒 Bảo mật

- **Row Level Security (RLS)** trên tất cả bảng
- **SECURITY DEFINER** cho function `has_role()` — tránh lộ bảng `user_roles`
- **Auth guard** ở frontend: redirect chưa đăng nhập → `/auth`
- **Role-based routing**: Admin/User thấy routes khác nhau
- **Storage policies**: Upload cho authenticated, Delete chỉ Admin

---

## 📱 Sidebar Navigation

### Admin:
1. 📊 **Tổng quan** (`/`)
2. 📚 **Kho điều khoản** (`/dieu-khoan`)
3. 📁 **Tổng hợp đồng** (`/tong-hop-dong`)
4. 📝 **Yêu cầu review** (`/yeu-cau-review`)
5. 🤖 **AI Kiểm tra** (`/ai-kiem-tra`) [Mục Nâng cao]

### User:
1. 📋 **Yêu cầu của tôi** (`/`)

---

## 🌐 Trang web live

- **Platform:** Lovable
- **URL:** (chưa cấu hình project ID)

---

## 📝 Ghi chú thêm

- **ClauseLibrary** hiện dùng `mockData` → cần migrate sang Supabase `clauses` table
- **ContractStorage** và **ReviewRequests** pages tồn tại nhưng không được route trong App.tsx → có thể là legacy code
- UI hoàn toàn bằng tiếng Việt
- Responsive cho mobile (có `use-mobile` hook)
- Animation: fade-in, slide-up effects
- Realtime updates cho contracts qua Supabase channels
