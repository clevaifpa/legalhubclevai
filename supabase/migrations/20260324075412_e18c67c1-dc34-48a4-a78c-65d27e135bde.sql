
CREATE TABLE public.contract_related_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'khac',
  doc_name text NOT NULL DEFAULT '',
  doc_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_related_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract_related_docs" ON public.contract_related_docs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can manage own contract_related_docs" ON public.contract_related_docs FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'accountant'::app_role) AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.created_by = auth.uid())
) WITH CHECK (
  has_role(auth.uid(), 'accountant'::app_role) AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.created_by = auth.uid())
);

CREATE POLICY "Finance can manage own contract_related_docs" ON public.contract_related_docs FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'finance'::app_role) AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.created_by = auth.uid())
) WITH CHECK (
  has_role(auth.uid(), 'finance'::app_role) AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.created_by = auth.uid())
);

CREATE POLICY "Manager_chung can manage own contract_related_docs" ON public.contract_related_docs FOR ALL TO authenticated USING (
  has_role(auth.uid(), 'manager_chung'::app_role) AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.created_by = auth.uid())
) WITH CHECK (
  has_role(auth.uid(), 'manager_chung'::app_role) AND EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.created_by = auth.uid())
);

CREATE POLICY "Accountants can view all contract_related_docs" ON public.contract_related_docs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Finance can view all contract_related_docs" ON public.contract_related_docs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Manager_chung can view all contract_related_docs" ON public.contract_related_docs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager_chung'::app_role));

CREATE POLICY "Managers can view department contract_related_docs" ON public.contract_related_docs FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.department = (SELECT p.department FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "Users can view own department contract_related_docs" ON public.contract_related_docs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.contracts c WHERE c.id = contract_related_docs.contract_id AND c.department = (SELECT p.department FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  )
);
