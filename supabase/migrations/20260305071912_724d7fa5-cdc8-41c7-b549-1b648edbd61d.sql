
-- Update admin_delete_user to also delete from auth.users so email can be re-registered
-- First make columns nullable to allow preserving records
ALTER TABLE public.review_requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE public.review_notes ALTER COLUMN author_id DROP NOT NULL;

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

  -- Preserve critical records by nullifying references
  UPDATE public.contracts SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.contract_categories SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.review_requests SET requester_id = NULL, manager_id = NULL WHERE requester_id = _user_id OR manager_id = _user_id;
  UPDATE public.review_notes SET author_id = NULL WHERE author_id = _user_id;

  -- Delete non-critical child records
  DELETE FROM public.notification_logs WHERE recipient_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.payment_schedules WHERE review_request_id IN (SELECT id FROM public.review_requests WHERE requester_id IS NULL);
  DELETE FROM public.edit_logs WHERE editor_id = _user_id::text;

  -- Delete profile and roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- Delete from auth.users to free up email for re-registration
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
