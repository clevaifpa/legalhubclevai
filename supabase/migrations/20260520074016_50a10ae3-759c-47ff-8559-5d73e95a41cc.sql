DROP POLICY IF EXISTS "Accountants can update review_requests" ON public.review_requests;
DROP POLICY IF EXISTS "Finance can update review_requests" ON public.review_requests;

CREATE POLICY "Accountants can update assigned review_requests"
ON public.review_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'accountant'::app_role)
  AND status = 'cho_ke_toan'::review_request_status
  AND accountant_reviewer_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'accountant'::app_role)
  AND accountant_reviewer_id = auth.uid()
);

CREATE POLICY "Finance can update assigned review_requests"
ON public.review_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'finance'::app_role)
  AND status = 'cho_tai_chinh'::review_request_status
  AND finance_reviewer_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'finance'::app_role)
  AND finance_reviewer_id = auth.uid()
);