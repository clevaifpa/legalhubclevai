
-- Delete review request with all child records
CREATE OR REPLACE FUNCTION public.delete_review_request(_req_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _req_owner uuid;
  _req_status text;
  _is_admin boolean;
BEGIN
  SELECT requester_id, status INTO _req_owner, _req_status
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
    IF _req_status NOT IN ('cho_xu_ly', 'cho_quan_ly') THEN
      RAISE EXCEPTION 'Chỉ có thể xóa yêu cầu đang ở trạng thái Chờ xử lý hoặc Chờ quản lý duyệt.';
    END IF;
  END IF;

  DELETE FROM public.payment_schedules WHERE review_request_id = _req_id;
  DELETE FROM public.review_notes WHERE review_request_id = _req_id;
  DELETE FROM public.notifications WHERE review_request_id = _req_id;
  DELETE FROM public.notification_logs WHERE review_request_id = _req_id;
  DELETE FROM public.review_requests WHERE id = _req_id;
END;
$$;

-- Delete contract with all child records (payment schedules, storage files)
CREATE OR REPLACE FUNCTION public.delete_contract(_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _is_admin boolean;
  _is_accountant boolean;
  _is_finance boolean;
BEGIN
  SELECT created_by INTO _owner
  FROM public.contracts
  WHERE id = _contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hợp đồng này.';
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin');
  _is_accountant := public.has_role(auth.uid(), 'accountant');
  _is_finance := public.has_role(auth.uid(), 'finance');

  IF NOT _is_admin THEN
    IF auth.uid() != _owner THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa hợp đồng của người khác.';
    END IF;
    IF NOT (_is_accountant OR _is_finance) THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa hợp đồng.';
    END IF;
  END IF;

  DELETE FROM public.contract_payment_schedules WHERE contract_id = _contract_id;
  DELETE FROM public.edit_logs WHERE record_id = _contract_id AND table_name = 'contracts';
  DELETE FROM public.contracts WHERE id = _contract_id;
END;
$$;

-- Delete user completely (admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Chỉ admin mới có quyền xóa tài khoản.';
  END IF;

  DELETE FROM public.notification_logs WHERE recipient_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.review_notes WHERE author_id = _user_id;
  DELETE FROM public.payment_schedules WHERE review_request_id IN (SELECT id FROM public.review_requests WHERE requester_id = _user_id);
  DELETE FROM public.review_requests WHERE requester_id = _user_id;
  DELETE FROM public.contract_payment_schedules WHERE contract_id IN (SELECT id FROM public.contracts WHERE created_by = _user_id);
  DELETE FROM public.edit_logs WHERE editor_id = _user_id;
  DELETE FROM public.contracts WHERE created_by = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;
END;
$$;
