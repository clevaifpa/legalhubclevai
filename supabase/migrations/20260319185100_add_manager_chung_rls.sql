-- RLS policies cho role 'manager_chung' để họ có thể thao tác hệ thống workflow

-- Review Requests:
CREATE POLICY "Manager Chung can view review_requests"
  ON public.review_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'manager_chung'::app_role));

CREATE POLICY "Manager Chung can update review_requests"
  ON public.review_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'manager_chung'::app_role));

-- Payment Schedules:
CREATE POLICY "Manager Chung can view payment_schedules"
  ON public.payment_schedules
  FOR SELECT
  USING (has_role(auth.uid(), 'manager_chung'::app_role));

-- Review Notes:
CREATE POLICY "Manager Chung can manage review_notes"
  ON public.review_notes
  FOR ALL
  USING (has_role(auth.uid(), 'manager_chung'::app_role));
