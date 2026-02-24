
-- 1. Update handle_new_user to extract email prefix and capitalize first letter
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
BEGIN
  -- Extract part before @ from email, capitalize first letter
  _name := split_part(NEW.email, '@', 1);
  _name := upper(left(_name, 1)) || substring(_name from 2);
  
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, _name);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- 2. Create edit_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.edit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  editor_id uuid NOT NULL,
  editor_name text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage edit_logs"
ON public.edit_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can insert edit_logs"
ON public.edit_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Finance can insert edit_logs"
ON public.edit_logs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'finance'::app_role));

CREATE POLICY "Accountants can view edit_logs"
ON public.edit_logs FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Finance can view edit_logs"
ON public.edit_logs FOR SELECT
USING (has_role(auth.uid(), 'finance'::app_role));

-- 3. Update existing profiles that have empty full_name - backfill from auth.users email
-- This needs to be done via a function since we can't directly query auth.users in a migration
CREATE OR REPLACE FUNCTION public.backfill_profile_names()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT p.user_id, u.email 
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.full_name = '' OR p.full_name IS NULL
  LOOP
    UPDATE public.profiles 
    SET full_name = upper(left(split_part(r.email, '@', 1), 1)) || substring(split_part(r.email, '@', 1) from 2)
    WHERE user_id = r.user_id;
  END LOOP;
END;
$$;

SELECT public.backfill_profile_names();
DROP FUNCTION public.backfill_profile_names();
