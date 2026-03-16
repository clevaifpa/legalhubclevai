CREATE TABLE public.ai_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_text text NOT NULL,
  summary text NOT NULL,
  risk_level text NOT NULL,
  issues jsonb DEFAULT '[]'::jsonb,
  missing_clauses text[] DEFAULT '{}',
  recommendations text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_review_history"
  ON public.ai_review_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_review_history"
  ON public.ai_review_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all ai_review_history"
  ON public.ai_review_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));