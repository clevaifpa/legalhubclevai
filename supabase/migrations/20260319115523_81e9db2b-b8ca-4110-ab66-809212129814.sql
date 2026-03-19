
-- Drop old restrictive policies for global manager
DROP POLICY IF EXISTS "Global manager can view cho_quan_ly_chung" ON public.review_requests;
DROP POLICY IF EXISTS "Global manager can update cho_quan_ly_chung" ON public.review_requests;

-- New: Global manager (manager_chung role) can view all requests assigned to them
CREATE POLICY "Global manager can view assigned requests"
ON public.review_requests FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager_chung'::app_role)
  AND (
    global_manager_id = auth.uid()
    OR status = 'cho_quan_ly_chung'::review_request_status
  )
);

-- New: Global manager can update requests assigned to them at their step
CREATE POLICY "Global manager can update assigned requests"
ON public.review_requests FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'manager_chung'::app_role)
  AND (
    global_manager_id = auth.uid()
    OR status = 'cho_quan_ly_chung'::review_request_status
  )
);
