-- ==============================================================================
-- Cấp quyền XEM (SELECT) toàn phần hợp đồng cho Kế toán và Tài chính
-- (Bổ sung do chính sách "Users can view own department contracts" chặn không cho
-- Kế toán và Tài chính xem các hợp đồng do Pháp chế hoặc phòng khác tải lên).
-- ==============================================================================

CREATE POLICY "Accountants and Finance can view all contracts" 
ON public.contracts FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'finance'::app_role));
