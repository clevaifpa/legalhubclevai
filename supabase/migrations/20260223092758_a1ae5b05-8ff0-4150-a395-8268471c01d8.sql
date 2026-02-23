
-- RLS policies for new roles to access review workflow

-- Accountants can view review_requests
CREATE POLICY "Accountants can view review_requests"
  ON public.review_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- Finance can view review_requests
CREATE POLICY "Finance can view review_requests"
  ON public.review_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'finance'::app_role));

-- Managers can view review_requests
CREATE POLICY "Managers can view review_requests"
  ON public.review_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Accountants can update review_requests
CREATE POLICY "Accountants can update review_requests"
  ON public.review_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- Finance can update review_requests
CREATE POLICY "Finance can update review_requests"
  ON public.review_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'finance'::app_role));

-- Managers can update review_requests
CREATE POLICY "Managers can update review_requests"
  ON public.review_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Accountants can view payment_schedules
CREATE POLICY "Accountants can view payment_schedules"
  ON public.payment_schedules
  FOR SELECT
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- Finance can view payment_schedules
CREATE POLICY "Finance can view payment_schedules"
  ON public.payment_schedules
  FOR SELECT
  USING (has_role(auth.uid(), 'finance'::app_role));

-- Managers can view payment_schedules
CREATE POLICY "Managers can view payment_schedules"
  ON public.payment_schedules
  FOR SELECT
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Accountants can manage review_notes
CREATE POLICY "Accountants can manage review_notes"
  ON public.review_notes
  FOR ALL
  USING (has_role(auth.uid(), 'accountant'::app_role));

-- Finance can manage review_notes
CREATE POLICY "Finance can manage review_notes"
  ON public.review_notes
  FOR ALL
  USING (has_role(auth.uid(), 'finance'::app_role));

-- Managers can manage review_notes
CREATE POLICY "Managers can manage review_notes"
  ON public.review_notes
  FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role));
