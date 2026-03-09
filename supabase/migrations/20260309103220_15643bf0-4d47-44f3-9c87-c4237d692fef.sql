
CREATE OR REPLACE FUNCTION public.get_managers_by_department(_department text)
 RETURNS TABLE(user_id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Get department managers
  SELECT p.user_id, p.full_name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'manager' AND p.department = _department
  
  UNION
  
  -- Always include global manager (hiennd)
  SELECT p.user_id, p.full_name || ' (Quản lý chung)'
  FROM public.profiles p
  WHERE p.email = 'hiennd@clevai.edu.vn'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.profiles p2 ON p2.user_id = ur.user_id
      WHERE ur.role = 'manager' AND p2.department = _department AND p2.user_id = p.user_id
    );
$function$;
