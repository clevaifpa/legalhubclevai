
CREATE OR REPLACE FUNCTION public.get_users_by_roles(_roles text[])
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role::text = ANY(_roles);
$$;
