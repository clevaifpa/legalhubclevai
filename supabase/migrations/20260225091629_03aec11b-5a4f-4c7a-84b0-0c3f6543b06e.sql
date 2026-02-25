
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text DEFAULT '';

-- Backfill email from auth.users
UPDATE public.profiles
SET email = u.email
FROM auth.users u
WHERE profiles.user_id = u.id AND (profiles.email IS NULL OR profiles.email = '');

-- Update handle_new_user to save email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _dept text;
BEGIN
  _name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    initcap(split_part(NEW.email, '@', 1))
  );
  _dept := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'department'), ''),
    ''
  );
  INSERT INTO public.profiles (user_id, full_name, department, email)
  VALUES (NEW.id, _name, _dept, NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Fix get_managers_by_department to filter on profiles.department
CREATE OR REPLACE FUNCTION public.get_managers_by_department(_department text)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id, p.full_name
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'manager' AND p.department = _department;
$$;
