
-- Allow managers to insert edit_logs
CREATE POLICY "Managers can insert edit_logs"
ON public.edit_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Allow managers to view edit_logs
CREATE POLICY "Managers can view edit_logs"
ON public.edit_logs
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role));
