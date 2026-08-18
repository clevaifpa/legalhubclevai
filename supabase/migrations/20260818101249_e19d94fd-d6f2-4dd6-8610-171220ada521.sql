
-- 1. Controlled server-side notification creation
CREATE OR REPLACE FUNCTION public.send_notifications(
  _recipient_ids uuid[],
  _title text,
  _content text,
  _review_request_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _rid uuid;
  _allowed uuid[] := ARRAY[]::uuid[];
  _count integer := 0;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _title IS NULL OR length(_title) = 0 OR length(_title) > 300 THEN
    RAISE EXCEPTION 'Invalid notification title';
  END IF;

  IF _content IS NULL OR length(_content) > 5000 THEN
    RAISE EXCEPTION 'Invalid notification content';
  END IF;

  IF _recipient_ids IS NULL OR array_length(_recipient_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF array_length(_recipient_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Too many recipients';
  END IF;

  IF _review_request_id IS NOT NULL THEN
    -- Caller must be involved in the request
    IF NOT (
      public.can_view_review_request(_review_request_id, _caller)
      OR public.can_access_review_request_chat(_review_request_id, _caller)
    ) THEN
      RAISE EXCEPTION 'Not authorized for this review request';
    END IF;

    FOREACH _rid IN ARRAY _recipient_ids LOOP
      IF _rid IS NOT NULL AND (
        public.can_view_review_request(_review_request_id, _rid)
        OR public.can_access_review_request_chat(_review_request_id, _rid)
      ) THEN
        _allowed := _allowed || _rid;
      END IF;
    END LOOP;
  ELSE
    -- System-wide notices may only target admins
    FOREACH _rid IN ARRAY _recipient_ids LOOP
      IF _rid IS NOT NULL AND public.has_role(_rid, 'admin'::app_role) THEN
        _allowed := _allowed || _rid;
      END IF;
    END LOOP;
  END IF;

  IF array_length(_allowed, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, title, content, review_request_id, is_read)
  SELECT DISTINCT u, _title, _content, _review_request_id, false
  FROM unnest(_allowed) AS u;

  GET DIAGNOSTICS _count = ROW_COUNT;

  INSERT INTO public.notification_logs (
    notification_type, review_request_id, recipient_user_id, title, content, status
  )
  SELECT DISTINCT 'in_app', _review_request_id, u, _title, _content, 'sent'
  FROM unnest(_allowed) AS u;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_notifications(uuid[], text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_notifications(uuid[], text, text, uuid) TO authenticated;

-- 2. Lock down direct inserts
DROP POLICY IF EXISTS "Privileged or self can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Privileged or self can insert notification_logs" ON public.notification_logs;
CREATE POLICY "Users can insert own notification_logs"
ON public.notification_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = recipient_user_id);
