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

  -- 1. Preserve critical records by nullifying references
  UPDATE public.contracts SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.contract_categories SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.review_requests SET requester_id = NULL, manager_id = NULL WHERE requester_id = _user_id OR manager_id = _user_id;
  UPDATE public.review_notes SET author_id = NULL WHERE author_id = _user_id;
  UPDATE public.clauses SET created_by = NULL WHERE created_by = _user_id;

  -- 2. Delete non-critical child records
  DELETE FROM public.notification_logs WHERE recipient_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.edit_logs WHERE editor_id = _user_id::text;

  -- 3. Delete profile and roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- 4. Delete from auth.users to free up email
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;