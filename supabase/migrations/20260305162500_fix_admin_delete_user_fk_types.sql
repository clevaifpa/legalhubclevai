-- Fix admin delete user to properly delete auth user and free up email
-- Solves foreign key constraints and type mismatches.

ALTER TABLE public.clauses ALTER COLUMN created_by DROP NOT NULL;

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

  -- 1. Preserve critical records by setting relationships to null
  UPDATE public.contracts SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.contract_categories SET created_by = NULL WHERE created_by = _user_id;
  UPDATE public.review_requests SET requester_id = NULL, requester_name = 'Trống', manager_id = NULL WHERE requester_id = _user_id OR manager_id = _user_id;
  UPDATE public.review_notes SET author_id = NULL, author_name = 'Trống' WHERE author_id = _user_id;
  UPDATE public.clauses SET created_by = NULL WHERE created_by = _user_id;

  -- 2. Delete non-critical child records (using correct data types)
  DELETE FROM public.notification_logs WHERE recipient_user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  
  -- Clean up payment schedules based on the review requests the user WAS attached to
  -- Note: Since we set requester_id to NULL above, we can't reliably find them here unless 
  -- we do this BEFORE setting them to NULL. The cleanest way is to delete them BEFORE the UPDATE block,
  -- but since payment schedules are tied to the request (which we keep), we should KEEP the payment schedules as well. 
  -- They belong to the request, not the user explicitly.
  
  -- Fix type mismatch for edit_logs (_user_id is UUID)
  DELETE FROM public.edit_logs WHERE editor_id = _user_id;

  -- 3. Delete from profile/role tables
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- 4. Delete the root user from Supabase Auth to allow email reuse
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
