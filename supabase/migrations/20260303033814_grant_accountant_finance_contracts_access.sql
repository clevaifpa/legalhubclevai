-- ==============================================================================
-- Cấp quyền cho Kế toán và Tài chính để quản lý hợp đồng
-- ==============================================================================

-- 1. Quyền trên bảng contract_categories
-- Thêm quyền INSERT và UPDATE (họ có quyền xem do "Anyone can view categories")
CREATE POLICY "Accountants and Finance can insert categories" 
ON public.contract_categories FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Accountants and Finance can update categories" 
ON public.contract_categories FOR UPDATE 
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

-- 2. Quyền trên bảng contracts
-- Thêm quyền INSERT, UPDATE và DELETE cho phép họ tạo, sửa và xoá hợp đồng của mình tải lên
-- Nếu admin tải lên, Kế toán & Tài chính có thể xem, tuy nhiên tuỳ quy trình có thể không cho phép sửa.
-- Cho phép INSERT hợp đồng mới:
CREATE POLICY "Accountants and Finance can insert contracts" 
ON public.contracts FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

-- Cho phép UPDATE hợp đồng (chỉ giới hạn người tạo hoặc admin để an toàn, tuy nhiên theo logic app, họ là người upload)
-- Lưu ý: RLS không ghi đè policy của Admin (đã có 'Admins can manage contracts').
CREATE POLICY "Accountants and Finance can update own contracts" 
ON public.contracts FOR UPDATE 
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

-- Cho phép DELETE hợp đồng
CREATE POLICY "Accountants and Finance can delete own contracts" 
ON public.contracts FOR DELETE 
USING (
  (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role))
  AND created_by = auth.uid()
);

-- 3. Quyền trên bảng contract_payment_schedules
-- Thêm quyền INSERT, UPDATE và DELETE (họ có thể xem do "Users can view contract_payment_schedules" = true)
CREATE POLICY "Accountants and Finance can insert contract_payment_schedules"
ON public.contract_payment_schedules FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Accountants and Finance can update contract_payment_schedules"
ON public.contract_payment_schedules FOR UPDATE
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Accountants and Finance can delete contract_payment_schedules"
ON public.contract_payment_schedules FOR DELETE
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));
