-- Fix admin delete user to properly delete auth user and free up email
-- Replaces previous procedure to ensure auth.users is cleared

ALTER TABLE public.review_requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE public.review_notes ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.contract_categories ALTER COLUMN created_by DROP NOT NULL;

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

  -- 1. Preserve critical records by setting to null
  UPDATE public.contracts SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.contract_categories SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.review_requests SET requester_id = NULL, requester_name = 'Trống', manager_id = NULL WHERE requester_id = _user_id OR manager_id = _user_id;
  UPDATE public.review_notes SET author_id = NULL, author_name = 'Trống' WHERE author_id = _user_id;

  -- 2. Delete non-critical child records
  DELETE FROM public.notification_logs WHERE recipient_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.payment_schedules WHERE review_request_id IN (SELECT id FROM public.review_requests WHERE requester_id = _user_id);
  DELETE FROM public.contract_payment_schedules WHERE contract_id IN (SELECT id FROM public.contracts WHERE created_by = _user_id);
  DELETE FROM public.edit_logs WHERE editor_id = _user_id;

  -- 3. Delete from profile/role tables
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- 4. Delete the root user from Supabase Auth to allow email reuse
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
