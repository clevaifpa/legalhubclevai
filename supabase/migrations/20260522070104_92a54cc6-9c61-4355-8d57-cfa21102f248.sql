-- 1. Fix admin_update_user_department: enforce admin check
CREATE OR REPLACE FUNCTION public.admin_update_user_department(_department text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized. Admin access required.';
  END IF;

  UPDATE public.profiles SET department = _department, updated_at = now() WHERE user_id = _user_id;
  UPDATE public.user_roles SET department = _department WHERE user_id = _user_id;
END;
$$;

-- 2. Allow users to view their own edit_logs entries
DROP POLICY IF EXISTS "Users can view own edit_logs" ON public.edit_logs;
CREATE POLICY "Users can view own edit_logs"
ON public.edit_logs FOR SELECT
TO authenticated
USING (auth.uid() = editor_id);

-- 3. Contracts storage: include manager_chung in read access; add UPDATE policy
DROP POLICY IF EXISTS "Manager_chung can read contracts" ON storage.objects;
CREATE POLICY "Manager_chung can read contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'manager_chung'::app_role));

DROP POLICY IF EXISTS "Admins can update contracts" ON storage.objects;
CREATE POLICY "Admins can update contracts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. review-attachments storage: add UPDATE policy (owner or admin only)
DROP POLICY IF EXISTS "Owners or admins can update review-attachments" ON storage.objects;
CREATE POLICY "Owners or admins can update review-attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'review-attachments'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  bucket_id = 'review-attachments'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);
