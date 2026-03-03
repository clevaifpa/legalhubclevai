-- Procedure to delete user and preserve related records by setting foreign keys to NULL.
-- Also drops NOT NULL constraints on review tables to allow setting to NULL.

ALTER TABLE public.review_requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE public.review_notes ALTER COLUMN author_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Preserve contracts and requests (Set to NULL)
  UPDATE public.contracts 
  SET created_by = NULL 
  WHERE created_by = _user_id;
  
  UPDATE public.contract_categories 
  SET created_by = NULL 
  WHERE created_by = _user_id;
  
  UPDATE public.review_requests 
  SET requester_id = NULL, requester_name = 'Trống', manager_id = NULL 
  WHERE requester_id = _user_id OR manager_id = _user_id;
  
  UPDATE public.review_notes 
  SET author_id = NULL, author_name = 'Trống' 
  WHERE author_id = _user_id;

  -- 2. Delete user's notifications and logs
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.notification_logs WHERE recipient_user_id = _user_id;
  
  -- The edit_logs table editor_id uses string type, so cast uuid to string
  DELETE FROM public.edit_logs WHERE editor_id = _user_id::text;

  -- 3. Delete from profiles and user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;

  -- 4. Finally, securely delete from auth.users (This allows them to sign up again with same email)
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
