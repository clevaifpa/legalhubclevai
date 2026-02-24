
-- Update handle_new_user to use full_name and department from metadata if provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
  _dept text;
BEGIN
  -- Use full_name from metadata if provided, otherwise derive from email
  _name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    initcap(split_part(NEW.email, '@', 1))
  );
  
  _dept := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'department'), ''),
    ''
  );
  
  INSERT INTO public.profiles (user_id, full_name, department)
  VALUES (NEW.id, _name, _dept);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;
