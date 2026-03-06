
CREATE OR REPLACE FUNCTION public.recreate_user_profile(
  _user_id uuid,
  _email text,
  _full_name text,
  _department text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only recreate if profile doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    INSERT INTO public.profiles (user_id, email, full_name, department)
    VALUES (_user_id, _email, _full_name, _department);
  END IF;

  -- Ensure user has at least the 'user' role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'user');
  END IF;
END;
$$;
