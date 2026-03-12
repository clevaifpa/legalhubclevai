
-- RLS: Global manager (hiennd) can view all cho_quan_ly_chung requests
CREATE POLICY "Global manager can view cho_quan_ly_chung"
ON public.review_requests
FOR SELECT TO authenticated
USING (
  status = 'cho_quan_ly_chung'::review_request_status
  AND auth.uid() = (SELECT p.user_id FROM public.profiles p WHERE p.email = 'hiennd@clevai.edu.vn' LIMIT 1)
);

-- RLS: Global manager (hiennd) can update cho_quan_ly_chung requests
CREATE POLICY "Global manager can update cho_quan_ly_chung"
ON public.review_requests
FOR UPDATE TO authenticated
USING (
  status = 'cho_quan_ly_chung'::review_request_status
  AND auth.uid() = (SELECT p.user_id FROM public.profiles p WHERE p.email = 'hiennd@clevai.edu.vn' LIMIT 1)
);

-- RLS: Managers can view requests where they are assigned manager
CREATE POLICY "Managers can view assigned review_requests"
ON public.review_requests
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) AND manager_id = auth.uid());

-- RLS: Managers can update requests where they are assigned manager
CREATE POLICY "Managers can update assigned review_requests"
ON public.review_requests
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) AND manager_id = auth.uid());
