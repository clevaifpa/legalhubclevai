CREATE OR REPLACE FUNCTION public.delete_review_request(_req_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _req_owner uuid;
  _req_status text;
  _is_admin boolean;
  _owner_role text;
  _allowed_status text;
BEGIN
  SELECT requester_id, status::text INTO _req_owner, _req_status
  FROM public.review_requests
  WHERE id = _req_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu review này.';
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin');

  IF NOT _is_admin THEN
    IF auth.uid() != _req_owner THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa yêu cầu của người khác.';
    END IF;

    -- Determine first-step status based on owner's highest role
    SELECT CASE
      WHEN public.has_role(_req_owner, 'admin') THEN 'cho_quan_ly_chung'
      WHEN public.has_role(_req_owner, 'manager_chung') THEN 'cho_phap_che'
      WHEN public.has_role(_req_owner, 'manager') THEN 'cho_quan_ly_chung'
      WHEN public.has_role(_req_owner, 'accountant') THEN 'cho_quan_ly_chung'
      WHEN public.has_role(_req_owner, 'finance') THEN 'cho_quan_ly_chung'
      ELSE 'cho_quan_ly'
    END INTO _allowed_status;

    IF _req_status != _allowed_status THEN
      RAISE EXCEPTION 'Chỉ có thể xóa yêu cầu khi yêu cầu còn ở bước duyệt đầu tiên.';
    END IF;
  END IF;

  DELETE FROM public.payment_schedules WHERE review_request_id = _req_id;
  DELETE FROM public.review_notes WHERE review_request_id = _req_id;
  DELETE FROM public.notifications WHERE review_request_id = _req_id;
  DELETE FROM public.notification_logs WHERE review_request_id = _req_id;
  DELETE FROM public.review_request_messages WHERE request_id = _req_id;
  DELETE FROM public.review_request_message_viewers WHERE request_id = _req_id;
  DELETE FROM public.review_supplementary_docs WHERE review_request_id = _req_id;
  DELETE FROM public.review_requests WHERE id = _req_id;
END;
$function$;