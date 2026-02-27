
-- Fix: Prevent users from changing their own department field
-- Only admins should be able to change department assignments
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  department = (SELECT p.department FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
);
