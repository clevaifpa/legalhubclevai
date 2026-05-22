DROP POLICY IF EXISTS "Finance can update assigned review_requests" ON public.review_requests;
CREATE POLICY "Finance can update review_requests at finance step"
ON public.review_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'finance'::app_role) AND status = 'cho_tai_chinh'::review_request_status)
WITH CHECK (public.has_role(auth.uid(), 'finance'::app_role));