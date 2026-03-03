-- Function to securely fetch users by roles bypassing RLS
-- This is needed because normal users cannot SELECT from user_roles
-- and they need to know who the admins/managers are to send them notifications.

CREATE OR REPLACE FUNCTION public.get_users_by_roles(_roles text[])
RETURNS TABLE(user_id uuid, role text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ur.user_id, ur.role
  FROM public.user_roles ur
  WHERE ur.role = ANY(_roles);
$$;
