
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_name TEXT NOT NULL,
  tab_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync_logs" ON public.sync_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Accountants can view sync_logs" ON public.sync_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'accountant'::app_role));
CREATE POLICY "Finance can view sync_logs" ON public.sync_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'finance'::app_role));
CREATE POLICY "Manager_chung can view sync_logs" ON public.sync_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager_chung'::app_role));
