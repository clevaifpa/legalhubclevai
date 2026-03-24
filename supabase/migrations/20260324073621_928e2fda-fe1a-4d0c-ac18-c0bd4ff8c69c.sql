
CREATE TABLE public.review_supplementary_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id uuid NOT NULL REFERENCES public.review_requests(id) ON DELETE CASCADE,
  doc_name text NOT NULL,
  doc_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_supplementary_docs ENABLE ROW LEVEL SECURITY;

-- Same access pattern as review_requests
CREATE POLICY "Admins can manage supplementary_docs" ON public.review_supplementary_docs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own request docs" ON public.review_supplementary_docs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.review_requests rr WHERE rr.id = review_supplementary_docs.review_request_id AND rr.requester_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.review_requests rr WHERE rr.id = review_supplementary_docs.review_request_id AND rr.requester_id = auth.uid())
);

CREATE POLICY "Managers can view supplementary_docs" ON public.review_supplementary_docs FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'manager_chung'::app_role)
);

CREATE POLICY "Accountants can view supplementary_docs" ON public.review_supplementary_docs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Finance can view supplementary_docs" ON public.review_supplementary_docs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'::app_role));
