
-- Add RLS policies for manager_chung on review_notes
CREATE POLICY "Manager_chung can manage review_notes"
ON public.review_notes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager_chung'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager_chung'::app_role));

-- Add RLS policies for manager_chung on edit_logs
CREATE POLICY "Manager_chung can insert edit_logs"
ON public.edit_logs FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager_chung'::app_role));

CREATE POLICY "Manager_chung can view edit_logs"
ON public.edit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager_chung'::app_role));
