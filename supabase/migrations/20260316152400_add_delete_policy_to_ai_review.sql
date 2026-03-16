-- Thêm quyền xóa (DELETE) cho người dùng đối với lịch sử AI kiểm tra của chính họ
CREATE POLICY "Users can delete own ai_review_history"
ON public.ai_review_history
FOR DELETE
USING (auth.uid() = user_id);
