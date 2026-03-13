CREATE OR REPLACE FUNCTION public.get_all_reviewers_with_names()
 RETURNS TABLE(user_id uuid, full_name text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.user_id, p.full_name, ur.role::text
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('manager', 'manager_chung', 'admin', 'accountant', 'finance');
$$;