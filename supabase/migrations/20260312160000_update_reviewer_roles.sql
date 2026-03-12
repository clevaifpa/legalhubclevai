-- 1. Thêm role 'manager_chung' vào enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager_chung';

-- 2. Thêm các cột reviewer_id vào bảng review_requests (nếu chưa có)
-- Lưu ý: Nếu cột đã tồn tại, lệnh này sẽ báo lỗi nhẹ (bỏ qua được) hoặc có thể xử lý bằng khối DO
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='review_requests' AND column_name='global_manager_id') THEN
        ALTER TABLE public.review_requests ADD COLUMN global_manager_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='review_requests' AND column_name='legal_reviewer_id') THEN
        ALTER TABLE public.review_requests ADD COLUMN legal_reviewer_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='review_requests' AND column_name='accountant_reviewer_id') THEN
        ALTER TABLE public.review_requests ADD COLUMN accountant_reviewer_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='review_requests' AND column_name='finance_reviewer_id') THEN
        ALTER TABLE public.review_requests ADD COLUMN finance_reviewer_id UUID REFERENCES auth.users(id);
    END IF;
END
$$;

-- 3. Cập nhật hàm RPC lấy user kèm roles từ Quản lý nhân viên
CREATE OR REPLACE FUNCTION public.get_all_reviewers_with_names()
RETURNS TABLE(user_id uuid, role text, full_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ur.user_id, ur.role::text, p.full_name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'manager', 'manager_chung', 'accountant', 'finance');
$$;
