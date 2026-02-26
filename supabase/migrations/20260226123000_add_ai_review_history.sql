-- Lưu lịch sử AI kiểm tra hợp đồng
CREATE TABLE IF NOT EXISTS public.ai_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_text text NOT NULL,
  summary text NOT NULL,
  risk_level public.risk_level NOT NULL,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_clauses text[] NOT NULL DEFAULT '{}'::text[],
  recommendations text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_review_history ENABLE ROW LEVEL SECURITY;

-- Người dùng xem được lịch sử của chính họ; admin xem được tất cả
CREATE POLICY "Users can view own ai_review_history"
ON public.ai_review_history
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Người dùng chỉ được lưu lịch sử cho chính họ
CREATE POLICY "Users can insert own ai_review_history"
ON public.ai_review_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin toàn quyền quản trị lịch sử
CREATE POLICY "Admins can manage ai_review_history"
ON public.ai_review_history
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));