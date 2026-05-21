
-- Fix: notifications insert restricted to privileged roles or self
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Privileged or self can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'accountant'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'manager_chung'::app_role)
);

-- Fix: notification_logs insert restricted to privileged roles or self
DROP POLICY IF EXISTS "Authenticated can insert notification_logs" ON public.notification_logs;
CREATE POLICY "Privileged or self can insert notification_logs"
ON public.notification_logs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = recipient_user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'accountant'::app_role)
  OR public.has_role(auth.uid(), 'finance'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'manager_chung'::app_role)
);

-- Fix: contracts storage bucket — drop broad policies, keep narrower ones
DROP POLICY IF EXISTS "Authenticated users can upload contracts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON storage.objects;

-- Fix: realtime.messages — require authenticated subscribers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated can use realtime" ON realtime.messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;
