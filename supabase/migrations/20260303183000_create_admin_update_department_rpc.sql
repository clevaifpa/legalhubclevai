CREATE OR REPLACE FUNCTION public.admin_update_user_department(_user_id UUID, _department TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Must be an admin';
  END IF;

  -- Update profile
  UPDATE public.profiles SET department = _department WHERE user_id = _user_id;

  -- Update user role if applicable
  UPDATE public.user_roles SET department = _department WHERE user_id = _user_id;
END;
$$;
