-- Procedure to completely delete a review request and its child records
-- Required because standard users don't have DELETE permissions on notifications/logs.

CREATE OR REPLACE FUNCTION public.delete_review_request(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _req_owner uuid;
  _req_status text;
  _is_admin boolean;
BEGIN
  -- 1. Get request info
  SELECT requester_id, status INTO _req_owner, _req_status
  FROM public.review_requests
  WHERE id = _req_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu review này.';
  END IF;

  -- 2. Check permissions
  _is_admin := public.has_role(auth.uid(), 'admin');

  IF NOT _is_admin THEN
    -- If not admin, must be the owner and status must be cho_xu_ly or cho_quan_ly
    IF auth.uid() != _req_owner THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa yêu cầu của người khác.';
    END IF;

    IF _req_status != 'cho_xu_ly' AND _req_status != 'cho_quan_ly' THEN
      RAISE EXCEPTION 'Chỉ có thể xóa yêu cầu đang ở trạng thái Chờ xử lý hoặc Chờ quản lý duyệt.';
    END IF;
  END IF;

  -- 3. Delete from child tables (cascade might fail due to RLS, so we do it manually under SECURITY DEFINER)
  DELETE FROM public.payment_schedules WHERE review_request_id = _req_id;
  DELETE FROM public.review_notes WHERE review_request_id = _req_id;
  DELETE FROM public.notifications WHERE review_request_id = _req_id;
  DELETE FROM public.notification_logs WHERE review_request_id = _req_id;

  -- 4. Delete the request itself
  DELETE FROM public.review_requests WHERE id = _req_id;
END;
$$;
