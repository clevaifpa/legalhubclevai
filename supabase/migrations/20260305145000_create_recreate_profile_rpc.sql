-- Allows a recovering user to recreate their profile
CREATE OR REPLACE FUNCTION public.recreate_user_profile(_user_id uuid, _email text, _full_name text, _department text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Security check: only allow if user_id matches the authenticated user
  IF auth.uid() != _user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name, department)
  VALUES (_user_id, _email, _full_name, _department)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
